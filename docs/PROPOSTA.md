# Proposta de arquitetura e modelo de dados

> Status: **aguardando aprovação**. Nenhum código de aplicação foi escrito ainda.
> As decisões marcadas com **[D#]** estão detalhadas na seção "Decisões em aberto", cada uma com um padrão recomendado.

---

## 1. Visão geral

```
┌──────────────── Celular (PWA) ────────────────┐
│ Next.js App Router (React Server Components)  │
│  • páginas renderizadas no servidor (Vercel)  │
│  • Server Actions para gravar                 │
│  • componentes client: lançamento rápido,     │
│    gráficos (Recharts), assinatura Realtime   │
└───────────────┬───────────────────────────────┘
                │ @supabase/ssr (cookies)
┌───────────────▼───────────────────────────────┐
│ Supabase                                      │
│  • Auth: e-mail (magic link + código OTP) [D1]│
│  • Postgres com RLS por casa                  │
│  • Realtime em `transactions`                 │
│  • RPCs security definer: criar casa,         │
│    aceitar convite, materializar recorrências │
└───────────────────────────────────────────────┘
```

Princípios:

1. **Lógica de cálculo isolada em `src/lib/domain/`**: funções puras em TypeScript, sem dependência de Supabase/React, recebendo dados já carregados e devolvendo resultados. É aí que ficam meta diária, forecast, tabela diária, geração de recorrências, atribuição de fatura e geração de parcelas. Tudo testado com Vitest.
2. **Datas como `YYYY-MM-DD` (tipo `date` no Postgres)**: lançamento não tem hora. "Hoje" é sempre calculado no fuso da casa (`America/Bahia`, UTC−3 sem horário de verão), nunca no fuso do servidor da Vercel (UTC). Uma única função `today(tz)` faz isso.
3. **Dinheiro em centavos (`bigint`) com valor sempre positivo**; o sinal vem do `type` (receita/despesa). Formatação via `Intl.NumberFormat('pt-BR', { currency: 'BRL' })`. Entrada de valor no estilo "caixa eletrônico" (digitar `1234` → R$ 12,34), sem float em nenhum momento.
4. **Banco é a fonte de verdade da segurança**: RLS em todas as tabelas, FKs compostas `(household_id, id)` para impedir que um lançamento aponte para categoria/conta de outra casa, triggers para `created_by/updated_by/updated_at`.
5. **Simples primeiro**: sem state manager, sem ORM. Consultas com `supabase-js` tipado (tipos gerados pelo `supabase gen types`), validação de formulários com Zod.

## 2. Stack e versões

| Item | Escolha |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript strict |
| Estilo | Tailwind CSS 4, modo escuro por `prefers-color-scheme` + alternância manual |
| Auth/DB | Supabase (`@supabase/ssr`, `@supabase/supabase-js` 2.x) |
| Validação | Zod |
| Gráficos | Recharts (Fase 2) |
| Testes de domínio | Vitest |
| Testes de RLS | pgTAP via `supabase test db` (Supabase CLI local em Docker) |
| CI | GitHub Actions: lint + typecheck + Vitest + pgTAP |
| Deploy | Vercel (conectada ao GitHub) [D10] |
| PWA | `app/manifest.ts` + ícones + service worker mínimo (cache do shell) |

## 3. Estrutura de pastas

```
src/
  app/
    (auth)/entrar/            login (e-mail → link/código)
    auth/confirm/route.ts     callback do magic link
    (app)/                    layout com navegação inferior + botão "+"
      page.tsx                Hoje
      mes/[ano-mes]/          Mês (tabela diária + forecast)
      lancamentos/            lista, filtros, edição
      recorrentes/
      cartoes/                (Fase 2)
      categorias/
      configuracoes/          casa, membros, convite, meta de poupança, contas
    convite/[token]/          aceitar convite
    manifest.ts
  components/                 UI (bottom sheet de lançamento, MoneyInput, etc.)
  lib/
    domain/                   ⟵ funções puras + *.test.ts
      money.ts                parse/format de centavos
      dates.ts                today(tz), daysInMonth, addMonthsClamped, ...
      recurrence.ts           ocorrências de uma recorrência num intervalo
      budget.ts               receita, comprometido, disponível, metas
      forecast.ts             rolling forecast (2 cenários) + semáforo
      daily-table.ts          linhas da tabela diária
      card-statement.ts       (F2) fatura de uma compra
      installments.ts         (F2) geração de parcelas
    supabase/                 clientes server/browser + middleware
    data/                     consultas (carregam dados e chamam o domínio)
  actions/                    Server Actions (criar/editar/confirmar)
supabase/
  migrations/                 SQL versionado
  seed.sql                    casa de exemplo com 1 mês de dados
  tests/                      pgTAP (RLS)
```

## 4. Modelo de dados

Convenções: toda tabela financeira tem `household_id`; `id uuid default gen_random_uuid()`; `created_at/created_by/updated_at/updated_by` preenchidos por trigger (é o "histórico simples"). Pessoa = `user_id` de um membro; `null` = **casa/compartilhado**.

### Casa e membros

```sql
households (
  id, name,
  timezone text default 'America/Bahia',
  savings_goal_mode text check (in ('amount','percent')),   -- [D7]
  savings_goal_value bigint,          -- centavos, ou basis points (1000 = 10%)
  created_at, created_by
)

household_members (
  household_id, user_id → auth.users,
  role text check (in ('owner','member')),
  display_name text,                  -- "Marcos", "Fulana"
  last_payment_method text,           -- lembra a última forma usada [tela 2]
  last_account_id uuid,
  primary key (household_id, user_id)
)

household_invites (
  id, household_id, email citext, token text unique,
  invited_by, created_at, expires_at, accepted_at, accepted_by
)
```

- Criar casa e aceitar convite são RPCs `security definer` (o usuário não insere diretamente em `household_members`).
- Limite de membros: não vou travar em 2 no banco, só na UI (fácil mudar depois).

### Contas e cartões (uma tabela só)

```sql
accounts (
  id, household_id,
  name text,
  kind text check (in ('checking','savings','cash','credit_card')),
  owner_user_id uuid null,            -- titular (visível para os dois)
  opening_balance bigint default 0,   -- saldo em opening_date [D6]
  opening_date date,
  -- só para credit_card (Fase 2), garantidos por CHECK:
  closing_day smallint, due_day smallint,
  credit_limit bigint, payment_account_id uuid,  -- conta que paga a fatura
  archived boolean default false
)
```

Uma tabela para "conta/cartão" simplifica o campo do lançamento e os filtros. Os campos de cartão já existem desde a Fase 1, mas a lógica de fatura só entra na Fase 2.

### Categorias

```sql
categories (
  id, household_id,
  parent_id uuid null,                -- 1 nível de subcategoria
  name, icon text, color text,
  kind text check (in ('expense','income')),
  nature text check (in ('fixed','variable')),   -- alimenta o forecast
  monthly_budget bigint null,         -- Fase 3
  sort_order int, archived boolean
)
```

Subcategoria herda `kind` e `nature` da pai (validado por trigger). Categorias padrão são criadas pela RPC `create_household`. Além das 12 de despesa da especificação, crio receitas: Salário, Extras, Outros (receita).

### Recorrências

```sql
recurrences (
  id, household_id,
  type text check (in ('income','expense')),
  description, amount bigint,         -- valor (estimado, se is_estimate)
  is_estimate boolean default false,  -- contas de consumo
  category_id, payment_method, account_id, person_user_id,
  frequency text check (in ('monthly','yearly','weekly')),
  day_of_month smallint,              -- monthly/yearly; 31 em fev → último dia
  month_of_year smallint,             -- yearly
  weekday smallint,                   -- weekly (0=domingo)
  start_date date, end_date date null,
  total_installments int null,        -- financiamento: nº total de parcelas
  active boolean default true
)
```

- **Financiamento**: `total_installments` + `start_date` ⇒ a função pura calcula a parcela atual ("23/48") e quantas restam; não guardo contador que pode dessincronizar.
- **Materialização [D11]**: ao abrir Hoje/Mês, o servidor chama `ensureRecurrences(mês)` — a função pura calcula as ocorrências e o servidor insere `transactions` com status `planned` usando `on conflict (recurrence_id, occurrence_date) do nothing` (idempotente, seguro com os dois abrindo o app ao mesmo tempo).
- Editar a recorrência atualiza só os previstos futuros ainda não confirmados.
- Excluir um previsto gerado o marca como `skipped` (não é recriado).

### Lançamentos

```sql
transactions (
  id, household_id,
  date date,                          -- competência (data da compra/fato)
  cash_date date,                     -- caixa: = date, exceto cartão (vencimento da fatura) — Fase 2
  description text,
  amount bigint check (amount > 0),
  type text check (in ('income','expense')),
  category_id, payment_method, account_id,
  person_user_id uuid null,           -- de quem é (null = casa)
  status text check (in ('planned','done','skipped')),
  notes text null,
  -- origem
  recurrence_id uuid null, occurrence_date date null,
  purchase_id uuid null, installment_number int, installment_total int,   -- Fase 2
  import_batch_id uuid null,                                              -- Fase 3
  -- auditoria
  created_at, created_by, updated_at, updated_by,
  unique (recurrence_id, occurrence_date)
)
-- índices: (household_id, date), (household_id, cash_date), (household_id, status)
```

`payment_method` é enum: `credit_card, pix, debit, cash, boleto, transfer, auto_debit`.

### Fase 2 (já previsto no modelo, criado depois)

```sql
card_purchases (id, household_id, account_id /*cartão*/, purchase_date, description,
                total_amount, installments, category_id, person_user_id, ...)
-- gera N transactions com purchase_id, installment_number e cash_date = vencimento da fatura
card_statements (account_id, reference_month, closing_date, due_date,
                 status ('open','closed','paid'), paid_at, paid_transaction_id)
```

A fatura de cada compra é **calculada** pela função pura `statementFor(date, closingDay, dueDay)`; `card_statements` só guarda o estado (paga/fechada) e o lançamento de pagamento.

### Fase 3

`import_batches (id, household_id, file_name, row_count, created_by, created_at, undone_at)` e a sugestão de categoria é uma consulta sobre o histórico da própria casa (descrição normalizada → categoria mais frequente), sem tabela extra.

## 5. Segurança (RLS)

```sql
create function is_member(hid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.household_members
                 where household_id = hid and user_id = auth.uid()) $$;

-- em cada tabela financeira:
create policy "membros leem"    on X for select using (is_member(household_id));
create policy "membros inserem" on X for insert with check (is_member(household_id));
create policy "membros editam"  on X for update using (is_member(household_id))
                                             with check (is_member(household_id));
create policy "membros excluem" on X for delete using (is_member(household_id));
```

- `household_members`: só leitura para membros; escrita apenas via RPC.
- `household_invites`: membros da casa leem/criam; o convidado lê o próprio convite pelo e-mail do JWT.
- FKs compostas `(household_id, category_id) → categories(household_id, id)` impedem referências cruzadas mesmo que alguém forje um `category_id` de outra casa.
- Realtime respeita RLS automaticamente.
- **Testes pgTAP**: dois usuários em casas diferentes; verifica que B não lê, não insere, não altera e não exclui nada da casa de A (incluindo tentar mover um lançamento para a própria casa e usar categoria da outra casa), e que não consegue se auto-adicionar como membro.

## 6. Regras de cálculo (Fase 1)

Para o mês `M`, hoje `t`, `N` = dias do mês, `r` = dias restantes incluindo hoje. Considero só lançamentos com status `planned` ou `done` (nunca `skipped`).

| Grandeza | Definição |
|---|---|
| Receita prevista | Σ receitas do mês (realizadas + previstas) |
| Comprometido | Σ despesas de categorias **fixas** (realizadas + previstas) + Σ despesas **previstas** de categorias variáveis (ex.: um boleto agendado) + (F2) parcelas ≥ 2 de cartão que caem no mês [D2] |
| Meta de poupança | valor fixo ou % da receita prevista |
| Disponível p/ variáveis (D) | receita prevista − comprometido − meta de poupança |
| Meta diária inicial | D ÷ N |
| Gasto variável realizado | Σ despesas `done` de categorias variáveis (excluindo parcelas ≥ 2) |
| Meta dinâmica de hoje | (D − variável realizado **até ontem**) ÷ r [D3] |
| Pode gastar hoje | meta dinâmica de hoje − variável realizado hoje |

**Forecast de fechamento** = receita prevista − comprometido − variável realizado − projeção dos dias restantes:

- Cenário A (ritmo atual): média diária de variável dos dias já decorridos × dias restantes [D14]
- Cenário B (cumprindo a meta): meta dinâmica × dias restantes ⇒ por construção termina exatamente na meta de poupança (se D ≥ 0)
- Semáforo sobre o cenário A [D13]: 🟢 poupança projetada ≥ meta; 🟡 entre 0 e a meta; 🔴 negativa.

**Tabela diária**: para cada dia `d` — meta do dia (dinâmica para hoje/futuro, a meta que vigorava naquele dia para o passado), realizado (variáveis), diferença, acumulados previsto/realizado, desvio acumulado e **saldo projetado das contas** (saldo de abertura + todos os fluxos de caixa até `d`, com dias futuros incluindo fixos/parcelas agendados e a meta diária como gasto projetado) [D6].

Arredondamento: divisões em centavos usam `Math.floor` e o resto é distribuído nos primeiros dias, para que a soma das metas diárias feche exatamente com D.

## 7. Telas e navegação (mobile-first, 380px)

- **Barra inferior**: Hoje · Mês · Lançamentos · Mais (Recorrentes, Cartões, Categorias, Configurações).
- **Botão "+" flutuante** em todas as telas abre um *bottom sheet*: teclado numérico já focado no valor → descrição → chips de categoria (as mais usadas primeiro; sugestão automática na Fase 3) → forma de pagamento (pré-selecionada com a última do usuário) → Salvar. Pessoa = quem está logado e data = hoje, editáveis em "mais opções". Despesa é o padrão; um toque alterna para receita.
- **Hoje**: número grande "Pode gastar hoje", gasto do dia, meta dinâmica, card de forecast com semáforo, próximos vencimentos (7 dias), previstos aguardando confirmação (botão ✓ com ajuste de valor), últimos lançamentos dos dois.
- **Realtime**: assinatura em `transactions` filtrada pela casa → `router.refresh()`; também refaz a consulta quando a aba volta ao foco.

## 8. Plano de entrega da Fase 1 (commits pequenos)

1. Scaffold Next.js + TS + Tailwind + ESLint + Vitest + CI
2. `domain/money` e `domain/dates` + testes (28/29/31 dias, último dia do mês, virada de ano)
3. `domain/recurrence` + testes (dia 31, 29/02 anual, semanal, financiamento)
4. `domain/budget`, `forecast`, `daily-table` + testes
5. Migrações: schema, triggers, RLS, RPCs + testes pgTAP + seed
6. Auth (link + código), middleware, onboarding "criar casa", convite
7. Lançamento rápido + lista de lançamentos (busca, filtros básicos, edição, exclusão)
8. Recorrentes (CRUD, materialização, confirmar previsto em 1 toque)
9. Tela Hoje + Realtime
10. Tela Mês (tabela diária, resumo, forecast, navegação entre meses)
11. Configurações (casa, membros, convite, meta de poupança, contas)
12. PWA (manifest, ícones, SW), modo escuro, polimento
13. README (setup local, env vars, projeto Supabase, SMTP, deploy Vercel) → **publicação**

Fase 2 e 3 seguem a especificação; o modelo acima já tem os campos necessários, então não haverá migração destrutiva.

## 9. Decisões em aberto

Cada item tem um **padrão recomendado** — se você concordar com todos, basta responder "ok".

**Autenticação e infraestrutura**

- **D1. Login no PWA do iPhone.** No iOS, o app instalado na tela inicial não compartilha sessão com o Safari: clicar no magic link abre o Safari e loga *lá*, não no app. **Padrão:** o e-mail traz o link **e** um código de 6 dígitos; no app instalado vocês digitam o código. (Alternativa: login com Google, que evita e-mail.)
- **D8. Envio de e-mail.** O SMTP padrão do Supabase só envia para e-mails da equipe do projeto e tem limite de poucos e-mails por hora — sua esposa não receberia o link. **Padrão:** configurar SMTP próprio gratuito (ex.: Resend, que exige um domínio seu) ou Gmail SMTP com senha de app. Você tem um domínio?
- **D9. Convite.** **Padrão:** você cadastra o e-mail dela em Configurações; o app gera um link de convite que você manda pelo WhatsApp; ao entrar com aquele e-mail ela já cai na casa. (Evita depender do Supabase enviar um e-mail extra de convite.)
- **D10. Contas Supabase/Vercel.** Não tenho acesso às suas contas daqui. **Padrão:** eu deixo tudo pronto (migrações, seed, README passo a passo) e você cria o projeto Supabase, roda `supabase db push`, conecta o repositório na Vercel e cola as variáveis de ambiente (~15 min). Se preferir, você me passa tokens de acesso e eu faço.

**Regras de cálculo**

- **D2. Compras parceladas na meta diária (Fase 2, mas afeta o modelo).** **Padrão:** a 1ª parcela conta como gasto variável no dia da compra; as parcelas 2..N entram como "comprometido" nos meses seguintes (mês da compra + k−1). Alternativa: o valor total conta como gasto variável no dia da compra e as parcelas futuras não reduzem o disponível dos meses seguintes (só afetam o caixa).
- **D3. Meta dinâmica e gasto de hoje.** Pela fórmula literal, a meta do dia cai a cada gasto feito hoje, o que confunde ("gastei 50 e minha meta mudou"). **Padrão:** a meta de hoje é calculada com o gasto **até ontem** e fica fixa durante o dia; o número grande é "meta de hoje − gasto de hoje".
- **D4. Compra no dia do fechamento (Fase 2).** **Padrão:** entra na fatura seguinte (comportamento da maioria dos bancos; o dia do fechamento é o "melhor dia de compra"). Fechamento em dia inexistente (31 em fevereiro) → último dia do mês.
- **D5. Status automático.** **Padrão:** lançamento manual com data ≤ hoje nasce "realizado"; com data futura nasce "previsto". Previstos com data passada não confirmados continuam contando como comprometido e aparecem em "aguardando confirmação".
- **D6. Saldo das contas.** A coluna "saldo projetado da conta" exige saber o saldo real. **Padrão:** cada conta tem saldo inicial + data; a tabela mostra o saldo consolidado das contas (cartões não entram — entram as faturas, no vencimento). Transferências entre contas próprias ficam para depois (por ora "transferência" é só forma de pagamento). Se você preferir não controlar saldo bancário na Fase 1, a coluna mostra "receitas − despesas acumuladas" a partir de zero.
- **D7. Meta de poupança.** **Padrão:** valor único da casa (R$ ou % da receita prevista), com possibilidade de sobrescrever em um mês específico na tela Mês.
- **D13. Semáforo.** **Padrão:** baseado no cenário A (ritmo atual). 🟢 poupança projetada ≥ meta; 🟡 ≥ 0 e < meta; 🔴 < 0.
- **D14. Ritmo médio no começo do mês.** Nos dias 1–3 a média é muito ruidosa. **Padrão:** média dos dias decorridos até ontem; antes de ter 3 dias completos, o cenário A usa a média diária do mês anterior (se houver) ou a meta.

**Escopo e uso**

- **D11. Horizonte das recorrências.** **Padrão:** gerar os previstos do mês visualizado sob demanda (o mês corrente e o próximo são garantidos ao abrir Hoje, para que "próximos vencimentos" funcione na virada do mês).
- **D12. Filtro por pessoa (Fase 2).** Lançamentos "casa" aparecem no filtro de cada pessoa? **Padrão:** o filtro "Marcos" mostra só os de Marcos, com um toggle "incluir compartilhados". A meta diária por pessoa fica para discutirmos na Fase 2 (precisa de regra de divisão da receita).
- **D15. Nome do app e de vocês.** Qual nome aparece no ícone do celular? (Padrão: "Finanças da Casa".) E os nomes de exibição de vocês dois (usados em "quem lançou").
- **D16. Valores do seed.** **Padrão:** dados fictícios (salários, aluguel, mercado...) de outubro/2026, só no ambiente local — nunca em produção.
