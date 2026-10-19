import type { MonthSummary } from "./budget";
import type { Cents } from "./money";

/** Dias completos necessários para confiar na média do próprio mês. */
export const MIN_DAYS_FOR_PACE = 3;

export type Signal = "green" | "yellow" | "red";

export interface Scenario {
  /** Gasto variável diário assumido para os dias restantes. */
  dailyRate: Cents;
  /** Gasto variável total projetado para o mês. */
  projectedVariable: Cents;
  /** Receita − comprometido − variável projetado. */
  projectedSavings: Cents;
}

export interface Forecast {
  /** Cenário A: mantendo o ritmo médio de gasto variável. */
  pace: Scenario;
  /** De onde veio o ritmo: do próprio mês, do mês anterior ou da meta. */
  paceSource: "month" | "previous_month" | "goal";
  /** Cenário B: cumprindo a meta diária dinâmica. */
  goal: Scenario;
  /** Semáforo sobre o cenário A. */
  signal: Signal;
  savingsGoal: Cents;
}

export function signalFor(projectedSavings: Cents, savingsGoal: Cents): Signal {
  if (projectedSavings >= savingsGoal) return "green";
  if (projectedSavings >= 0) return "yellow";
  return "red";
}

function projectVariable(summary: MonthSummary, dailyRate: Cents): Cents {
  const { context, variableSpent, variableSpentBeforeToday, variableSpentToday } = summary;
  switch (context.phase) {
    case "past":
      return variableSpent;
    case "future":
      return variableSpent + dailyRate * context.daysInMonth;
    case "current": {
      // Lançamentos variáveis realizados com data futura (raro) entram como estão.
      const after = variableSpent - variableSpentBeforeToday - variableSpentToday;
      // Hoje conta pelo maior entre o que já foi gasto e o ritmo assumido.
      const todayProjected = Math.max(variableSpentToday, dailyRate);
      return (
        variableSpentBeforeToday + todayProjected + dailyRate * (context.remainingDays - 1) + after
      );
    }
  }
}

function scenario(summary: MonthSummary, dailyRate: Cents): Scenario {
  const projectedVariable = projectVariable(summary, dailyRate);
  return {
    dailyRate,
    projectedVariable,
    projectedSavings: summary.income - summary.committed - projectedVariable,
  };
}

/**
 * Rolling forecast do fechamento do mês:
 * realizado até hoje + previsto restante (fixos, parcelas — já dentro de
 * `committed`) + projeção dos variáveis para os dias restantes.
 */
export function forecastMonth(
  summary: MonthSummary,
  previousMonthDailyAverage?: Cents | null,
): Forecast {
  const { context } = summary;
  let paceRate: Cents;
  let paceSource: Forecast["paceSource"];
  if (context.phase !== "future" && context.elapsedDays >= MIN_DAYS_FOR_PACE) {
    paceRate = Math.round(summary.variableSpentBeforeToday / context.elapsedDays);
    paceSource = "month";
  } else if (previousMonthDailyAverage != null) {
    paceRate = previousMonthDailyAverage;
    paceSource = "previous_month";
  } else {
    paceRate = Math.max(0, summary.initialDailyGoal);
    paceSource = "goal";
  }

  const pace = scenario(summary, paceRate);
  const goal = scenario(summary, Math.max(0, summary.dynamicDailyGoal));
  return {
    pace,
    paceSource,
    goal,
    signal: signalFor(pace.projectedSavings, summary.savingsGoal),
    savingsGoal: summary.savingsGoal,
  };
}
