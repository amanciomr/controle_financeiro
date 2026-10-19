-- Finanças Amâncio — schema inicial (Fase 1)
--
-- Convenções:
-- * todo dado financeiro pertence a uma casa (household_id);
-- * valores em centavos (bigint), sempre positivos; o sinal vem de `type`;
-- * datas de lançamento são `date` (sem hora);
-- * FKs compostas (household_id, x_id) impedem referências entre casas;
-- * pessoa (person_user_id / owner_user_id) nula = casa/compartilhado.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.tx_type as enum ('income', 'expense');
create type public.tx_status as enum ('planned', 'done', 'skipped');
create type public.category_nature as enum ('fixed', 'variable');
create type public.payment_method as enum (
  'credit_card', 'pix', 'debit', 'cash', 'boleto', 'transfer', 'auto_debit'
);
create type public.account_kind as enum ('checking', 'savings', 'cash', 'credit_card');
create type public.recurrence_frequency as enum ('monthly', 'yearly', 'weekly');
create type public.member_role as enum ('owner', 'member');
create type public.savings_goal_mode as enum ('amount', 'percent');

-- ---------------------------------------------------------------------------
-- Auditoria: quem criou e quem editou por último
-- ---------------------------------------------------------------------------

create function public.set_audit_fields() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_at := new.created_at;
    new.updated_by := new.created_by;
  else
    if new.household_id is distinct from old.household_id then
      raise exception 'household_id não pode ser alterado' using errcode = '42501';
    end if;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Casa e membros
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  timezone text not null default 'America/Bahia',
  savings_goal_mode public.savings_goal_mode not null default 'percent',
  -- centavos (amount) ou pontos-base (percent: 1000 = 10%)
  savings_goal_value bigint not null default 1000 check (savings_goal_value >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  display_name text not null check (length(btrim(display_name)) between 1 and 40),
  last_payment_method public.payment_method,
  last_account_id uuid,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- sempre em minúsculas (normalizado por trigger)
  email text not null check (email like '%_@_%' and email = lower(email)),
  display_name text check (length(btrim(display_name)) between 1 and 40),
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  invited_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null
);
create index household_invites_household_idx on public.household_invites (household_id);
create index household_invites_email_idx on public.household_invites (email);

create function public.normalize_invite_email() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;
create trigger household_invites_normalize before insert on public.household_invites
  for each row execute function public.normalize_invite_email();

-- ---------------------------------------------------------------------------
-- Contas e cartões
-- ---------------------------------------------------------------------------

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  kind public.account_kind not null default 'checking',
  owner_user_id uuid,
  -- saldo no início do dia opening_date
  opening_balance bigint not null default 0,
  opening_date date not null default current_date,
  -- só cartões de crédito
  closing_day smallint check (closing_day between 1 and 31),
  due_day smallint check (due_day between 1 and 31),
  credit_limit bigint check (credit_limit >= 0),
  payment_account_id uuid,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (household_id, id),
  check (kind <> 'credit_card' or (closing_day is not null and due_day is not null)),
  check (kind = 'credit_card' or (closing_day is null and due_day is null and credit_limit is null and payment_account_id is null)),
  foreign key (household_id, owner_user_id)
    references public.household_members (household_id, user_id) on delete set null (owner_user_id),
  foreign key (household_id, payment_account_id)
    references public.accounts (household_id, id) on delete set null (payment_account_id)
);
create trigger accounts_audit before insert or update on public.accounts
  for each row execute function public.set_audit_fields();

-- ---------------------------------------------------------------------------
-- Categorias (um nível de subcategoria)
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  parent_id uuid,
  name text not null check (length(btrim(name)) between 1 and 40),
  icon text not null default '📦' check (length(icon) <= 16),
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  kind public.tx_type not null default 'expense',
  nature public.category_nature not null default 'variable',
  monthly_budget bigint check (monthly_budget >= 0),
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (household_id, id),
  unique nulls not distinct (household_id, parent_id, name),
  check (parent_id is distinct from id),
  foreign key (household_id, parent_id)
    references public.categories (household_id, id) on delete cascade
);
create trigger categories_audit before insert or update on public.categories
  for each row execute function public.set_audit_fields();

-- Subcategoria herda tipo e natureza da categoria pai; só um nível.
create function public.categories_inherit_parent() returns trigger
language plpgsql set search_path = '' as $$
declare
  parent record;
begin
  if new.parent_id is not null then
    select kind, nature, parent_id into parent
      from public.categories where id = new.parent_id;
    if parent.parent_id is not null then
      raise exception 'Só é permitido um nível de subcategoria' using errcode = '23514';
    end if;
    new.kind := parent.kind;
    new.nature := parent.nature;
  end if;
  return new;
end;
$$;
create trigger categories_inherit before insert or update on public.categories
  for each row execute function public.categories_inherit_parent();

create function public.categories_propagate_to_children() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind is distinct from old.kind or new.nature is distinct from old.nature then
    update public.categories
       set kind = new.kind, nature = new.nature
     where parent_id = new.id;
  end if;
  return null;
end;
$$;
create trigger categories_propagate after update on public.categories
  for each row when (old.parent_id is null)
  execute function public.categories_propagate_to_children();

-- ---------------------------------------------------------------------------
-- Recorrências (fixos, salários, financiamentos)
-- ---------------------------------------------------------------------------

create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  type public.tx_type not null,
  description text not null check (length(btrim(description)) between 1 and 120),
  amount bigint not null check (amount > 0),
  is_estimate boolean not null default false,
  category_id uuid not null,
  payment_method public.payment_method,
  account_id uuid,
  person_user_id uuid,
  frequency public.recurrence_frequency not null default 'monthly',
  day_of_month smallint check (day_of_month between 1 and 31),
  month_of_year smallint check (month_of_year between 1 and 12),
  weekday smallint check (weekday between 0 and 6),
  start_date date not null,
  end_date date,
  total_installments int check (total_installments > 0),
  -- primeiro dia a partir do qual o app gera previstos (evita criar
  -- lançamentos em meses anteriores ao cadastro)
  generate_from date not null default (date_trunc('month', current_date))::date,
  active boolean not null default true,
  notes text check (length(notes) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (household_id, id),
  check (end_date is null or end_date >= start_date),
  check (frequency <> 'weekly' or weekday is not null),
  check (frequency = 'weekly' or day_of_month is not null),
  check (frequency <> 'yearly' or month_of_year is not null),
  foreign key (household_id, category_id) references public.categories (household_id, id),
  foreign key (household_id, account_id)
    references public.accounts (household_id, id) on delete set null (account_id),
  foreign key (household_id, person_user_id)
    references public.household_members (household_id, user_id) on delete set null (person_user_id)
);
create trigger recurrences_audit before insert or update on public.recurrences
  for each row execute function public.set_audit_fields();

-- ---------------------------------------------------------------------------
-- Lançamentos
-- ---------------------------------------------------------------------------

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- competência: quando aconteceu / vai acontecer
  date date not null,
  -- caixa: quando o dinheiro sai/entra da conta (no cartão, o vencimento da fatura)
  cash_date date not null,
  description text not null check (length(btrim(description)) between 1 and 120),
  amount bigint not null check (amount > 0),
  type public.tx_type not null,
  category_id uuid not null,
  payment_method public.payment_method,
  account_id uuid,
  person_user_id uuid,
  status public.tx_status not null default 'done',
  notes text check (length(notes) <= 500),
  recurrence_id uuid,
  occurrence_date date,
  -- Fase 2: compras parceladas no cartão
  purchase_id uuid,
  installment_number int check (installment_number > 0),
  installment_total int check (installment_total > 0),
  -- Fase 3: importação de histórico
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (recurrence_id, occurrence_date),
  check (recurrence_id is null or occurrence_date is not null),
  check (installment_number is null or installment_number <= installment_total),
  foreign key (household_id, category_id) references public.categories (household_id, id),
  foreign key (household_id, account_id)
    references public.accounts (household_id, id) on delete set null (account_id),
  foreign key (household_id, person_user_id)
    references public.household_members (household_id, user_id) on delete set null (person_user_id),
  foreign key (household_id, recurrence_id)
    references public.recurrences (household_id, id) on delete set null (recurrence_id)
);
create index transactions_household_date_idx on public.transactions (household_id, date);
create index transactions_household_cash_date_idx on public.transactions (household_id, cash_date);
create index transactions_planned_idx on public.transactions (household_id, date)
  where status = 'planned';
create trigger transactions_audit before insert or update on public.transactions
  for each row execute function public.set_audit_fields();

-- cash_date padrão = date; categoria precisa ser do mesmo tipo do lançamento.
create function public.transactions_defaults() returns trigger
language plpgsql set search_path = '' as $$
declare
  category_kind public.tx_type;
begin
  if new.cash_date is null then
    new.cash_date := new.date;
  end if;
  -- Categoria invisível (outra casa) é barrada pela RLS/FK com o erro certo.
  select kind into category_kind from public.categories where id = new.category_id;
  if found and category_kind is distinct from new.type then
    raise exception 'A categoria não corresponde ao tipo do lançamento' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger transactions_defaults before insert or update on public.transactions
  for each row execute function public.transactions_defaults();

create function public.recurrences_check_category() returns trigger
language plpgsql set search_path = '' as $$
declare
  category_kind public.tx_type;
begin
  select kind into category_kind from public.categories where id = new.category_id;
  if found and category_kind is distinct from new.type then
    raise exception 'A categoria não corresponde ao tipo da recorrência' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger recurrences_check_category before insert or update on public.recurrences
  for each row execute function public.recurrences_check_category();
