import {
  daysInYearMonth,
  diffDays,
  type ISODate,
  monthEnd,
  monthOf,
  monthStart,
  type YearMonth,
} from "./dates";
import { applyBasisPoints, type Cents } from "./money";

export type TxType = "income" | "expense";
export type TxStatus = "planned" | "done" | "skipped";
export type Nature = "fixed" | "variable";

/** Um lançamento visto pela ótica do orçamento (competência). */
export interface BudgetEntry {
  /** Data de competência (quando aconteceu / vai acontecer). */
  date: ISODate;
  /** Sempre positivo; o sinal vem de `type`. */
  amount: Cents;
  type: TxType;
  status: TxStatus;
  /** Natureza da categoria do lançamento. */
  nature: Nature;
  /** Parcela ≥ 2 de compra no cartão: conta como comprometido do mês em que cai. */
  installmentCarry?: boolean;
}

export type ExpenseBucket = "committed" | "variable";

/**
 * Classifica uma despesa:
 * - comprometido: categoria fixa (prevista ou realizada), qualquer despesa ainda
 *   prevista (ex.: boleto agendado) e parcelas antigas de cartão;
 * - variável: despesa realizada de categoria variável.
 */
export function expenseBucket(entry: BudgetEntry): ExpenseBucket {
  if (entry.nature === "fixed" || entry.status === "planned" || entry.installmentCarry) {
    return "committed";
  }
  return "variable";
}

export interface SavingsGoal {
  mode: "amount" | "percent";
  /** Centavos (amount) ou pontos-base (percent: 1000 = 10%). */
  value: number;
}

export function savingsGoalAmount(goal: SavingsGoal | null | undefined, income: Cents): Cents {
  if (!goal) return 0;
  if (goal.mode === "amount") return goal.value;
  return Math.max(0, applyBasisPoints(income, goal.value));
}

export type MonthPhase = "past" | "current" | "future";

export interface MonthContext {
  month: YearMonth;
  today: ISODate;
  phase: MonthPhase;
  daysInMonth: number;
  /** Dias do mês já encerrados (antes de hoje). */
  elapsedDays: number;
  /** Dias restantes, incluindo hoje. */
  remainingDays: number;
}

export function monthContext(month: YearMonth, today: ISODate): MonthContext {
  const days = daysInYearMonth(month);
  const todayMonth = monthOf(today);
  let phase: MonthPhase;
  let elapsedDays: number;
  if (todayMonth > month) {
    phase = "past";
    elapsedDays = days;
  } else if (todayMonth < month) {
    phase = "future";
    elapsedDays = 0;
  } else {
    phase = "current";
    elapsedDays = diffDays(today, monthStart(month));
  }
  return { month, today, phase, daysInMonth: days, elapsedDays, remainingDays: days - elapsedDays };
}

export interface MonthSummary {
  context: MonthContext;
  income: Cents;
  incomeDone: Cents;
  incomePlanned: Cents;
  committed: Cents;
  committedDone: Cents;
  committedPlanned: Cents;
  savingsGoal: Cents;
  /** Disponível para gastos variáveis = receita − comprometido − meta de poupança. */
  available: Cents;
  /** Disponível ÷ dias do mês. */
  initialDailyGoal: Cents;
  /** Gasto variável realizado no mês inteiro. */
  variableSpent: Cents;
  variableSpentBeforeToday: Cents;
  variableSpentToday: Cents;
  /** Meta de hoje: (disponível − variável até ontem) ÷ dias restantes incluindo hoje. */
  dynamicDailyGoal: Cents;
  /** Quanto ainda dá para gastar hoje: meta de hoje − gasto variável de hoje. */
  canSpendToday: Cents;
  /** Disponível − variável já realizado. */
  remainingAvailable: Cents;
}

export interface SummarizeInput {
  month: YearMonth;
  today: ISODate;
  entries: BudgetEntry[];
  savingsGoal?: SavingsGoal | null;
}

export function inMonth(entry: { date: ISODate }, month: YearMonth): boolean {
  return entry.date >= monthStart(month) && entry.date <= monthEnd(month);
}

export function summarizeMonth({
  month,
  today,
  entries,
  savingsGoal,
}: SummarizeInput): MonthSummary {
  const context = monthContext(month, today);
  let incomeDone = 0;
  let incomePlanned = 0;
  let committedDone = 0;
  let committedPlanned = 0;
  let variableSpent = 0;
  let variableSpentBeforeToday = 0;
  let variableSpentToday = 0;

  for (const e of entries) {
    if (e.status === "skipped" || !inMonth(e, month)) continue;
    if (e.type === "income") {
      if (e.status === "done") incomeDone += e.amount;
      else incomePlanned += e.amount;
      continue;
    }
    if (expenseBucket(e) === "committed") {
      if (e.status === "done") committedDone += e.amount;
      else committedPlanned += e.amount;
      continue;
    }
    variableSpent += e.amount;
    if (e.date < today) variableSpentBeforeToday += e.amount;
    else if (e.date === today) variableSpentToday += e.amount;
  }

  const income = incomeDone + incomePlanned;
  const committed = committedDone + committedPlanned;
  const goal = savingsGoalAmount(savingsGoal, income);
  const available = income - committed - goal;
  const initialDailyGoal = Math.floor(available / context.daysInMonth);

  const dynamicDailyGoal =
    context.remainingDays > 0
      ? Math.floor((available - variableSpentBeforeToday) / context.remainingDays)
      : 0;
  const canSpendToday = context.phase === "current" ? dynamicDailyGoal - variableSpentToday : 0;

  return {
    context,
    income,
    incomeDone,
    incomePlanned,
    committed,
    committedDone,
    committedPlanned,
    savingsGoal: goal,
    available,
    initialDailyGoal,
    variableSpent,
    variableSpentBeforeToday,
    variableSpentToday,
    dynamicDailyGoal,
    canSpendToday,
    remainingAvailable: available - variableSpent,
  };
}

/** Média diária de gasto variável de um mês já encerrado (para o forecast do mês seguinte). */
export function dailyVariableAverage(entries: BudgetEntry[], month: YearMonth): Cents {
  let total = 0;
  for (const e of entries) {
    if (
      e.type === "expense" &&
      e.status !== "skipped" &&
      inMonth(e, month) &&
      expenseBucket(e) === "variable"
    ) {
      total += e.amount;
    }
  }
  return Math.round(total / daysInYearMonth(month));
}
