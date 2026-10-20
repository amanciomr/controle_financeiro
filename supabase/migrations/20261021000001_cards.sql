-- Fase 2: compras no cartão de crédito (à vista e parceladas) e pagamento de faturas.
--
-- Uma compra (card_purchases) gera um lançamento por parcela em
-- `transactions` (purchase_id, installment_number/total):
--   * date      = competência (data da compra; mesmo dia nos meses seguintes)
--   * cash_date = vencimento da fatura em que a parcela cai
-- A fatura é calculada pelo app (src/lib/domain/card.ts); aqui só guardamos
-- quais faturas foram marcadas como pagas.

create table public.card_purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  account_id uuid not null,
  purchase_date date not null,
  description text not null check (length(btrim(description)) between 1 and 120),
  total_amount bigint not null check (total_amount > 0),
  installments int not null default 1 check (installments between 1 and 48),
  category_id uuid not null,
  person_user_id uuid,
  notes text check (length(notes) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (household_id, id),
  foreign key (household_id, account_id)
    references public.accounts (household_id, id) on delete cascade,
  foreign key (household_id, category_id) references public.categories (household_id, id),
  foreign key (household_id, person_user_id)
    references public.household_members (household_id, user_id) on delete set null (person_user_id)
);
create index card_purchases_account_idx on public.card_purchases (account_id, purchase_date);
create trigger card_purchases_audit before insert or update on public.card_purchases
  for each row execute function public.set_audit_fields();

-- A conta precisa ser um cartão de crédito.
create function public.card_purchases_check_account() returns trigger
language plpgsql set search_path = '' as $$
declare
  account_kind public.account_kind;
begin
  select kind into account_kind from public.accounts where id = new.account_id;
  if found and account_kind <> 'credit_card' then
    raise exception 'A conta escolhida não é um cartão de crédito' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger card_purchases_check_account before insert or update on public.card_purchases
  for each row execute function public.card_purchases_check_account();

-- Parcelas somem junto com a compra.
alter table public.transactions
  add constraint transactions_purchase_fkey
  foreign key (household_id, purchase_id)
  references public.card_purchases (household_id, id) on delete cascade;
create index transactions_purchase_idx on public.transactions (purchase_id) where purchase_id is not null;

-- Faturas pagas (a fatura é identificada pelo mês de vencimento).
create table public.card_statement_payments (
  household_id uuid not null references public.households (id) on delete cascade,
  account_id uuid not null,
  due_month date not null check (extract(day from due_month) = 1),
  amount bigint check (amount >= 0),
  paid_at timestamptz not null default now(),
  paid_by uuid references auth.users (id) on delete set null default auth.uid(),
  primary key (account_id, due_month),
  foreign key (household_id, account_id)
    references public.accounts (household_id, id) on delete cascade
);

-- RLS: mesmo padrão das demais tabelas financeiras.
alter table public.card_purchases enable row level security;
alter table public.card_statement_payments enable row level security;
do $$
declare
  t text;
begin
  foreach t in array array['card_purchases', 'card_statement_payments'] loop
    execute format(
      'create policy "membros leem" on public.%I for select to authenticated
         using (household_id in (select public.my_household_ids()))', t);
    execute format(
      'create policy "membros inserem" on public.%I for insert to authenticated
         with check (household_id in (select public.my_household_ids()))', t);
    execute format(
      'create policy "membros editam" on public.%I for update to authenticated
         using (household_id in (select public.my_household_ids()))
         with check (household_id in (select public.my_household_ids()))', t);
    execute format(
      'create policy "membros excluem" on public.%I for delete to authenticated
         using (household_id in (select public.my_household_ids()))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

-- Salva a compra e refaz todas as suas parcelas numa única transação.
-- security invoker: a RLS vale normalmente. As parcelas vêm calculadas pelo
-- app ([{number,total,amount,date,cash_date}]). Se p_replace_transaction vier
-- preenchido, apaga aquele lançamento avulso (ex.: Pix que virou cartão).
create function public.save_card_purchase(
  p_purchase jsonb,
  p_installments jsonb,
  p_replace_transaction uuid default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  pid uuid := nullif(p_purchase ->> 'id', '')::uuid;
  hid uuid := (p_purchase ->> 'household_id')::uuid;
  cat_kind public.tx_type;
begin
  select kind into cat_kind from public.categories where id = (p_purchase ->> 'category_id')::uuid;
  if cat_kind is distinct from 'expense' then
    raise exception 'Compra no cartão precisa de uma categoria de despesa' using errcode = '23514';
  end if;

  if pid is null then
    insert into public.card_purchases (
      household_id, account_id, purchase_date, description, total_amount, installments,
      category_id, person_user_id, notes
    ) values (
      hid,
      (p_purchase ->> 'account_id')::uuid,
      (p_purchase ->> 'purchase_date')::date,
      p_purchase ->> 'description',
      (p_purchase ->> 'total_amount')::bigint,
      (p_purchase ->> 'installments')::int,
      (p_purchase ->> 'category_id')::uuid,
      nullif(p_purchase ->> 'person_user_id', '')::uuid,
      nullif(p_purchase ->> 'notes', '')
    ) returning id into pid;
  else
    update public.card_purchases set
      account_id = (p_purchase ->> 'account_id')::uuid,
      purchase_date = (p_purchase ->> 'purchase_date')::date,
      description = p_purchase ->> 'description',
      total_amount = (p_purchase ->> 'total_amount')::bigint,
      installments = (p_purchase ->> 'installments')::int,
      category_id = (p_purchase ->> 'category_id')::uuid,
      person_user_id = nullif(p_purchase ->> 'person_user_id', '')::uuid,
      notes = nullif(p_purchase ->> 'notes', '')
    where id = pid
    returning id into pid;
    if pid is null then
      raise exception 'Compra não encontrada' using errcode = 'P0002';
    end if;
    delete from public.transactions where purchase_id = pid;
  end if;

  insert into public.transactions (
    household_id, date, cash_date, description, amount, type, category_id, payment_method,
    account_id, person_user_id, status, notes, purchase_id, installment_number, installment_total
  )
  select p.household_id, i.date, i.cash_date, p.description, i.amount, 'expense', p.category_id,
         'credit_card', p.account_id, p.person_user_id, 'done', p.notes, p.id, i.number, i.total
    from public.card_purchases p
    cross join jsonb_to_recordset(p_installments)
      as i(number int, total int, amount bigint, date date, cash_date date)
   where p.id = pid;

  if (select coalesce(sum(amount), 0) from public.transactions where purchase_id = pid)
     <> (select total_amount from public.card_purchases where id = pid) then
    raise exception 'A soma das parcelas não fecha com o total da compra' using errcode = '23514';
  end if;

  if p_replace_transaction is not null then
    delete from public.transactions where id = p_replace_transaction and purchase_id is null;
  end if;

  return pid;
end;
$$;
revoke execute on function public.save_card_purchase(jsonb, jsonb, uuid) from public, anon;
grant execute on function public.save_card_purchase(jsonb, jsonb, uuid) to authenticated;

