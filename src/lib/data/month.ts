import "server-only";
import type { AccountOpening, CashMovement } from "@/lib/domain/balance";
import {
  type BudgetEntry,
  dailyVariableAverage,
  type MonthSummary,
  summarizeMonth,
} from "@/lib/domain/budget";
import { buildDailyTable, type DailyRow } from "@/lib/domain/daily-table";
import {
  addMonths,
  type ISODate,
  maxDate,
  monthEnd,
  monthStart,
  type YearMonth,
} from "@/lib/domain/dates";
import { type Forecast, forecastMonth } from "@/lib/domain/forecast";
import { occurrencesBetween, type RecurrenceRule } from "@/lib/domain/recurrence";
import type { Database } from "@/lib/supabase/database.types";
import type { AppContext, Category } from "./context";
import { matchesPerson, type PersonFilter } from "./person";

type Tables = Database["public"]["Tables"];
export type Transaction = Tables["transactions"]["Row"];
export type Recurrence = Tables["recurrences"]["Row"];

const PAGE = 1000;

/** PostgREST devolve no máximo 1000 linhas por vez; busca todas as páginas. */
export async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) return all;
  }
}

export function recurrenceRule(r: Recurrence): RecurrenceRule {
  return {
    frequency: r.frequency,
    dayOfMonth: r.day_of_month,
    monthOfYear: r.month_of_year,
    weekday: r.weekday,
    startDate: r.start_date,
    endDate: r.end_date,
    totalInstallments: r.total_installments,
  };
}

/**
 * Garante que as ocorrências das recorrências ativas entre `from` e `to`
 * existam como lançamentos previstos. Idempotente: a constraint única
 * (recurrence_id, occurrence_date) faz o banco ignorar as que já existem
 * — inclusive as que foram "puladas" — mesmo com os dois abrindo o app ao
 * mesmo tempo.
 */
export async function ensureRecurrences(ctx: AppContext, from: ISODate, to: ISODate) {
  const { data: recurrences, error } = await ctx.supabase
    .from("recurrences")
    .select("*")
    .eq("household_id", ctx.household.id)
    .eq("active", true);
  if (error) throw error;

  const rows: Tables["transactions"]["Insert"][] = [];
  for (const r of recurrences ?? []) {
    const start = maxDate(from, r.generate_from);
    for (const occ of occurrencesBetween(recurrenceRule(r), start, to)) {
      rows.push({
        household_id: r.household_id,
        date: occ.date,
        cash_date: occ.date,
        description: r.description,
        amount: r.amount,
        type: r.type,
        category_id: r.category_id,
        payment_method: r.payment_method,
        account_id: r.account_id,
        person_user_id: r.person_user_id,
        status: "planned",
        recurrence_id: r.id,
        occurrence_date: occ.date,
        installment_number: r.total_installments ? occ.index : null,
        installment_total: r.total_installments,
      });
    }
  }
  if (rows.length === 0) return;
  const { error: upsertError } = await ctx.supabase
    .from("transactions")
    .upsert(rows, { onConflict: "recurrence_id,occurrence_date", ignoreDuplicates: true });
  if (upsertError) throw upsertError;
}

export function toBudgetEntry(
  tx: Pick<
    Transaction,
    | "date"
    | "amount"
    | "type"
    | "status"
    | "category_id"
    | "purchase_id"
    | "installment_number"
    | "recurrence_id"
  >,
  categories: Map<string, Category>,
): BudgetEntry {
  return {
    date: tx.date,
    amount: tx.amount,
    type: tx.type,
    status: tx.status,
    nature: categories.get(tx.category_id)?.nature ?? "variable",
    installmentCarry: tx.purchase_id != null && (tx.installment_number ?? 1) >= 2,
    recurring: tx.recurrence_id != null,
  };
}

export function categoryMap(ctx: Pick<AppContext, "categories">): Map<string, Category> {
  return new Map(ctx.categories.map((c) => [c.id, c]));
}

export interface MonthData {
  month: YearMonth;
  transactions: Transaction[];
  entries: BudgetEntry[];
  summary: MonthSummary;
  forecast: Forecast;
}

/** Lançamentos do mês + resumo + forecast. */
/**
 * Lançamentos do mês + resumo + forecast. Com filtro por pessoa, só os
 * lançamentos dela entram nas contas; meta de poupança em valor fixo é
 * proporcional à fatia da receita dessa pessoa.
 */
export async function loadMonth(
  ctx: AppContext,
  month: YearMonth,
  person: PersonFilter = "",
): Promise<MonthData> {
  const start = monthStart(month);
  const end = monthEnd(month);
  const prev = addMonths(month, -1);
  const categories = categoryMap(ctx);

  const [transactions, previous] = await Promise.all([
    fetchAll<Transaction>((from, to) =>
      ctx.supabase
        .from("transactions")
        .select("*")
        .eq("household_id", ctx.household.id)
        .gte("date", start)
        .lte("date", end)
        .order("date")
        .order("created_at")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      ctx.supabase
        .from("transactions")
        .select(
          "date, amount, type, status, category_id, purchase_id, installment_number, recurrence_id, person_user_id",
        )
        .eq("household_id", ctx.household.id)
        .eq("type", "expense")
        .gte("date", monthStart(prev))
        .lte("date", monthEnd(prev))
        .range(from, to),
    ),
  ]);

  const mine = transactions.filter((t) => matchesPerson(t.person_user_id, person));
  const entries = mine.map((t) => toBudgetEntry(t, categories));
  let savingsGoal = ctx.savingsGoal;
  if (person && savingsGoal.mode === "amount") {
    const income = (list: Transaction[]) =>
      list
        .filter((t) => t.type === "income" && t.status !== "skipped")
        .reduce((s, t) => s + t.amount, 0);
    const total = income(transactions);
    savingsGoal = {
      mode: "amount",
      value: total > 0 ? Math.round((savingsGoal.value * income(mine)) / total) : 0,
    };
  }
  const summary = summarizeMonth({ month, today: ctx.today, entries, savingsGoal });
  const previousEntries = previous
    .filter((t) => matchesPerson(t.person_user_id, person))
    .map((t) => toBudgetEntry(t, categories));
  const forecast = forecastMonth(
    summary,
    previousEntries.length > 0 ? dailyVariableAverage(previousEntries, prev) : null,
  );
  return { month, transactions: mine, entries, summary, forecast };
}

/** Tabela diária, incluindo o saldo projetado das contas. */
export async function loadDailyTable(ctx: AppContext, data: MonthData): Promise<DailyRow[]> {
  const cashAccounts = ctx.accounts.filter((a) => a.kind !== "credit_card");
  const accounts: AccountOpening[] = cashAccounts.map((a) => ({
    id: a.id,
    openingBalance: a.opening_balance,
    openingDate: a.opening_date,
  }));
  const since = accounts.reduce(
    (min, a) => (a.openingDate < min ? a.openingDate : min),
    monthStart(data.month),
  );

  const rows = await fetchAll((from, to) =>
    ctx.supabase
      .from("transactions")
      .select("cash_date, amount, type, account_id")
      .eq("household_id", ctx.household.id)
      .neq("status", "skipped")
      .gte("cash_date", since)
      .lte("cash_date", monthEnd(data.month))
      .order("id")
      .range(from, to),
  );
  const movements: CashMovement[] = rows.map((r) => ({
    date: r.cash_date,
    amount: r.type === "income" ? r.amount : -r.amount,
    accountId: r.account_id,
  }));

  return buildDailyTable({ summary: data.summary, entries: data.entries, accounts, movements });
}

export interface CashFlow {
  income: number;
  /** Saídas fora do cartão (Pix, débito, boleto…), pela data de pagamento. */
  direct: number;
  /** Faturas de cartão que vencem no mês. */
  bills: { cardId: string; dueDate: string; total: number }[];
  net: number;
}

/**
 * Visão de caixa do mês: o que entra e sai das contas pela data de caixa
 * (no cartão, o vencimento da fatura), diferente da competência usada na
 * meta diária.
 */
export async function loadCashFlow(
  ctx: AppContext,
  month: YearMonth,
  person: PersonFilter = "",
): Promise<CashFlow> {
  const cardIds = new Set(ctx.accounts.filter((a) => a.kind === "credit_card").map((a) => a.id));
  const rows = await fetchAll((from, to) =>
    ctx.supabase
      .from("transactions")
      .select("cash_date, amount, type, account_id, person_user_id")
      .eq("household_id", ctx.household.id)
      .neq("status", "skipped")
      .gte("cash_date", monthStart(month))
      .lte("cash_date", monthEnd(month))
      .order("id")
      .range(from, to),
  );
  let income = 0;
  let direct = 0;
  const bills = new Map<string, { cardId: string; dueDate: string; total: number }>();
  for (const r of rows) {
    if (!matchesPerson(r.person_user_id, person)) continue;
    if (r.type === "income") income += r.amount;
    else if (r.account_id && cardIds.has(r.account_id)) {
      const key = `${r.account_id}|${r.cash_date}`;
      const bill = bills.get(key) ?? { cardId: r.account_id, dueDate: r.cash_date, total: 0 };
      bill.total += r.amount;
      bills.set(key, bill);
    } else direct += r.amount;
  }
  const billList = [...bills.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    income,
    direct,
    bills: billList,
    net: income - direct - billList.reduce((s, b) => s + b.total, 0),
  };
}

/** Despesas do mês e dos 3 anteriores, para os gráficos por categoria e pessoa. */
export async function loadExpenseHistory(
  ctx: AppContext,
  month: YearMonth,
  person: PersonFilter = "",
) {
  const rows = await fetchAll((from, to) =>
    ctx.supabase
      .from("transactions")
      .select("date, amount, category_id, person_user_id")
      .eq("household_id", ctx.household.id)
      .eq("type", "expense")
      .neq("status", "skipped")
      .gte("date", monthStart(addMonths(month, -3)))
      .lte("date", monthEnd(month))
      .order("id")
      .range(from, to),
  );
  const parentOf = new Map(ctx.categories.map((c) => [c.id, c.parent_id ?? c.id]));
  return rows
    .filter((r) => matchesPerson(r.person_user_id, person))
    .map((r) => ({
      date: r.date,
      amount: r.amount,
      categoryId: parentOf.get(r.category_id) ?? r.category_id,
      personUserId: r.person_user_id,
    }));
}
