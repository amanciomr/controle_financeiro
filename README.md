# Finanças Amâncio

App web (PWA) de controle financeiro do casal: **quanto ainda dá para gastar hoje**, quanto já foi gasto e **onde o mês vai fechar**. Mobile-first, em português, valores em R$, fuso America/Bahia. Rafael e Ana têm logins separados e compartilham as mesmas finanças (a "casa").

> **Fase 1** (MVP): login, casa com convite, categorias, lançamentos, recorrências, tela Hoje com meta diária dinâmica e tela Mês com tabela diária e rolling forecast.
> **Fase 2**: cartões de crédito com faturas, compras parceladas, visões competência × caixa, gráficos e filtro por pessoa.
> Fase 3 (orçamento por categoria, importação/exportação) está planejada em [`docs/PROPOSTA.md`](docs/PROPOSTA.md).

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions) + TypeScript + Tailwind CSS 4
- **Supabase**: Postgres, Auth (código de 6 dígitos + link por e-mail), Row Level Security, Realtime
- **Vitest** para a lógica de cálculo, **pgTAP** para as políticas de RLS
- Deploy na **Vercel**

## Como o app calcula

Toda a matemática fica em funções puras em [`src/lib/domain/`](src/lib/domain), com testes:

| Arquivo | O que faz |
|---|---|
| `money.ts` | centavos (inteiros, nunca float), formatação R$ pt-BR, entrada estilo caixa eletrônico |
| `dates.ts` | datas `YYYY-MM-DD` sem fuso, "hoje" na Bahia, meses de 28/29/30/31 dias |
| `recurrence.ts` | ocorrências mensais/anuais/semanais, dia 31 → último dia do mês, financiamentos |
| `budget.ts` | receita prevista, comprometido, disponível, meta diária inicial e dinâmica |
| `forecast.ts` | fechamento do mês no ritmo atual e cumprindo a meta, semáforo |
| `daily-table.ts` / `balance.ts` | tabela dia a dia e saldo projetado das contas |
| `card.ts` | fatura de cada compra (fechamento/vencimento), parcelas, status e limite usado |
| `charts.ts` | séries dos gráficos (acumulado, por dia, por categoria, por pessoa) |

Definições usadas (mês corrente):

- **Comprometido** = despesas de categorias **fixas** (previstas + realizadas) + qualquer despesa ainda **prevista**.
- **Disponível para variáveis** = receita prevista − comprometido − meta de poupança.
- **Meta de hoje** = (disponível − gasto variável **até ontem**) ÷ dias restantes, incluindo hoje. Fica fixa durante o dia.
- **Pode gastar hoje** = meta de hoje − gasto variável de hoje.
- **Recorrências** (fixos, parcelas, assinaturas) contam sempre como comprometido, mesmo em categoria variável.
- **Cartão de crédito**: a compra entra na fatura pela data de fechamento (compra no dia do fechamento vai para a seguinte). Na meta diária vale a **competência**: a 1ª parcela conta no dia da compra e as demais como comprometido nos meses seguintes. No saldo das contas vale o **caixa**: cada parcela sai no vencimento da sua fatura.
- **Forecast**: cenário A = ritmo médio dos dias já encerrados (nos 3 primeiros dias usa a média do mês anterior); cenário B = cumprindo a meta. Semáforo: 🟢 sobra ≥ meta de poupança, 🟡 entre zero e a meta, 🔴 negativo.

## Rodando localmente

Pré-requisitos: **Node 22+** e **Docker** (para o Supabase local).

```bash
npm install
npx supabase start          # sobe Postgres/Auth/Realtime, aplica migrações e o seed
cp .env.example .env.local  # cole a PUBLISHABLE_KEY mostrada pelo comando acima
npm run dev                 # http://localhost:3000
```

Entre com **rafael@exemplo.com** ou **ana@exemplo.com**. O e-mail com o código chega no Mailpit local: <http://127.0.0.1:54324>. O seed cria a "Casa Amâncio" com salários, aluguel, financiamento, contas de consumo e um mês de gastos do dia a dia, sempre relativos à data de hoje.

`npx supabase status` mostra as URLs e chaves a qualquer momento; `npm run db:reset` recria o banco do zero.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm test` | testes de domínio (Vitest) |
| `npm run db:test` | testes de RLS (pgTAP), com o Supabase local rodando |
| `npm run lint` / `npm run typecheck` | ESLint e TypeScript |
| `npm run db:reset` | recria o banco local (migrações + seed) |
| `npm run db:types` | regenera `src/lib/supabase/database.types.ts` |
| `python3 scripts/generate-icons.py` | regenera os ícones do PWA (precisa do Pillow) |

### Variáveis de ambiente

| Variável | Onde achar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | local: `API_URL` do `supabase status`; produção: Supabase → Project Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | local: `PUBLISHABLE_KEY`; produção: Project Settings → API Keys → *Publishable key* |

As duas são públicas por natureza (vão para o navegador). A segurança vem da RLS no banco. **Nunca** coloque a *secret key*/*service role* no app.

## Publicando (Supabase + Vercel)

### 1. Projeto no Supabase

1. Em <https://supabase.com/dashboard>, crie um projeto (região **South America (São Paulo)**). Guarde a senha do banco.
2. No terminal, a partir desta pasta:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-do-projeto>   # o ref está na URL do dashboard
   npx supabase db push                                 # aplica as migrações (NÃO roda o seed)
   ```
3. **Authentication → URL Configuration**
   - *Site URL*: a URL da Vercel (ex.: `https://financas-amancio.vercel.app`). Volte aqui depois do passo 2 se ainda não souber.
   - *Redirect URLs*: `https://financas-amancio.vercel.app/**`
4. **Authentication → Emails → Templates**: em *Magic Link* e em *Confirm signup*, troque o assunto para `Seu acesso ao Finanças Amâncio` e cole o HTML de [`supabase/templates/magic_link.html`](supabase/templates/magic_link.html). É ele que traz o **código de 6 dígitos**, necessário no iPhone (o app instalado não compartilha a sessão com o Safari, então o link abriria o login no Safari e não no app).
5. **Authentication → Emails → SMTP Settings** (obrigatório: o e-mail padrão do Supabase só envia para membros da equipe do projeto). Usando o Gmail:
   - Ative a verificação em duas etapas da conta Google e crie uma **senha de app** em <https://myaccount.google.com/apppasswords>.
   - Host `smtp.gmail.com`, porta `465`, usuário = seu Gmail completo, senha = a senha de app.
   - Remetente: o mesmo Gmail; nome do remetente: `Finanças Amâncio`.
6. **Authentication → Sign In / Providers → Email**: deixe *Email OTP Length* em 6.

### Atualizando o banco de produção (novas migrações)

Cada fase pode trazer um arquivo novo em `supabase/migrations/`. Aplique só os que ainda não rodou, em ordem, de um destes jeitos:

- **SQL Editor** do Supabase: *New query* → cole o conteúdo do arquivo → *Run*;
- ou, com o projeto ligado pelo CLI: `npx supabase db push`.

| Arquivo | Fase |
|---|---|
| `20261019000001_schema.sql` | 1 |
| `20261019000002_rls_and_rpcs.sql` | 1 |
| `20261021000001_cards.sql` | 2 (cartões) |

### 2. Deploy na Vercel

1. Em <https://vercel.com/new>, importe o repositório `controle_financeiro` (framework detectado: Next.js).
2. Em *Environment Variables*, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` do projeto de produção.
3. *Deploy*. Copie a URL gerada e ajuste o *Site URL* / *Redirect URLs* do passo 1.3 se necessário.

### 3. Primeiro uso

1. Rafael abre o app, entra com o e-mail e cria a casa ("Casa Amâncio").
2. **Mais → Configurações → Convidar alguém**: e-mail da Ana → mande o link pelo WhatsApp. Ela abre, entra com o próprio e-mail e cai direto na casa.
3. Em Configurações, ajuste a **meta de poupança** e o **saldo inicial** da conta (ou cadastre as contas de vocês).
4. Em **Mais → Recorrentes**, cadastre salários, aluguel, condomínio, assinaturas, contas de consumo (marque "valor varia") e financiamentos ("parcela N de M").
5. Opcional: depois que os dois tiverem entrado, desligue *Allow new users to sign up* em Authentication → Sign In / Providers, para ninguém mais criar conta.

### Instalando no celular

- **iPhone (Safari)**: abra a URL → Compartilhar → *Adicionar à Tela de Início*. Faça o login dentro do app instalado usando o **código** do e-mail.
- **Android (Chrome)**: abra a URL → menu ⋮ → *Instalar app*.

> Projetos gratuitos do Supabase pausam após ~1 semana sem uso; com uso diário isso não acontece.

## Segurança

- Todos os dados financeiros pertencem a uma casa; políticas RLS liberam leitura e escrita só para membros dela.
- Entrar numa casa só acontece por funções `security definer` (`create_household`, `accept_invite`). O convite exige o token **e** o mesmo e-mail do convidado.
- FKs compostas `(household_id, id)` impedem que um lançamento aponte para categoria ou conta de outra casa.
- Triggers registram quem criou e quem editou por último cada registro.
- [`supabase/tests/rls.test.sql`](supabase/tests/rls.test.sql) tem 35 testes: um usuário de outra casa não lê, não insere, não altera, não exclui e não se adiciona como membro. [`cards.test.sql`](supabase/tests/cards.test.sql) cobre as compras no cartão (14 testes).

## Estrutura

```
src/
  app/
    (auth)/           entrar, bem-vindo (criar casa / aceitar convite), convite/[token]
    (app)/            Hoje, mes/[mes], lancamentos, cartoes, recorrentes, categorias, configuracoes, mais
    actions/          Server Actions (gravações validadas com Zod)
    auth/confirm/     destino do link mágico
  components/         formulário de lançamento, botão +, tabela, cards
  lib/
    domain/           funções puras de cálculo + testes
    data/             consultas ao Supabase (contexto da casa, mês, recorrências)
    supabase/         clientes server/browser + tipos gerados
  proxy.ts            renova a sessão e protege as rotas
supabase/
  migrations/         schema, RLS e funções
  seed.sql            dados de exemplo (só local)
  tests/              testes pgTAP de RLS
  templates/          e-mails de login em português
```

## Versões e como voltar para uma fase anterior

| Versão | Commit | Banco necessário |
|---|---|---|
| Fase 1 (MVP) | [`fa03367`](https://github.com/amanciomr/controle_financeiro/tree/fa03367ad30a625a9479fd063f8a68bc9c950797) | migrações `20261019000001` e `20261019000002` |
| Fase 2 (cartões, gráficos, filtro por pessoa) | `c33ea3e` | + `20261021000001_cards.sql` |

As migrações só **acrescentam** tabelas e colunas, então uma versão antiga do app funciona com o banco de uma fase posterior (as tabelas novas ficam sem uso). Para voltar:

- **App no ar (mais rápido)**: Vercel → *Deployments* → deploy do commit desejado → ⋯ → *Promote to Production* (ou *Instant Rollback*). Leva segundos e não mexe no banco.
- **Código**: o commit continua no histórico para sempre; baixe em `https://github.com/amanciomr/controle_financeiro/archive/<commit>.zip`.
