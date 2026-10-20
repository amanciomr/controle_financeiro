import type { MonthSummary } from "./budget";
import type { DailyRow } from "./daily-table";
import { parseDate, type YearMonth } from "./dates";
import type { Forecast } from "./forecast";
import type { Cents } from "./money";

export interface CumulativePoint {
  day: number;
  /** Gasto variável acumulado (até hoje). */
  realized: Cents | null;
  /** Meta acumulada: o disponível distribuído igualmente pelo mês. */
  goal: Cents;
  /** Projeção no ritmo atual, de hoje até o fim do mês. */
  projection: Cents | null;
}

/** Linha do acumulado do mês: realizado × meta × projeção. */
export function cumulativeSeries(
  rows: DailyRow[],
  summary: MonthSummary,
  forecast: Forecast,
): CumulativePoint[] {
  const n = rows.length;
  const todayIndex = rows.findIndex((r) => r.phase === "today");
  const anchor = todayIndex >= 0 ? (rows[todayIndex].accumulatedSpent ?? 0) : null;
  return rows.map((r, i) => ({
    day: parseDate(r.date).day,
    realized: r.accumulatedSpent,
    goal: Math.round((summary.available * (i + 1)) / n),
    projection:
      anchor === null || i < todayIndex
        ? null
        : anchor + forecast.pace.dailyRate * (i - todayIndex),
  }));
}

export interface DailyBar {
  day: number;
  spent: Cents | null;
  goal: Cents;
}

export function dailyBars(rows: DailyRow[]): DailyBar[] {
  return rows.map((r) => ({ day: parseDate(r.date).day, spent: r.spent, goal: r.goal }));
}

export interface ExpenseItem {
  date: string;
  amount: Cents;
  /** Categoria já agrupada (subcategoria → principal). */
  categoryId: string;
}

export interface CategoryComparison {
  categoryId: string | "other";
  current: Cents;
  /** Média mensal dos meses anteriores informados. */
  average: Cents;
}

/**
 * Gasto por categoria no mês × média dos meses anteriores. Mantém as
 * `limit` maiores do mês (ou da média) e junta o resto em "other".
 */
export function categoryComparison(
  items: ExpenseItem[],
  month: YearMonth,
  previousMonths: YearMonth[],
  limit = 6,
): CategoryComparison[] {
  const current = new Map<string, Cents>();
  const previous = new Map<string, Cents>();
  for (const i of items) {
    const ym = i.date.slice(0, 7);
    if (ym === month) current.set(i.categoryId, (current.get(i.categoryId) ?? 0) + i.amount);
    else if (previousMonths.includes(ym)) {
      previous.set(i.categoryId, (previous.get(i.categoryId) ?? 0) + i.amount);
    }
  }
  const divisor = Math.max(1, previousMonths.length);
  const all = [...new Set([...current.keys(), ...previous.keys()])].map((categoryId) => ({
    categoryId,
    current: current.get(categoryId) ?? 0,
    average: Math.round((previous.get(categoryId) ?? 0) / divisor),
  }));
  all.sort((a, b) => Math.max(b.current, b.average) - Math.max(a.current, a.average));
  if (all.length <= limit) return all;
  const top = all.slice(0, limit - 1);
  const rest = all.slice(limit - 1);
  return [
    ...top,
    {
      categoryId: "other",
      current: rest.reduce((s, r) => s + r.current, 0),
      average: rest.reduce((s, r) => s + r.average, 0),
    },
  ];
}

/** Gasto do mês por pessoa (null = casa), do maior para o menor. */
export function spendingByPerson(
  items: { amount: Cents; personUserId: string | null }[],
): { personUserId: string | null; total: Cents }[] {
  const totals = new Map<string | null, Cents>();
  for (const i of items) totals.set(i.personUserId, (totals.get(i.personUserId) ?? 0) + i.amount);
  return [...totals.entries()]
    .map(([personUserId, total]) => ({ personUserId, total }))
    .sort((a, b) => b.total - a.total);
}
