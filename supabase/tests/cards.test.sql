-- Testes das compras no cartão: RPC atômica, validações e isolamento entre casas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.com'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.com');

set local role authenticated;

-- A cria a casa e um cartão
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000000","email":"a@teste.com","role":"authenticated"}', true);
select set_config('test.house_a', public.create_household('Casa A', 'A')::text, true);
insert into public.accounts (household_id, name, kind, closing_day, due_day, credit_limit)
values (current_setting('test.house_a')::uuid, 'Nubank', 'credit_card', 3, 10, 500000);
select set_config('test.card', (select id::text from public.accounts where kind = 'credit_card'), true);
select set_config('test.checking', (select id::text from public.accounts where kind = 'checking'), true);
select set_config('test.cat', (select id::text from public.categories where name = 'Compras'), true);
select set_config('test.income_cat', (select id::text from public.categories where name = 'Salário'), true);

select lives_ok($$
  select public.save_card_purchase(
    jsonb_build_object('household_id', current_setting('test.house_a'), 'account_id', current_setting('test.card'),
      'purchase_date', '2026-10-20', 'description', 'Geladeira', 'total_amount', 300000, 'installments', 3,
      'category_id', current_setting('test.cat')),
    '[{"number":1,"total":3,"amount":100000,"date":"2026-10-20","cash_date":"2026-11-10"},
      {"number":2,"total":3,"amount":100000,"date":"2026-11-20","cash_date":"2026-12-10"},
      {"number":3,"total":3,"amount":100000,"date":"2026-12-20","cash_date":"2027-01-10"}]'::jsonb)
$$, 'A salva uma compra parcelada em 3x');

select is((select count(*)::int from public.transactions where purchase_id is not null), 3, 'gera 3 parcelas');
select is((select string_agg(cash_date::text, ',' order by installment_number) from public.transactions),
  '2026-11-10,2026-12-10,2027-01-10', 'cada parcela com o vencimento da sua fatura');
select is((select bool_and(payment_method = 'credit_card' and status = 'done') from public.transactions),
  true, 'parcelas são crédito e realizadas');

select set_config('test.purchase', (select id::text from public.card_purchases), true);

select lives_ok($$
  select public.save_card_purchase(
    jsonb_build_object('id', current_setting('test.purchase'), 'household_id', current_setting('test.house_a'),
      'account_id', current_setting('test.card'), 'purchase_date', '2026-10-20', 'description', 'Geladeira',
      'total_amount', 300000, 'installments', 2, 'category_id', current_setting('test.cat')),
    '[{"number":1,"total":2,"amount":150000,"date":"2026-10-20","cash_date":"2026-11-10"},
      {"number":2,"total":2,"amount":150000,"date":"2026-11-20","cash_date":"2026-12-10"}]'::jsonb)
$$, 'editar a compra refaz as parcelas');
select is((select count(*)::int from public.transactions where purchase_id is not null), 2, 'agora são 2 parcelas');

select throws_ok($$
  select public.save_card_purchase(
    jsonb_build_object('household_id', current_setting('test.house_a'), 'account_id', current_setting('test.card'),
      'purchase_date', '2026-10-20', 'description', 'Errada', 'total_amount', 1000, 'installments', 2,
      'category_id', current_setting('test.cat')),
    '[{"number":1,"total":2,"amount":500,"date":"2026-10-20","cash_date":"2026-11-10"}]'::jsonb)
$$, '23514', null, 'parcelas que não somam o total são rejeitadas (e nada é gravado)');
select is((select count(*)::int from public.card_purchases), 1, 'a compra inválida não ficou gravada');

select throws_ok($$
  select public.save_card_purchase(
    jsonb_build_object('household_id', current_setting('test.house_a'), 'account_id', current_setting('test.checking'),
      'purchase_date', '2026-10-20', 'description', 'Conta corrente', 'total_amount', 1000, 'installments', 1,
      'category_id', current_setting('test.cat')),
    '[{"number":1,"total":1,"amount":1000,"date":"2026-10-20","cash_date":"2026-10-20"}]'::jsonb)
$$, '23514', null, 'compra no cartão exige conta do tipo cartão');

select throws_ok($$
  select public.save_card_purchase(
    jsonb_build_object('household_id', current_setting('test.house_a'), 'account_id', current_setting('test.card'),
      'purchase_date', '2026-10-20', 'description', 'Receita?', 'total_amount', 1000, 'installments', 1,
      'category_id', current_setting('test.income_cat')),
    '[{"number":1,"total":1,"amount":1000,"date":"2026-10-20","cash_date":"2026-11-10"}]'::jsonb)
$$, '23514', null, 'compra no cartão exige categoria de despesa');

select lives_ok($$
  insert into public.card_statement_payments (household_id, account_id, due_month, amount)
  values (current_setting('test.house_a')::uuid, current_setting('test.card')::uuid, '2026-11-01', 150000)
$$, 'A marca a fatura de novembro como paga');

-- B, de outra casa
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000000","email":"b@teste.com","role":"authenticated"}', true);
select public.create_household('Casa B', 'B');

select is((select count(*)::int from public.card_purchases) + (select count(*)::int from public.card_statement_payments),
  0, 'B não lê compras nem faturas pagas da Casa A');

select throws_ok($$
  select public.save_card_purchase(
    jsonb_build_object('id', current_setting('test.purchase'), 'household_id', current_setting('test.house_a'),
      'account_id', current_setting('test.card'), 'purchase_date', '2026-10-20', 'description', 'Invasão',
      'total_amount', 1, 'installments', 1, 'category_id', current_setting('test.cat')),
    '[{"number":1,"total":1,"amount":1,"date":"2026-10-20","cash_date":"2026-11-10"}]'::jsonb)
$$, null, null, 'B não altera a compra da Casa A pela RPC');

select throws_ok($$
  insert into public.card_statement_payments (household_id, account_id, due_month)
  values (current_setting('test.house_a')::uuid, current_setting('test.card')::uuid, '2026-12-01')
$$, '42501', null, 'B não marca fatura da Casa A como paga');

select * from finish();
rollback;
