import { describe, expect, it } from "vitest";
import { type BudgetEntry, summarizeMonth } from "./budget";
import { october } from "./test-fixtures";
import { forecastMonth, signalFor } from "./forecast";

const goal = { mode: "percent", value: 1000 } as const;

describe("forecastMonth", () => {
  const summary = summarizeMonth({
    month: "2026-10",
    today: "2026-10-19",
    entries: october,
    savingsGoal: goal,
  });
  const f = forecastMonth(summary);

  it("cenário A projeta o ritmo médio até ontem para os dias restantes", () => {
    expect(f.paceSource).toBe("month");
    expect(f.pace.dailyRate).toBe(3444); // 62000 / 18
    // 62000 + max(3000, 3444) + 3444 × 12
    expect(f.pace.projectedVariable).toBe(106772);
    expect(f.pace.projectedSavings).toBe(1400000 - 380000 - 106772);
    expect(f.signal).toBe("green");
  });

  it("cenário B (cumprindo a meta) fecha praticamente na meta de poupança", () => {
    expect(f.goal.dailyRate).toBe(62923);
    expect(f.goal.projectedSavings).toBe(140001);
    expect(f.goal.projectedSavings).toBeGreaterThanOrEqual(summary.savingsGoal);
  });

  it("se hoje já passou do ritmo, usa o gasto real de hoje", () => {
    const entries: BudgetEntry[] = [
      ...october,
      { date: "2026-10-19", amount: 50000, type: "expense", status: "done", nature: "variable" },
    ];
    const s = summarizeMonth({ month: "2026-10", today: "2026-10-19", entries, savingsGoal: goal });
    expect(forecastMonth(s).pace.projectedVariable).toBe(62000 + 53000 + 3444 * 12);
  });

  it("nos primeiros dias usa a média do mês anterior", () => {
    const s = summarizeMonth({
      month: "2026-10",
      today: "2026-10-02",
      entries: october,
      savingsGoal: goal,
    });
    const early = forecastMonth(s, 4000);
    expect(early.paceSource).toBe("previous_month");
    expect(early.pace.dailyRate).toBe(4000);
  });

  it("sem histórico, nos primeiros dias usa a meta inicial", () => {
    const s = summarizeMonth({
      month: "2026-10",
      today: "2026-10-03",
      entries: october,
      savingsGoal: goal,
    });
    const early = forecastMonth(s, null);
    expect(early.paceSource).toBe("goal");
    expect(early.pace.dailyRate).toBe(s.initialDailyGoal);
  });

  it("no 4º dia (3 dias completos) já usa o próprio mês", () => {
    const s = summarizeMonth({
      month: "2026-10",
      today: "2026-10-04",
      entries: october,
      savingsGoal: goal,
    });
    expect(forecastMonth(s, 4000).paceSource).toBe("month");
  });

  it("mês passado: a projeção é o realizado", () => {
    const s = summarizeMonth({
      month: "2026-10",
      today: "2026-11-10",
      entries: october,
      savingsGoal: goal,
    });
    const past = forecastMonth(s);
    expect(past.pace.projectedVariable).toBe(65000);
    expect(past.goal.projectedVariable).toBe(65000);
  });

  it("mês futuro projeta o mês inteiro", () => {
    const entries: BudgetEntry[] = [
      { date: "2026-11-05", amount: 300000, type: "income", status: "planned", nature: "fixed" },
    ];
    const s = summarizeMonth({ month: "2026-11", today: "2026-10-19", entries });
    const future = forecastMonth(s, 2000);
    expect(future.pace.projectedVariable).toBe(2000 * 30);
    expect(future.goal.projectedVariable).toBe(10000 * 30);
  });

  it("estouro: cenário B não assume gasto negativo e o semáforo fica vermelho", () => {
    const entries: BudgetEntry[] = [
      { date: "2026-10-01", amount: 100000, type: "income", status: "done", nature: "fixed" },
      { date: "2026-10-02", amount: 150000, type: "expense", status: "done", nature: "variable" },
    ];
    const s = summarizeMonth({ month: "2026-10", today: "2026-10-30", entries });
    const over = forecastMonth(s);
    expect(over.goal.dailyRate).toBe(0);
    expect(over.goal.projectedSavings).toBe(-50000);
    expect(over.signal).toBe("red");
  });
});

describe("signalFor", () => {
  it("verde ≥ meta, amarelo entre 0 e a meta, vermelho negativo", () => {
    expect(signalFor(100, 100)).toBe("green");
    expect(signalFor(99, 100)).toBe("yellow");
    expect(signalFor(0, 100)).toBe("yellow");
    expect(signalFor(-1, 100)).toBe("red");
    expect(signalFor(0, 0)).toBe("green");
  });
});

describe("parcelas recorrentes em categoria variável", () => {
  it("não inflam o ritmo de gasto do dia a dia", () => {
    const base: BudgetEntry[] = [
      { date: "2026-10-01", amount: 1000000, type: "income", status: "done", nature: "fixed" },
      { date: "2026-10-02", amount: 3000, type: "expense", status: "done", nature: "variable" },
    ];
    // Parcela de viagem já confirmada, gerada por recorrência, em categoria variável.
    const installment: BudgetEntry = {
      date: "2026-10-01",
      amount: 100000,
      type: "expense",
      status: "done",
      nature: "variable",
      recurring: true,
    };
    const s = summarizeMonth({
      month: "2026-10",
      today: "2026-10-11",
      entries: [...base, installment],
    });
    expect(s.committed).toBe(100000);
    expect(s.variableSpent).toBe(3000);
    expect(forecastMonth(s).pace.dailyRate).toBe(300); // 3000 / 10 dias, sem a parcela
  });
});
