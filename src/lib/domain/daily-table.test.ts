import { describe, expect, it } from "vitest";
import { balanceBefore, type CashMovement } from "./balance";
import { type BudgetEntry, summarizeMonth } from "./budget";
import { buildDailyTable } from "./daily-table";

const e = (
  date: string,
  amount: number,
  type: BudgetEntry["type"],
  nature: BudgetEntry["nature"],
  status: BudgetEntry["status"] = "done",
): BudgetEntry => ({ date, amount, type, nature, status });

const toMovements = (entries: BudgetEntry[]): CashMovement[] =>
  entries
    .filter((x) => x.status !== "skipped")
    .map((x) => ({ date: x.date, amount: x.type === "income" ? x.amount : -x.amount }));

describe("balanceBefore", () => {
  const accounts = [
    { id: "a", openingBalance: 100000, openingDate: "2026-09-01" },
    { id: "b", openingBalance: 50000, openingDate: "2026-10-10" },
  ];
  const movements: CashMovement[] = [
    { date: "2026-08-15", amount: -99999, accountId: "a" }, // antes da abertura: ignorado
    { date: "2026-09-05", amount: -20000, accountId: "a" },
    { date: "2026-10-05", amount: -1000, accountId: "b" }, // antes da abertura de b
    { date: "2026-10-12", amount: -5000, accountId: "b" },
    { date: "2026-09-20", amount: 3000 }, // sem conta: conta a partir da mais antiga
  ];

  it("soma abertura das contas e movimentos válidos antes da data", () => {
    expect(balanceBefore("2026-10-01", accounts, movements)).toBe(100000 - 20000 + 3000);
    expect(balanceBefore("2026-10-10", accounts, movements)).toBe(100000 - 20000 + 3000 + 50000);
    expect(balanceBefore("2026-10-13", accounts, movements)).toBe(
      100000 - 20000 + 3000 + 50000 - 5000,
    );
  });

  it("sem contas, acumula a partir do zero informado", () => {
    expect(balanceBefore("2026-10-13", [], movements, "2026-10-01")).toBe(-1000 - 5000);
  });
});

describe("buildDailyTable", () => {
  // Fevereiro/2026 (28 dias), hoje = 10/02.
  const entries: BudgetEntry[] = [
    e("2026-02-05", 280000, "income", "fixed"),
    e("2026-02-10", 56000, "expense", "fixed", "planned"), // aluguel previsto hoje
    e("2026-02-01", 5000, "expense", "variable"),
    e("2026-02-03", 15000, "expense", "variable"),
    e("2026-02-10", 2000, "expense", "variable"),
    e("2026-02-20", 30000, "expense", "fixed", "planned"),
  ];
  const summary = summarizeMonth({ month: "2026-02", today: "2026-02-10", entries });
  const accounts = [{ id: "a", openingBalance: 100000, openingDate: "2026-01-01" }];
  const rows = buildDailyTable({ summary, entries, accounts, movements: toMovements(entries) });

  it("tem uma linha por dia do mês", () => {
    expect(rows).toHaveLength(28);
    expect(rows[0].date).toBe("2026-02-01");
    expect(rows[27].date).toBe("2026-02-28");
    expect(rows[8].phase).toBe("past");
    expect(rows[9].phase).toBe("today");
    expect(rows[10].phase).toBe("future");
  });

  it("meta dos dias passados é recalculada dia a dia", () => {
    // disponível = 280000 − 86000 = 194000
    expect(summary.available).toBe(194000);
    expect(rows[0].goal).toBe(Math.floor(194000 / 28)); // 6928
    expect(rows[1].goal).toBe(Math.floor((194000 - 5000) / 27)); // 7000
    expect(rows[3].goal).toBe(Math.floor((194000 - 20000) / 25));
  });

  it("hoje e os dias futuros usam a meta dinâmica de hoje", () => {
    expect(rows[9].goal).toBe(summary.dynamicDailyGoal);
    expect(rows[27].goal).toBe(summary.dynamicDailyGoal);
  });

  it("realizado, diferença, acumulados e desvio", () => {
    expect(rows[0]).toMatchObject({ spent: 5000, difference: 6928 - 5000 });
    expect(rows[2].accumulatedSpent).toBe(20000);
    expect(rows[2].deviation).toBe(rows[2].accumulatedGoal - 20000);
    expect(rows[9].accumulatedSpent).toBe(22000);
  });

  it("dias futuros não têm realizado, mas mostram comprometidos agendados", () => {
    expect(rows[19]).toMatchObject({
      spent: null,
      difference: null,
      deviation: null,
      committed: 30000,
    });
    expect(rows[4].income).toBe(280000);
    expect(rows[9].committed).toBe(56000);
  });

  it("saldo projetado: movimentos de caixa e, no futuro, a meta como gasto", () => {
    expect(rows[0].balance).toBe(100000 - 5000);
    expect(rows[4].balance).toBe(100000 - 5000 - 15000 + 280000);
    const goal = summary.dynamicDailyGoal;
    const today = 100000 - 20000 + 280000 - 56000 - 2000 - (goal - 2000);
    expect(rows[9].balance).toBe(today);
    expect(rows[10].balance).toBe(today - goal);
    expect(rows[27].balance).toBe(today - goal * 18 - 30000);
  });

  it("mês passado: todos os dias são passados e o saldo final não tem projeção", () => {
    const past = summarizeMonth({ month: "2026-02", today: "2026-03-15", entries });
    const table = buildDailyTable({
      summary: past,
      entries,
      accounts,
      movements: toMovements(entries),
    });
    expect(table.every((r) => r.phase === "past")).toBe(true);
    expect(table[27].balance).toBe(100000 + 280000 - 56000 - 30000 - 22000);
    expect(table[27].accumulatedSpent).toBe(22000);
  });

  it("último dia do mês como hoje", () => {
    const last = summarizeMonth({ month: "2026-02", today: "2026-02-28", entries });
    const table = buildDailyTable({
      summary: last,
      entries,
      accounts,
      movements: toMovements(entries),
    });
    expect(table[27].phase).toBe("today");
    expect(table[27].goal).toBe(last.dynamicDailyGoal);
    expect(last.dynamicDailyGoal).toBe(194000 - 22000);
  });
});
