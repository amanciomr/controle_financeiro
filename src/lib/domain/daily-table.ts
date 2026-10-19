import { type AccountOpening, balanceBefore, type CashMovement } from "./balance";
import { type BudgetEntry, expenseBucket, inMonth, type MonthSummary } from "./budget";
import { addDays, datesOfMonth, type ISODate, monthStart } from "./dates";
import type { Cents } from "./money";

export type DayPhase = "past" | "today" | "future";

export interface DailyRow {
  date: ISODate;
  phase: DayPhase;
  /** Meta de gasto variável do dia. */
  goal: Cents;
  /** Gasto variável realizado (null em dias futuros). */
  spent: Cents | null;
  /** Meta − realizado (positivo = gastou menos que a meta). */
  difference: Cents | null;
  accumulatedGoal: Cents;
  accumulatedSpent: Cents | null;
  /** Acumulado da meta − acumulado realizado (positivo = abaixo da meta). */
  deviation: Cents | null;
  /** Receitas do dia (previstas ou realizadas). */
  income: Cents;
  /** Despesas comprometidas do dia: fixos, parcelas, previstos. */
  committed: Cents;
  /** Saldo projetado das contas ao fim do dia. */
  balance: Cents;
}

export interface DailyTableInput {
  summary: MonthSummary;
  entries: BudgetEntry[];
  accounts: AccountOpening[];
  /** Movimentos de caixa (não pulados) até o fim do mês, incluindo meses anteriores. */
  movements: CashMovement[];
}

/**
 * Uma linha por dia do mês. A meta dos dias passados é a meta dinâmica que
 * valia naquele dia (com o disponível do mês como está hoje); hoje e os dias
 * futuros usam a meta dinâmica de hoje. O saldo projetado soma os movimentos
 * de caixa (realizados e previstos) e, para hoje e os dias futuros, desconta
 * o gasto variável que ainda deve acontecer segundo a meta.
 */
export function buildDailyTable({
  summary,
  entries,
  accounts,
  movements,
}: DailyTableInput): DailyRow[] {
  const { context, available, dynamicDailyGoal } = summary;
  const { month, today } = context;
  const dates = datesOfMonth(month);

  const spentByDay = new Map<ISODate, Cents>();
  const incomeByDay = new Map<ISODate, Cents>();
  const committedByDay = new Map<ISODate, Cents>();
  const add = (map: Map<ISODate, Cents>, date: ISODate, v: Cents) =>
    map.set(date, (map.get(date) ?? 0) + v);

  for (const e of entries) {
    if (e.status === "skipped" || !inMonth(e, month)) continue;
    if (e.type === "income") add(incomeByDay, e.date, e.amount);
    else if (expenseBucket(e) === "committed") add(committedByDay, e.date, e.amount);
    else add(spentByDay, e.date, e.amount);
  }

  const zeroDate = monthStart(month);
  const rows: DailyRow[] = [];
  let spentBefore = 0;
  let accumulatedGoal = 0;
  let accumulatedSpent = 0;
  let projectedOutflow = 0;

  dates.forEach((date, index) => {
    const phase: DayPhase = date < today ? "past" : date === today ? "today" : "future";
    const daysLeft = dates.length - index;
    const goal =
      phase === "past" ? Math.floor((available - spentBefore) / daysLeft) : dynamicDailyGoal;
    const spentToday = spentByDay.get(date) ?? 0;

    accumulatedGoal += goal;
    let spent: Cents | null = null;
    if (phase !== "future") {
      spent = spentToday;
      accumulatedSpent += spentToday;
    }
    spentBefore += spentToday;

    // Gasto variável ainda não lançado que a projeção assume para o dia.
    if (phase === "today") projectedOutflow += Math.max(0, goal - spentToday);
    if (phase === "future") projectedOutflow += Math.max(0, goal);

    rows.push({
      date,
      phase,
      goal,
      spent,
      difference: spent === null ? null : goal - spent,
      accumulatedGoal,
      accumulatedSpent: spent === null ? null : accumulatedSpent,
      deviation: spent === null ? null : accumulatedGoal - accumulatedSpent,
      income: incomeByDay.get(date) ?? 0,
      committed: committedByDay.get(date) ?? 0,
      balance: balanceBefore(addDays(date, 1), accounts, movements, zeroDate) - projectedOutflow,
    });
  });

  return rows;
}
