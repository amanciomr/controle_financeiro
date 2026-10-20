import { describe, expect, it } from "vitest";
import {
  dailyVariableAverage,
  expenseBucket,
  monthContext,
  savingsGoalAmount,
  summarizeMonth,
} from "./budget";
import { fixed, income, october, variable } from "./test-fixtures";

describe("monthContext", () => {
  it("mês corrente conta dias decorridos e restantes (incluindo hoje)", () => {
    expect(monthContext("2026-10", "2026-10-19")).toMatchObject({
      phase: "current",
      daysInMonth: 31,
      elapsedDays: 18,
      remainingDays: 13,
    });
  });

  it("primeiro e último dia do mês", () => {
    expect(monthContext("2026-10", "2026-10-01")).toMatchObject({
      elapsedDays: 0,
      remainingDays: 31,
    });
    expect(monthContext("2026-10", "2026-10-31")).toMatchObject({
      elapsedDays: 30,
      remainingDays: 1,
    });
  });

  it("fevereiro com 28 e 29 dias", () => {
    expect(monthContext("2026-02", "2026-02-28")).toMatchObject({
      daysInMonth: 28,
      remainingDays: 1,
    });
    expect(monthContext("2028-02", "2028-02-28")).toMatchObject({
      daysInMonth: 29,
      remainingDays: 2,
    });
  });

  it("meses passados e futuros", () => {
    expect(monthContext("2026-09", "2026-10-19")).toMatchObject({
      phase: "past",
      remainingDays: 0,
    });
    expect(monthContext("2026-11", "2026-10-19")).toMatchObject({
      phase: "future",
      elapsedDays: 0,
      remainingDays: 30,
    });
    expect(monthContext("2025-12", "2026-01-01")).toMatchObject({ phase: "past" });
  });
});

describe("expenseBucket", () => {
  it("fixo é sempre comprometido", () => {
    expect(expenseBucket(fixed("2026-10-01", 1))).toBe("committed");
    expect(expenseBucket(fixed("2026-10-01", 1, "planned"))).toBe("committed");
  });

  it("variável previsto é comprometido; realizado é variável", () => {
    expect(expenseBucket(variable("2026-10-01", 1, "planned"))).toBe("committed");
    expect(expenseBucket(variable("2026-10-01", 1))).toBe("variable");
  });

  it("recorrência é comprometido mesmo em categoria variável (ex.: parcelas de viagem)", () => {
    expect(expenseBucket({ ...variable("2026-10-01", 1), recurring: true })).toBe("committed");
  });

  it("parcela antiga de cartão é comprometido", () => {
    expect(expenseBucket({ ...variable("2026-10-01", 1), installmentCarry: true })).toBe(
      "committed",
    );
  });
});

describe("savingsGoalAmount", () => {
  it("valor fixo, percentual e ausente", () => {
    expect(savingsGoalAmount({ mode: "amount", value: 50000 }, 1000000)).toBe(50000);
    expect(savingsGoalAmount({ mode: "percent", value: 1000 }, 1400000)).toBe(140000);
    expect(savingsGoalAmount(null, 1000000)).toBe(0);
  });

  it("percentual de receita negativa não vira meta negativa", () => {
    expect(savingsGoalAmount({ mode: "percent", value: 1000 }, -500)).toBe(0);
  });
});

describe("summarizeMonth", () => {
  const summary = summarizeMonth({
    month: "2026-10",
    today: "2026-10-19",
    entries: october,
    savingsGoal: { mode: "percent", value: 1000 },
  });

  it("soma receitas previstas e realizadas", () => {
    expect(summary).toMatchObject({ income: 1400000, incomeDone: 800000, incomePlanned: 600000 });
  });

  it("comprometido inclui fixos e previstos (ignora pulados e outros meses)", () => {
    expect(summary).toMatchObject({
      committed: 380000,
      committedDone: 300000,
      committedPlanned: 80000,
    });
  });

  it("disponível e meta diária inicial", () => {
    expect(summary.savingsGoal).toBe(140000);
    expect(summary.available).toBe(880000);
    expect(summary.initialDailyGoal).toBe(28387); // 880000 / 31
  });

  it("meta dinâmica usa o gasto até ontem e os dias restantes incluindo hoje", () => {
    expect(summary.variableSpentBeforeToday).toBe(62000);
    expect(summary.variableSpentToday).toBe(3000);
    expect(summary.dynamicDailyGoal).toBe(62923); // (880000 − 62000) / 13
    expect(summary.canSpendToday).toBe(59923);
    expect(summary.remainingAvailable).toBe(815000);
  });

  it("gastar hoje não muda a meta de hoje, só o quanto ainda pode gastar", () => {
    const more = summarizeMonth({
      month: "2026-10",
      today: "2026-10-19",
      entries: [...october, variable("2026-10-19", 10000)],
      savingsGoal: { mode: "percent", value: 1000 },
    });
    expect(more.dynamicDailyGoal).toBe(summary.dynamicDailyGoal);
    expect(more.canSpendToday).toBe(summary.canSpendToday - 10000);
  });

  it("no último dia do mês a meta é todo o saldo restante", () => {
    const s = summarizeMonth({
      month: "2026-10",
      today: "2026-10-31",
      entries: [income("2026-10-01", 310000), variable("2026-10-10", 10000)],
    });
    expect(s.dynamicDailyGoal).toBe(300000);
    expect(s.canSpendToday).toBe(300000);
  });

  it("fevereiro de 28 dias divide por 28; de 29 dias, por 29", () => {
    const entries = [income("2026-02-01", 280000)];
    expect(
      summarizeMonth({ month: "2026-02", today: "2026-02-01", entries }).initialDailyGoal,
    ).toBe(10000);
    const leap = [income("2028-02-01", 290000)];
    expect(
      summarizeMonth({ month: "2028-02", today: "2028-02-01", entries: leap }).initialDailyGoal,
    ).toBe(10000);
  });

  it("mês passado não tem meta de hoje", () => {
    const s = summarizeMonth({ month: "2026-10", today: "2026-11-05", entries: october });
    expect(s.dynamicDailyGoal).toBe(0);
    expect(s.canSpendToday).toBe(0);
    expect(s.variableSpent).toBe(65000);
    expect(s.variableSpentBeforeToday).toBe(65000);
  });

  it("mês futuro usa a meta inicial como meta dinâmica", () => {
    const s = summarizeMonth({
      month: "2026-11",
      today: "2026-10-19",
      entries: [income("2026-11-05", 300000, "planned")],
    });
    expect(s.dynamicDailyGoal).toBe(10000);
    expect(s.initialDailyGoal).toBe(10000);
    expect(s.canSpendToday).toBe(0);
  });

  it("estouro deixa a meta dinâmica negativa", () => {
    const s = summarizeMonth({
      month: "2026-10",
      today: "2026-10-30",
      entries: [income("2026-10-01", 100000), variable("2026-10-02", 150000)],
    });
    expect(s.dynamicDailyGoal).toBe(-25000);
    expect(s.canSpendToday).toBe(-25000);
  });

  it("sem lançamentos tudo é zero", () => {
    const s = summarizeMonth({ month: "2026-10", today: "2026-10-19", entries: [] });
    expect(s.available).toBe(0);
    expect(s.dynamicDailyGoal).toBe(0);
  });
});

describe("dailyVariableAverage", () => {
  it("média do gasto variável do mês", () => {
    expect(dailyVariableAverage(october, "2026-10")).toBe(Math.round(65000 / 31));
    expect(dailyVariableAverage(october, "2026-09")).toBe(Math.round(77777 / 30));
  });
});
