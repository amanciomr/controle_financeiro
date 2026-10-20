import "server-only";
import {
  type CardCycle,
  limitUsed,
  type Statement,
  statementForDueMonth,
  statementForPurchase,
  type StatementStatus,
  statementStatus,
} from "@/lib/domain/card";
import { monthOf, type YearMonth } from "@/lib/domain/dates";
import type { Account, AppContext } from "./context";
import { fetchAll } from "./month";
import { matchesPerson, type PersonFilter } from "./person";

export interface Card {
  id: string;
  name: string;
  ownerUserId: string | null;
  cycle: CardCycle;
  limit: number | null;
  paymentAccountId: string | null;
  archived: boolean;
}

export function cardsOf(accounts: Account[]): Card[] {
  return accounts
    .filter((a) => a.kind === "credit_card" && a.closing_day && a.due_day)
    .map((a) => ({
      id: a.id,
      name: a.name,
      ownerUserId: a.owner_user_id,
      cycle: { closingDay: a.closing_day!, dueDay: a.due_day! },
      limit: a.credit_limit,
      paymentAccountId: a.payment_account_id,
      archived: a.archived,
    }));
}

export interface StatementSummary {
  statement: Statement;
  status: StatementStatus;
  /** Total da fatura (todas as pessoas). */
  total: number;
  /** Total só da pessoa filtrada (igual ao total sem filtro). */
  filteredTotal: number;
  paid: boolean;
}

export interface CardOverview {
  card: Card;
  limitUsed: number;
  /** Fatura aberta (recebendo compras hoje). */
  open: StatementSummary;
  /** Faturas já fechadas e ainda não pagas. */
  toPay: StatementSummary[];
  /** Próximas faturas com parcelas já comprometidas. */
  upcoming: StatementSummary[];
  /** Todas as faturas com movimento, por mês de vencimento. */
  byMonth: Map<YearMonth, StatementSummary>;
}

/** Resumo de faturas e limite de todos os cartões da casa. */
export async function loadCardOverview(
  ctx: AppContext,
  person: PersonFilter,
): Promise<CardOverview[]> {
  const cards = cardsOf(ctx.accounts);
  if (cards.length === 0) return [];
  const ids = cards.map((c) => c.id);

  const [items, payments] = await Promise.all([
    fetchAll((from, to) =>
      ctx.supabase
        .from("transactions")
        .select("account_id, cash_date, amount, person_user_id")
        .eq("household_id", ctx.household.id)
        .in("account_id", ids)
        .neq("status", "skipped")
        .order("id")
        .range(from, to),
    ),
    ctx.supabase
      .from("card_statement_payments")
      .select("account_id, due_month")
      .eq("household_id", ctx.household.id),
  ]);

  return cards.map((card) => {
    const paid = new Set(
      (payments.data ?? [])
        .filter((p) => p.account_id === card.id)
        .map((p) => p.due_month.slice(0, 7)),
    );
    const totals = new Map<YearMonth, { total: number; filtered: number }>();
    const cardItems = items.filter((i) => i.account_id === card.id);
    for (const i of cardItems) {
      const month = monthOf(i.cash_date);
      const t = totals.get(month) ?? { total: 0, filtered: 0 };
      t.total += i.amount;
      if (matchesPerson(i.person_user_id, person)) t.filtered += i.amount;
      totals.set(month, t);
    }
    const summary = (month: YearMonth): StatementSummary => {
      const statement = statementForDueMonth(month, card.cycle);
      const isPaid = paid.has(month);
      const t = totals.get(month) ?? { total: 0, filtered: 0 };
      return {
        statement,
        status: statementStatus(statement, ctx.today, isPaid),
        total: t.total,
        filteredTotal: t.filtered,
        paid: isPaid,
      };
    };
    const open = summary(statementForPurchase(ctx.today, card.cycle).month);
    const byMonth = new Map<YearMonth, StatementSummary>();
    for (const month of [...totals.keys(), open.statement.month].sort()) {
      byMonth.set(month, summary(month));
    }
    const all = [...byMonth.values()];
    return {
      card,
      limitUsed: limitUsed(
        cardItems.map((i) => ({ dueMonth: monthOf(i.cash_date), amount: i.amount })),
        paid,
      ),
      open,
      toPay: all.filter((s) => s.statement.month < open.statement.month && !s.paid && s.total > 0),
      upcoming: all.filter((s) => s.statement.month > open.statement.month && s.total > 0),
      byMonth,
    };
  });
}

/** Faturas não pagas que vencem entre hoje e `until` (para "próximos vencimentos"). */
export function dueSoon(overviews: CardOverview[], today: string, until: string) {
  const result: { card: Card; summary: StatementSummary }[] = [];
  for (const o of overviews) {
    for (const s of o.byMonth.values()) {
      const due = s.statement.dueDate;
      if (!s.paid && s.total > 0 && due >= today && due <= until)
        result.push({ card: o.card, summary: s });
    }
  }
  return result.sort((a, b) =>
    a.summary.statement.dueDate.localeCompare(b.summary.statement.dueDate),
  );
}
