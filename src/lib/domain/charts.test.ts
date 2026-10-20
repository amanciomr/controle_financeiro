import { describe, expect, it } from "vitest";
import { type BudgetEntry, summarizeMonth } from "./budget";
import { categoryComparison, cumulativeSeries, dailyBars, spendingByPerson } from "./charts";
import { buildDailyTable } from "./daily-table";
import { forecastMonth } from "./forecast";

const entries: BudgetEntry[] = [
  { date: "2026-02-01", amount: 280000, type: "income", status: "done", nature: "fixed" },
  { date: "2026-02-02", amount: 10000, type: "expense", status: "done", nature: "variable" },
  { date: "2026-02-03", amount: 20000, type: "expense", status: "done", nature: "variable" },
  { date: "2026-02-04", amount: 30000, type: "expense", status: "done", nature: "variable" },
];

describe("cumulativeSeries", () => {
  const summary = summarizeMonth({ month: "2026-02", today: "2026-02-05", entries });
  const forecast = forecastMonth(summary);
  const rows = buildDailyTable({ summary, entries, accounts: [], movements: [] });
  const series = cumulativeSeries(rows, summary, forecast);

  it("tem um ponto por dia e a meta termina no disponível", () => {
    expect(series).toHaveLength(28);
    expect(series[27].goal).toBe(summary.available);
    expect(series[0].goal).toBe(Math.round(280000 / 28));
  });

  it("realizado até hoje; projeção a partir de hoje no ritmo atual", () => {
    expect(series[3].realized).toBe(60000);
    expect(series[4].realized).toBe(60000);
    expect(series[5].realized).toBeNull();
    expect(series[3].projection).toBeNull();
    expect(series[4].projection).toBe(60000);
    expect(series[27].projection).toBe(60000 + forecast.pace.dailyRate * 23);
  });

  it("mês passado não tem projeção", () => {
    const past = summarizeMonth({ month: "2026-02", today: "2026-03-10", entries });
    const pastRows = buildDailyTable({ summary: past, entries, accounts: [], movements: [] });
    expect(
      cumulativeSeries(pastRows, past, forecastMonth(past)).every((p) => p.projection === null),
    ).toBe(true);
  });

  it("barras por dia trazem gasto e meta", () => {
    expect(dailyBars(rows)[1]).toEqual({ day: 2, spent: 10000, goal: rows[1].goal });
    expect(dailyBars(rows)[10].spent).toBeNull();
  });
});

describe("categoryComparison", () => {
  const items = [
    { date: "2026-10-05", amount: 500, categoryId: "mercado" },
    { date: "2026-09-05", amount: 300, categoryId: "mercado" },
    { date: "2026-08-05", amount: 600, categoryId: "mercado" },
    { date: "2026-07-05", amount: 0, categoryId: "mercado" },
    { date: "2026-10-01", amount: 100, categoryId: "lazer" },
    { date: "2026-06-01", amount: 9999, categoryId: "lazer" }, // fora da janela
  ];

  it("compara o mês com a média dos meses anteriores", () => {
    const result = categoryComparison(items, "2026-10", ["2026-09", "2026-08", "2026-07"]);
    expect(result).toEqual([
      { categoryId: "mercado", current: 500, average: 300 },
      { categoryId: "lazer", current: 100, average: 0 },
    ]);
  });

  it("junta as menores em 'other'", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      date: "2026-10-01",
      amount: (i + 1) * 100,
      categoryId: `c${i}`,
    }));
    const result = categoryComparison(many, "2026-10", ["2026-09"], 4);
    expect(result).toHaveLength(4);
    expect(result[3]).toEqual({
      categoryId: "other",
      current: 100 + 200 + 300 + 400 + 500,
      average: 0,
    });
  });
});

describe("spendingByPerson", () => {
  it("soma por pessoa e casa", () => {
    expect(
      spendingByPerson([
        { amount: 100, personUserId: "a" },
        { amount: 50, personUserId: null },
        { amount: 200, personUserId: "a" },
      ]),
    ).toEqual([
      { personUserId: "a", total: 300 },
      { personUserId: null, total: 50 },
    ]);
  });
});
