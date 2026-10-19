-- Row Level Security e funções de casa/convite.
--
-- Regra geral: um usuário só enxerga e altera dados das casas das quais é
-- membro. Entrar numa casa (criar ou aceitar convite) só acontece por RPCs
-- security definer; ninguém insere direto em household_members.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Casas do usuário logado. security definer evita recursão nas políticas de
-- household_members.
create function public.my_household_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select household_id from public.household_members where user_id = (select auth.uid())
$$;

create function public.is_household_member(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
     where household_id = hid and user_id = (select auth.uid())
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.recurrences enable row level security;
alter table public.transactions enable row level security;

-- households: membros leem e editam (nome, meta de poupança); criar só via RPC.
create policy "membros leem a casa" on public.households
  for select to authenticated using (id in (select public.my_household_ids()));
create policy "membros editam a casa" on public.households
  for update to authenticated
  using (id in (select public.my_household_ids()))
  with check (id in (select public.my_household_ids()));

-- household_members: membros veem os demais membros; cada um edita só as
-- próprias preferências (colunas liberadas abaixo).
create policy "membros veem membros" on public.household_members
  for select to authenticated using (household_id in (select public.my_household_ids()));
create policy "cada um edita o próprio perfil" on public.household_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.household_members from anon, authenticated;
grant update (display_name, last_payment_method, last_account_id)
  on public.household_members to authenticated;

-- household_invites: membros gerenciam os convites da casa.
create policy "membros veem convites" on public.household_invites
  for select to authenticated using (household_id in (select public.my_household_ids()));
create policy "membros criam convites" on public.household_invites
  for insert to authenticated
  with check (household_id in (select public.my_household_ids()) and invited_by = (select auth.uid()));
create policy "membros excluem convites" on public.household_invites
  for delete to authenticated using (household_id in (select public.my_household_ids()));
revoke update on public.household_invites from anon, authenticated;

-- Tabelas financeiras: acesso total para membros da casa.
do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'categories', 'recurrences', 'transactions'] loop
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
revoke all on public.households, public.household_members, public.household_invites from anon;

-- ---------------------------------------------------------------------------
-- Categorias padrão
-- ---------------------------------------------------------------------------

create function public.create_default_categories(hid uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.categories (household_id, name, icon, color, kind, nature, sort_order)
  values
    (hid, 'Moradia',               '🏠', '#6366f1', 'expense', 'fixed',     10),
    (hid, 'Alimentação/Mercado',   '🛒', '#22c55e', 'expense', 'variable',  20),
    (hid, 'Restaurantes',          '🍽️', '#f97316', 'expense', 'variable',  30),
    (hid, 'Transporte/Combustível','⛽', '#0ea5e9', 'expense', 'variable',  40),
    (hid, 'Saúde',                 '💊', '#ef4444', 'expense', 'variable',  50),
    (hid, 'Educação',              '🎓', '#8b5cf6', 'expense', 'fixed',     60),
    (hid, 'Lazer',                 '🎉', '#ec4899', 'expense', 'variable',  70),
    (hid, 'Compras',               '🛍️', '#eab308', 'expense', 'variable',  80),
    (hid, 'Assinaturas',           '📺', '#14b8a6', 'expense', 'fixed',     90),
    (hid, 'Financiamentos',        '🏦', '#64748b', 'expense', 'fixed',    100),
    (hid, 'Impostos/Taxas',        '🧾', '#a855f7', 'expense', 'fixed',    110),
    (hid, 'Outros',                '📦', '#94a3b8', 'expense', 'variable', 120),
    (hid, 'Salário',               '💼', '#16a34a', 'income',  'fixed',     10),
    (hid, 'Extras',                '✨', '#84cc16', 'income',  'variable',  20),
    (hid, 'Outras receitas',       '💰', '#10b981', 'income',  'variable',  30);
$$;
revoke execute on function public.create_default_categories(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Criar casa
-- ---------------------------------------------------------------------------

-- Uso interno (seed e RPC): cria a casa com o usuário como dono.
create function public.bootstrap_household(p_user uuid, p_name text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  hid uuid;
begin
  insert into public.households (name, created_by)
  values (btrim(p_name), p_user)
  returning id into hid;

  insert into public.household_members (household_id, user_id, role, display_name)
  values (hid, p_user, 'owner', btrim(p_display_name));

  perform public.create_default_categories(hid);

  insert into public.accounts (household_id, name, kind, owner_user_id, created_by, updated_by)
  values (hid, 'Conta principal', 'checking', null, p_user, p_user);

  return hid;
end;
$$;
revoke execute on function public.bootstrap_household(uuid, text, text) from public, anon, authenticated;

create function public.create_household(p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado' using errcode = '42501';
  end if;
  return public.bootstrap_household(auth.uid(), p_name, p_display_name);
end;
$$;
revoke execute on function public.create_household(text, text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Convites
-- ---------------------------------------------------------------------------

-- Convites pendentes para o e-mail do usuário logado, com o nome da casa
-- (que ele ainda não pode ler via RLS).
create function public.my_pending_invites()
returns table (token text, household_id uuid, household_name text, invited_by_name text, display_name text)
language sql stable security definer set search_path = '' as $$
  select i.token, h.id, h.name, m.display_name, i.display_name
    from public.household_invites i
    join public.households h on h.id = i.household_id
    left join public.household_members m
      on m.household_id = i.household_id and m.user_id = i.invited_by
   where i.email = lower((select auth.jwt() ->> 'email'))
     and i.accepted_at is null
     and i.expires_at > now()
     and not exists (
       select 1 from public.household_members x
        where x.household_id = i.household_id and x.user_id = (select auth.uid())
     )
$$;
revoke execute on function public.my_pending_invites() from public, anon;
grant execute on function public.my_pending_invites() to authenticated;

-- Aceita o convite: exige token válido E e-mail do usuário igual ao convidado.
create function public.accept_invite(p_token text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  inv public.household_invites;
  user_email text := auth.jwt() ->> 'email';
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado' using errcode = '42501';
  end if;

  select * into inv from public.household_invites where token = p_token for update;
  if not found or inv.accepted_at is not null or inv.expires_at <= now() then
    raise exception 'Convite inválido ou expirado' using errcode = 'P0002';
  end if;
  if user_email is null or inv.email <> lower(user_email) then
    raise exception 'Este convite é para outro e-mail' using errcode = '42501';
  end if;

  insert into public.household_members (household_id, user_id, role, display_name)
  values (
    inv.household_id, auth.uid(), 'member',
    coalesce(nullif(btrim(p_display_name), ''), inv.display_name, split_part(user_email, '@', 1))
  )
  on conflict (household_id, user_id) do nothing;

  update public.household_invites
     set accepted_at = now(), accepted_by = auth.uid()
   where id = inv.id;

  return inv.household_id;
end;
$$;
revoke execute on function public.accept_invite(text, text) from public, anon;
grant execute on function public.accept_invite(text, text) to authenticated;

revoke execute on function public.my_household_ids() from public, anon;
grant execute on function public.my_household_ids() to authenticated;
revoke execute on function public.is_household_member(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: lançamentos aparecem para o outro sem recarregar
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.transactions;
