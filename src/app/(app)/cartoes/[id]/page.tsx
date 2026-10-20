import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PersonFilter } from "@/components/person-filter";
import { StatementBadge } from "@/components/statement-badge";
import { StatementPaidButton } from "@/components/statement-paid-button";
import { TransactionRow } from "@/components/transaction-row";
import { Card, Empty, Money, PageHeader } from "@/components/ui";
import { loadCardOverview } from "@/lib/data/cards";
import { getAppContext } from "@/lib/data/context";
import { categoryMap } from "@/lib/data/month";
import { getPersonFilter, matchesPerson } from "@/lib/data/person";
import { statementForDueMonth, statementStatus } from "@/lib/domain/card";
import {
  addDays,
  addMonths,
  formatDayMonth,
  formatMonthBR,
  isYearMonth,
  monthEnd,
  monthStart,
} from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Fatura" };

export default async function CardStatementPage(props: PageProps<"/cartoes/[id]">) {
  const { id } = await props.params;
  const { fatura } = await props.searchParams;
  const ctx = await getAppContext();
  const person = await getPersonFilter(ctx);
  const overview = (await loadCardOverview(ctx, person)).find((o) => o.card.id === id);
  if (!overview) notFound();

  const month =
    typeof fatura === "string" && isYearMonth(fatura)
      ? fatura
      : (overview.toPay[0] ?? overview.open).statement.month;
  const summary = overview.byMonth.get(month);
  const statement = summary?.statement ?? statementForDueMonth(month, overview.card.cycle);
  const paid = summary?.paid ?? false;
  const status = statementStatus(statement, ctx.today, paid);

  const { data } = await ctx.supabase
    .from("transactions")
    .select("*")
    .eq("household_id", ctx.household.id)
    .eq("account_id", id)
    .neq("status", "skipped")
    .gte("cash_date", monthStart(month))
    .lte("cash_date", monthEnd(month))
    .order("date", { ascending: false });
  const items = (data ?? []).filter((t) => matchesPerson(t.person_user_id, person));
  const total = (data ?? []).reduce((s, t) => s + t.amount, 0);
  const filtered = items.reduce((s, t) => s + t.amount, 0);
  const lookups = { categories: categoryMap(ctx), members: ctx.members, userId: ctx.userId };
  const members = ctx.members.map((m) => ({ userId: m.user_id, name: m.display_name }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={`💳 ${overview.card.name}`}
        back="/cartoes"
        action={
          <Link href={`/cartoes/${id}/editar`} className="btn-ghost py-2">
            Editar
          </Link>
        }
      />
      <PersonFilter value={person} members={members} />

      <header className="flex items-center justify-between">
        <Link
          href={`/cartoes/${id}?fatura=${addMonths(month, -1)}`}
          className="btn-ghost px-3"
          aria-label="Fatura anterior"
        >
          ‹
        </Link>
        <div className="text-center">
          <div className="text-xs text-muted">Fatura de</div>
          <h2 className="text-lg font-bold first-letter:uppercase">{formatMonthBR(month)}</h2>
        </div>
        <Link
          href={`/cartoes/${id}?fatura=${addMonths(month, 1)}`}
          className="btn-ghost px-3"
          aria-label="Próxima fatura"
        >
          ›
        </Link>
      </header>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <StatementBadge status={status} />
          <span className="text-xs text-muted">
            compras de {formatDayMonth(statement.openingDate)} a{" "}
            {formatDayMonth(addDays(statement.closingDate, -1))}
          </span>
        </div>
        <div>
          <div className="text-xs text-muted">
            Total · vence {formatDayMonth(statement.dueDate)}
          </div>
          <Money cents={total} className="text-3xl font-bold" />
          {person && (
            <div className="text-sm text-muted">
              da pessoa filtrada: <Money cents={filtered} />
            </div>
          )}
        </div>
        {total > 0 && status !== "future" && status !== "open" && (
          <StatementPaidButton cardId={id} dueMonth={month} paid={paid} amount={total} />
        )}
        {status === "open" && (
          <p className="text-xs text-muted">
            Fatura aberta: fecha em {formatDayMonth(statement.closingDate)}.
          </p>
        )}
      </Card>

      <Card className="py-1">
        {items.length ? (
          <div className="divide-y divide-line">
            {items.map((t) => (
              <TransactionRow key={t.id} tx={t} lookups={lookups} showDate />
            ))}
          </div>
        ) : (
          <Empty>Nenhuma compra nesta fatura.</Empty>
        )}
      </Card>
    </div>
  );
}
