-- Testes de isolamento entre casas (RLS). Rode com: npm run db:test
--
-- Cenário: A cria a "Casa A" e convida C; B tem a própria "Casa B" e tenta,
-- de todas as formas, ler ou alterar dados da Casa A.

begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.com'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.com'),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.com');

-- ---------------------------------------------------------------- usuário A
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000000","email":"a@teste.com","role":"authenticated"}', true);

select set_config('test.house_a', public.create_household('Casa A', 'A')::text, true);
select isnt(current_setting('test.house_a'), '', 'A cria a própria casa');

select is((select count(*)::int from public.categories), 15, 'casa nasce com 15 categorias padrão');
select is((select role::text from public.household_members), 'owner', 'A é dona da casa');

select lives_ok($$
  insert into public.transactions (household_id, date, cash_date, description, amount, type, category_id)
  select current_setting('test.house_a')::uuid, current_date, current_date, 'Mercado A', 12345, 'expense', id
    from public.categories where name = 'Alimentação/Mercado'
$$, 'A lança uma despesa');

select is((select created_by from public.transactions where description = 'Mercado A'),
  'aaaaaaaa-0000-0000-0000-000000000000'::uuid, 'created_by é preenchido com o usuário logado');

select throws_ok($$
  insert into public.transactions (household_id, date, cash_date, description, amount, type, category_id)
  select current_setting('test.house_a')::uuid, current_date, current_date, 'Errado', 100, 'income', id
    from public.categories where name = 'Alimentação/Mercado'
$$, '23514', null, 'categoria de despesa não serve para receita');

select throws_ok($$
  insert into public.transactions (household_id, date, cash_date, description, amount, type, category_id)
  select current_setting('test.house_a')::uuid, current_date, current_date, 'Negativo', -100, 'expense', id
    from public.categories where name = 'Outros'
$$, '23514', null, 'valor precisa ser positivo');

select lives_ok($$
  insert into public.household_invites (household_id, email, display_name)
  values (current_setting('test.house_a')::uuid, 'C@Teste.com', 'C')
$$, 'A convida C (e-mail sem diferenciar maiúsculas)');

select set_config('test.invite_token', (select token from public.household_invites), true);
select set_config('test.tx_a', (select id::text from public.transactions where description = 'Mercado A'), true);
select set_config('test.cat_a', (select id::text from public.categories where name = 'Outros'), true);

-- ---------------------------------------------------------------- usuário B
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000000","email":"b@teste.com","role":"authenticated"}', true);

select set_config('test.house_b', public.create_household('Casa B', 'B')::text, true);

select is((select count(*)::int from public.households), 1, 'B só vê a própria casa');
select is((select count(*)::int from public.transactions), 0, 'B não lê lançamentos da Casa A');
select is((select count(*)::int from public.categories where household_id = current_setting('test.house_a')::uuid),
  0, 'B não lê categorias da Casa A');
select is((select count(*)::int from public.household_members where household_id = current_setting('test.house_a')::uuid),
  0, 'B não lê membros da Casa A');
select is((select count(*)::int from public.household_invites), 0, 'B não lê convites da Casa A');
select is((select count(*)::int from public.accounts where household_id = current_setting('test.house_a')::uuid),
  0, 'B não lê contas da Casa A');

select throws_ok($$
  insert into public.transactions (household_id, date, cash_date, description, amount, type, category_id)
  values (current_setting('test.house_a')::uuid, current_date, current_date, 'Invasão', 100, 'expense',
          current_setting('test.cat_a')::uuid)
$$, '42501', null, 'B não insere lançamento na Casa A');

select throws_ok($$
  insert into public.categories (household_id, name) values (current_setting('test.house_a')::uuid, 'Invasão')
$$, '42501', null, 'B não cria categoria na Casa A');

select is_empty($$
  update public.transactions set amount = 1 where id = current_setting('test.tx_a')::uuid returning 1
$$, 'B não altera lançamento da Casa A');

select is_empty($$
  delete from public.transactions where id = current_setting('test.tx_a')::uuid returning 1
$$, 'B não exclui lançamento da Casa A');

select is_empty($$
  update public.households set name = 'Hackeada' where id = current_setting('test.house_a')::uuid returning 1
$$, 'B não altera a Casa A');

select throws_ok($$
  insert into public.transactions (household_id, date, cash_date, description, amount, type, category_id)
  values (current_setting('test.house_b')::uuid, current_date, current_date, 'Cat. alheia', 100, 'expense',
          current_setting('test.cat_a')::uuid)
$$, '23503', null, 'B não usa categoria da Casa A na própria casa');

select lives_ok($$
  insert into public.transactions (household_id, date, cash_date, description, amount, type, category_id)
  select current_setting('test.house_b')::uuid, current_date, current_date, 'Mercado B', 500, 'expense', id
    from public.categories where name = 'Outros'
$$, 'B lança na própria casa');

select throws_ok($$
  update public.transactions set household_id = current_setting('test.house_a')::uuid where description = 'Mercado B'
$$, '42501', null, 'B não move lançamento para a Casa A');

select throws_ok($$
  insert into public.household_members (household_id, user_id, display_name)
  values (current_setting('test.house_a')::uuid, 'bbbbbbbb-0000-0000-0000-000000000000', 'B')
$$, '42501', null, 'B não se adiciona como membro da Casa A');

select throws_ok($$
  insert into public.household_invites (household_id, email, invited_by)
  values (current_setting('test.house_a')::uuid, 'b@teste.com', 'bbbbbbbb-0000-0000-0000-000000000000')
$$, '42501', null, 'B não cria convite para a Casa A');

select throws_ok($$ select public.accept_invite(current_setting('test.invite_token'), 'B') $$,
  '42501', null, 'B não aceita convite feito para outro e-mail');

select is((select count(*)::int from public.my_pending_invites()), 0, 'B não vê convites de outros e-mails');

select throws_ok($$ select public.bootstrap_household('bbbbbbbb-0000-0000-0000-000000000000', 'X', 'X') $$,
  '42501', null, 'função interna bootstrap_household não é exposta');

-- ---------------------------------------------------------------- usuário C (convidado)
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000000","email":"c@teste.com","role":"authenticated"}', true);

select is((select household_name from public.my_pending_invites()), 'Casa A', 'C vê o convite pendente');
select is(public.accept_invite(current_setting('test.invite_token'), '')::text,
  current_setting('test.house_a'), 'C aceita o convite');
select is((select count(*)::int from public.transactions), 1, 'C passa a ver os lançamentos da Casa A');
select is((select display_name from public.household_members where user_id = 'cccccccc-0000-0000-0000-000000000000'),
  'C', 'nome de exibição vem do convite');

select results_eq($$
  update public.transactions set amount = 999 where id = current_setting('test.tx_a')::uuid returning updated_by
$$, $$ values ('cccccccc-0000-0000-0000-000000000000'::uuid) $$, 'C edita e fica registrado como último editor');

select throws_ok($$
  update public.household_members set role = 'owner' where user_id = 'cccccccc-0000-0000-0000-000000000000'
$$, '42501', null, 'C não promove o próprio papel');

select throws_ok($$ select public.accept_invite(current_setting('test.invite_token'), 'C') $$,
  'P0002', null, 'convite não pode ser reutilizado');

-- ---------------------------------------------------------------- anônimo
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select count(*) from public.transactions $$, '42501', null,
  'anônimo não acessa lançamentos');

select * from finish();
rollback;
