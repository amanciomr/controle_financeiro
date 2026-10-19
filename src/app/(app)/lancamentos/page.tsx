import type { Metadata } from "next";
import Link from "next/link";
import { TransactionRow } from "@/components/transaction-row";
import { Card, Empty, Money, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/data/context";
import { categoryMap, type Transaction } from "@/lib/data/month";
import {
  addMonths,
  formatDateBR,
  formatWeekdayShort,
  isISODate,
  monthEnd,
  monthOf,
  monthStart,
} from "@/lib/domain/dates";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/labels";

export const metadata: Metadata = { title: "Lançamentos" };

const LIMIT = 500;

function param(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export default async function TransactionsPage(props: PageProps<"/lancamentos">) {
  const sp = await props.searchParams;
  const ctx = await getAppContext();
  const month = monthOf(ctx.today);

  const from = isISODate(param(sp.de)) ? param(sp.de) : monthStart(month);
  const to = isISODate(param(sp.ate)) ? param(sp.ate) : monthEnd(month);
  const q = param(sp.q);
  const category = param(sp.categoria);
  const method = param(sp.forma);
  const person = param(sp.pessoa);
  const status = param(sp.status);
  const type = param(sp.tipo);

  let query = ctx.supabase
    .from("transactions")
    .select("*")
    .eq("household_id", ctx.household.id)
    .gte("date", from)
    .lte("date", to)
    .neq("status", "skipped")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (q) query = query.ilike("description", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  if (category) {
    // Categoria pai inclui as subcategorias.
    const ids = ctx.categories
      .filter((c) => c.id === category || c.parent_id === category)
      .map((c) => c.id);
    query = query.in("category_id", ids.length ? ids : [category]);
  }
  if (PAYMENT_METHODS.some((p) => p.value === method)) {
    query = query.eq("payment_method", method as PaymentMethod);
  }
  if (person === "casa") query = query.is("person_user_id", null);
  else if (ctx.members.some((m) => m.user_id === person))
    query = query.eq("person_user_id", person);
  if (status === "planned" || status === "done") query = query.eq("status", status);
  if (type === "income" || type === "expense") query = query.eq("type", type);

  const { data, error } = await query;
  if (error) throw error;
  const transactions = data ?? [];

  const byDay = new Map<string, Transaction[]>();
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (!byDay.has(t.date)) byDay.set(t.date, []);
    byDay.get(t.date)!.push(t);
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }

  const lookups = { categories: categoryMap(ctx), members: ctx.members, userId: ctx.userId };
  const hasFilters = Boolean(q || category || method || person || status || type);
  const prev = addMonths(monthOf(from), -1);

  return (
    <div className="space-y-4">
      <PageHeader title="Lançamentos" />

      <form className="space-y-3" action="/lancamentos">
        <input
          name="q"
          defaultValue={q}
          className="field"
          placeholder="Buscar pela descrição"
          type="search"
          enterKeyHint="search"
        />
        <details className="rounded-xl border border-line bg-card p-3" open={hasFilters}>
          <summary className="cursor-pointer text-sm font-medium">Filtros</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="label">De</span>
              <input type="date" name="de" defaultValue={from} className="field" />
            </label>
            <label className="text-sm">
              <span className="label">Até</span>
              <input type="date" name="ate" defaultValue={to} className="field" />
            </label>
            <label className="col-span-2 text-sm">
              <span className="label">Categoria</span>
              <select name="categoria" defaultValue={category} className="field">
                <option value="">Todas</option>
                {ctx.categories
                  .filter((c) => !c.archived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parent_id ? "   ↳ " : ""}
                      {c.icon} {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="label">Forma</span>
              <select name="forma" defaultValue={method} className="field">
                <option value="">Todas</option>
                {PAYMENT_METHODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="label">Pessoa</span>
              <select name="pessoa" defaultValue={person} className="field">
                <option value="">Todas</option>
                {ctx.members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name}
                  </option>
                ))}
                <option value="casa">Casa</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="label">Status</span>
              <select name="status" defaultValue={status} className="field">
                <option value="">Todos</option>
                <option value="done">Realizado</option>
                <option value="planned">Previsto</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="label">Tipo</span>
              <select name="tipo" defaultValue={type} className="field">
                <option value="">Todos</option>
                <option value="expense">Despesas</option>
                <option value="income">Receitas</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-primary flex-1">Aplicar</button>
            <Link href="/lancamentos" className="btn-ghost">
              Limpar
            </Link>
          </div>
        </details>
      </form>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">
          {formatDateBR(from)} – {formatDateBR(to)}
        </span>
        <Link
          href={`/lancamentos?de=${monthStart(prev)}&ate=${monthEnd(prev)}`}
          className="text-accent"
        >
          ‹ mês anterior
        </Link>
      </div>

      <Card className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-xs text-muted">Receitas</div>
          <Money cents={income} tone="income" className="font-semibold" />
        </div>
        <div>
          <div className="text-xs text-muted">Despesas</div>
          <Money cents={expense} tone="expense" className="font-semibold" />
        </div>
      </Card>

      {transactions.length === 0 ? (
        <Empty>Nenhum lançamento encontrado.</Empty>
      ) : (
        [...byDay.entries()].map(([date, items]) => {
          const net = items.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
          return (
            <section key={date}>
              <div className="mb-1 flex justify-between px-1 text-xs text-muted">
                <span>
                  {formatWeekdayShort(date)}, {formatDateBR(date)}
                </span>
                <Money cents={net} />
              </div>
              <Card className="divide-y divide-line py-1">
                {items.map((t) => (
                  <TransactionRow key={t.id} tx={t} lookups={lookups} showAuthor />
                ))}
              </Card>
            </section>
          );
        })
      )}
      {transactions.length === LIMIT && (
        <p className="text-center text-xs text-muted">
          Mostrando os {LIMIT} mais recentes. Use os filtros para refinar.
        </p>
      )}
    </div>
  );
}
