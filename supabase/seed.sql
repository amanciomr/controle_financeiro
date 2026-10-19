-- Seed de desenvolvimento local (NUNCA rodar em produção).
--
-- Cria Rafael e Ana (login por e-mail no Mailpit local: http://127.0.0.1:54324),
-- a "Casa Amâncio" e um mês de dados fictícios relativos à data de hoje,
-- para que a tela Hoje sempre tenha algo para mostrar.
--
--   rafael@exemplo.com  /  ana@exemplo.com

do $$
declare
  rafael uuid := '10000000-0000-0000-0000-000000000001';
  ana uuid := '10000000-0000-0000-0000-000000000002';
  hid uuid;
  conta uuid;
  today date := (now() at time zone 'America/Bahia')::date;
  m0 date := date_trunc('month', (now() at time zone 'America/Bahia'))::date;
  last_day int := extract(day from (m0 + interval '1 month - 1 day'))::int;
  d int;
  day date;
  cat jsonb := '{}';
  r record;
begin
  -- Usuários -----------------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
         extensions.crypt('senha-local', extensions.gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    from (values (rafael, 'rafael@exemplo.com'), (ana, 'ana@exemplo.com')) as u(id, email);

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
    from (values (rafael, 'rafael@exemplo.com'), (ana, 'ana@exemplo.com')) as u(id, email);

  -- Casa ---------------------------------------------------------------------
  hid := public.bootstrap_household(rafael, 'Casa Amâncio', 'Rafael');
  insert into public.household_members (household_id, user_id, role, display_name)
  values (hid, ana, 'member', 'Ana');

  update public.households set savings_goal_mode = 'percent', savings_goal_value = 1000 where id = hid;

  select id into conta from public.accounts where household_id = hid;
  update public.accounts
     set name = 'Conta conjunta', opening_balance = 350000, opening_date = m0 - interval '1 month'
   where id = conta;

  select jsonb_object_agg(name, id) into cat from public.categories where household_id = hid;

  -- Recorrências -------------------------------------------------------------
  insert into public.recurrences (
    household_id, type, description, amount, is_estimate, category_id, payment_method,
    account_id, person_user_id, frequency, day_of_month, start_date, total_installments,
    generate_from, created_by
  ) values
    (hid, 'income',  'Salário Rafael',      850000, false, (cat->>'Salário')::uuid,        'transfer',   conta, rafael, 'monthly',  5, m0 - interval '1 year', null, m0, rafael),
    (hid, 'income',  'Salário Ana',         620000, false, (cat->>'Salário')::uuid,        'transfer',   conta, ana,    'monthly', 20, m0 - interval '1 year', null, m0, ana),
    (hid, 'expense', 'Aluguel',             280000, false, (cat->>'Moradia')::uuid,        'boleto',     conta, null,   'monthly', 10, m0 - interval '1 year', null, m0, rafael),
    (hid, 'expense', 'Condomínio',           65000, false, (cat->>'Moradia')::uuid,        'boleto',     conta, null,   'monthly', 10, m0 - interval '1 year', null, m0, rafael),
    (hid, 'expense', 'Energia (Coelba)',     28000, true,  (cat->>'Moradia')::uuid,        'auto_debit', conta, null,   'monthly', 25, m0 - interval '1 year', null, m0, ana),
    (hid, 'expense', 'Internet',             11990, false, (cat->>'Assinaturas')::uuid,    'auto_debit', conta, null,   'monthly', 12, m0 - interval '1 year', null, m0, ana),
    (hid, 'expense', 'Streaming',             5590, false, (cat->>'Assinaturas')::uuid,    'credit_card',null,  null,   'monthly',  8, m0 - interval '1 year', null, m0, ana),
    (hid, 'expense', 'Curso de inglês',      45000, false, (cat->>'Educação')::uuid,       'pix',        conta, ana,    'monthly',  5, m0 - interval '6 months', null, m0, ana),
    (hid, 'expense', 'Financiamento do carro',120000,false,(cat->>'Financiamentos')::uuid, 'boleto',     conta, rafael, 'monthly', 15, (m0 - interval '20 months')::date, 48, m0, rafael);

  -- Ocorrências do mês corrente (o app faz isso sozinho; aqui adiantamos)
  for r in select * from public.recurrences where household_id = hid loop
    day := make_date(extract(year from m0)::int, extract(month from m0)::int, least(r.day_of_month, last_day));
    insert into public.transactions (
      household_id, date, cash_date, description, amount, type, category_id, payment_method,
      account_id, person_user_id, status, recurrence_id, occurrence_date, created_by
    ) values (
      hid, day, day, r.description, r.amount, r.type, r.category_id, r.payment_method,
      r.account_id, r.person_user_id,
      -- deixa o condomínio vencido sem confirmar, para aparecer em "aguardando confirmação"
      case when day < today and r.description <> 'Condomínio' then 'done' else 'planned' end::public.tx_status,
      r.id, day, r.created_by
    );
  end loop;

  -- Gastos variáveis do dia 1 até hoje -------------------------------------
  for d in 1 .. extract(day from today)::int loop
    day := m0 + (d - 1);
    -- padaria quase todo dia
    if d % 3 <> 0 then
      insert into public.transactions (household_id, date, cash_date, description, amount, type, category_id, payment_method, person_user_id, created_by)
      values (hid, day, day, 'Padaria', 900 + (d * 137) % 1500, 'expense', (cat->>'Alimentação/Mercado')::uuid, 'pix',
              case when d % 2 = 0 then rafael else ana end, case when d % 2 = 0 then rafael else ana end);
    end if;
    -- mercado uma vez por semana
    if d % 7 = 2 then
      insert into public.transactions (household_id, date, cash_date, description, amount, type, category_id, payment_method, created_by)
      values (hid, day, day, 'Mercado', 32000 + (d * 911) % 9000, 'expense', (cat->>'Alimentação/Mercado')::uuid, 'debit', ana);
    end if;
    -- restaurante
    if d % 5 = 4 then
      insert into public.transactions (household_id, date, cash_date, description, amount, type, category_id, payment_method, person_user_id, created_by)
      values (hid, day, day, 'Restaurante', 8500 + (d * 523) % 6000, 'expense', (cat->>'Restaurantes')::uuid, 'credit_card', null, rafael);
    end if;
    -- combustível
    if d % 10 = 3 then
      insert into public.transactions (household_id, date, cash_date, description, amount, type, category_id, payment_method, person_user_id, created_by)
      values (hid, day, day, 'Posto', 22000, 'expense', (cat->>'Transporte/Combustível')::uuid, 'credit_card', rafael, rafael);
    end if;
    -- uber, farmácia, lazer de vez em quando
    if d % 6 = 1 then
      insert into public.transactions (household_id, date, cash_date, description, amount, type, category_id, payment_method, person_user_id, created_by)
      values (hid, day, day, 'Uber', 1800 + (d * 71) % 2500, 'expense', (cat->>'Transporte/Combustível')::uuid, 'credit_card', ana, ana);
    end if;
    if d = 9 then
      insert into public.transactions (household_id, date, cash_date, description, amount, type, category_id, payment_method, person_user_id, created_by)
      values (hid, day, day, 'Farmácia', 6790, 'expense', (cat->>'Saúde')::uuid, 'debit', ana, ana);
    end if;
    if d % 9 = 6 then
      insert into public.transactions (household_id, date, cash_date, description, amount, type, category_id, payment_method, created_by, notes)
      values (hid, day, day, 'Cinema', 9600, 'expense', (cat->>'Lazer')::uuid, 'credit_card', ana, 'Pipoca inclusa');
    end if;
  end loop;

  -- Um extra recebido e um boleto agendado para o fim do mês
  insert into public.transactions (household_id, date, cash_date, description, amount, type, category_id, payment_method, person_user_id, status, created_by)
  values
    (hid, m0 + 1, m0 + 1, 'Freela de design', 90000, 'income', (cat->>'Extras')::uuid, 'pix', ana, 'done', ana),
    (hid, m0 + (last_day - 3), m0 + (last_day - 3), 'IPVA (parcela)', 38000, 'expense', (cat->>'Impostos/Taxas')::uuid, 'boleto', rafael, 'planned', rafael);
end;
$$;
