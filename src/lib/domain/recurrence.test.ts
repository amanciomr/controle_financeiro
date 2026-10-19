import { describe, expect, it } from "vitest";
import {
  financingStartDate,
  installmentOfMonth,
  installmentProgress,
  lastOccurrence,
  occurrencesBetween,
  type RecurrenceRule,
  validateRule,
} from "./recurrence";

const dates = (rule: RecurrenceRule, from: string, to: string) =>
  occurrencesBetween(rule, from, to).map((o) => o.date);

describe("recorrência mensal", () => {
  it("gera uma ocorrência por mês no dia fixo", () => {
    const rule: RecurrenceRule = { frequency: "monthly", dayOfMonth: 5, startDate: "2026-01-01" };
    expect(dates(rule, "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-05",
      "2026-02-05",
      "2026-03-05",
      "2026-04-05",
    ]);
  });

  it("dia 31 cai no último dia em meses curtos (28/29/30)", () => {
    const rule: RecurrenceRule = { frequency: "monthly", dayOfMonth: 31, startDate: "2026-01-01" };
    expect(dates(rule, "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
    const leap: RecurrenceRule = { frequency: "monthly", dayOfMonth: 30, startDate: "2028-01-01" };
    expect(dates(leap, "2028-02-01", "2028-03-31")).toEqual(["2028-02-29", "2028-03-30"]);
  });

  it("não gera antes da data inicial", () => {
    const rule: RecurrenceRule = { frequency: "monthly", dayOfMonth: 10, startDate: "2026-10-15" };
    expect(dates(rule, "2026-10-01", "2026-12-31")).toEqual(["2026-11-10", "2026-12-10"]);
  });

  it("respeita a data final", () => {
    const rule: RecurrenceRule = {
      frequency: "monthly",
      dayOfMonth: 10,
      startDate: "2026-01-01",
      endDate: "2026-03-09",
    };
    expect(dates(rule, "2026-01-01", "2026-12-31")).toEqual(["2026-01-10", "2026-02-10"]);
  });

  it("cruza a virada do ano", () => {
    const rule: RecurrenceRule = { frequency: "monthly", dayOfMonth: 15, startDate: "2026-11-01" };
    expect(dates(rule, "2026-11-01", "2027-02-28")).toEqual([
      "2026-11-15",
      "2026-12-15",
      "2027-01-15",
      "2027-02-15",
    ]);
  });

  it("usa o dia da data inicial quando o dia não é informado", () => {
    const rule: RecurrenceRule = { frequency: "monthly", startDate: "2026-10-20" };
    expect(dates(rule, "2026-10-01", "2026-11-30")).toEqual(["2026-10-20", "2026-11-20"]);
  });
});

describe("recorrência anual", () => {
  it("gera uma vez por ano", () => {
    const rule: RecurrenceRule = {
      frequency: "yearly",
      monthOfYear: 1,
      dayOfMonth: 20,
      startDate: "2026-01-01",
    };
    expect(dates(rule, "2026-01-01", "2028-12-31")).toEqual([
      "2026-01-20",
      "2027-01-20",
      "2028-01-20",
    ]);
  });

  it("29/02 vira 28/02 em anos não bissextos", () => {
    const rule: RecurrenceRule = {
      frequency: "yearly",
      monthOfYear: 2,
      dayOfMonth: 29,
      startDate: "2028-01-01",
    };
    expect(dates(rule, "2028-01-01", "2030-12-31")).toEqual([
      "2028-02-29",
      "2029-02-28",
      "2030-02-28",
    ]);
  });

  it("começa no ano seguinte se a data deste ano já passou", () => {
    const rule: RecurrenceRule = {
      frequency: "yearly",
      monthOfYear: 3,
      dayOfMonth: 1,
      startDate: "2026-10-19",
    };
    expect(dates(rule, "2026-01-01", "2027-12-31")).toEqual(["2027-03-01"]);
  });
});

describe("recorrência semanal", () => {
  it("gera toda semana no dia escolhido", () => {
    // 2026-10-19 é segunda; pedimos sexta (5).
    const rule: RecurrenceRule = { frequency: "weekly", weekday: 5, startDate: "2026-10-19" };
    expect(dates(rule, "2026-10-01", "2026-11-07")).toEqual([
      "2026-10-23",
      "2026-10-30",
      "2026-11-06",
    ]);
  });

  it("inclui a data inicial quando cai no dia da semana", () => {
    const rule: RecurrenceRule = { frequency: "weekly", weekday: 1, startDate: "2026-10-19" };
    expect(dates(rule, "2026-10-19", "2026-10-26")).toEqual(["2026-10-19", "2026-10-26"]);
  });

  it("cruza a virada do ano", () => {
    const rule: RecurrenceRule = { frequency: "weekly", weekday: 4, startDate: "2026-12-20" };
    expect(dates(rule, "2026-12-20", "2027-01-10")).toEqual([
      "2026-12-24",
      "2026-12-31",
      "2027-01-07",
    ]);
  });
});

describe("financiamento (nº de parcelas)", () => {
  const financing: RecurrenceRule = {
    frequency: "monthly",
    dayOfMonth: 10,
    startDate: "2026-11-01",
    totalInstallments: 3,
  };

  it("para depois da última parcela, inclusive cruzando o ano", () => {
    const occ = occurrencesBetween(financing, "2026-01-01", "2027-12-31");
    expect(occ).toEqual([
      { date: "2026-11-10", index: 1 },
      { date: "2026-12-10", index: 2 },
      { date: "2027-01-10", index: 3 },
    ]);
  });

  it("mantém o número da parcela quando consultamos um intervalo no meio", () => {
    expect(occurrencesBetween(financing, "2026-12-01", "2026-12-31")).toEqual([
      { date: "2026-12-10", index: 2 },
    ]);
  });

  it("calcula progresso e parcelas restantes", () => {
    expect(installmentProgress(financing, "2026-12-15")).toEqual({
      total: 3,
      elapsed: 2,
      remaining: 1,
      next: { date: "2027-01-10", index: 3 },
      last: { date: "2027-01-10", index: 3 },
    });
    expect(installmentProgress(financing, "2026-10-01")?.remaining).toBe(3);
    expect(installmentProgress(financing, "2027-06-01")).toMatchObject({
      elapsed: 3,
      remaining: 0,
      next: null,
    });
  });

  it("parcela no próprio dia conta como decorrida", () => {
    expect(installmentProgress(financing, "2026-11-10")?.elapsed).toBe(1);
  });

  it("retorna null para recorrência sem parcelas", () => {
    expect(
      installmentProgress({ frequency: "monthly", startDate: "2026-01-01" }, "2026-10-19"),
    ).toBeNull();
  });
});

describe("lastOccurrence", () => {
  it("é null para recorrência indeterminada", () => {
    expect(lastOccurrence({ frequency: "monthly", startDate: "2026-01-01" })).toBeNull();
  });

  it("usa a data final", () => {
    expect(
      lastOccurrence({
        frequency: "monthly",
        dayOfMonth: 31,
        startDate: "2026-01-01",
        endDate: "2026-02-28",
      }),
    ).toEqual({ date: "2026-02-28", index: 2 });
  });
});

describe("validateRule", () => {
  it("aceita regra válida", () => {
    expect(validateRule({ frequency: "monthly", dayOfMonth: 31, startDate: "2026-01-01" })).toEqual(
      [],
    );
  });

  it("aponta erros", () => {
    expect(
      validateRule({
        frequency: "monthly",
        dayOfMonth: 32,
        startDate: "2026-02-01",
        endDate: "2026-01-01",
        totalInstallments: 0,
      }),
    ).toHaveLength(3);
    expect(validateRule({ frequency: "weekly", weekday: 7, startDate: "2026-01-01" })).toHaveLength(
      1,
    );
    expect(
      validateRule({ frequency: "yearly", monthOfYear: 13, startDate: "2026-01-01" }),
    ).toHaveLength(1);
  });
});

describe("financingStartDate / installmentOfMonth", () => {
  it("parcela 23 deste mês → começou 22 meses atrás", () => {
    expect(financingStartDate("2026-10-19", 23)).toBe("2024-12-01");
    expect(installmentOfMonth("2024-12-01", "2026-10-19")).toBe(23);
  });

  it("a ocorrência deste mês recebe o número informado, inclusive no fim do mês", () => {
    const rule: RecurrenceRule = {
      frequency: "monthly",
      dayOfMonth: 31,
      startDate: financingStartDate("2026-02-28", 5),
      totalInstallments: 48,
    };
    expect(occurrencesBetween(rule, "2026-02-01", "2026-02-28")).toEqual([
      { date: "2026-02-28", index: 5 },
    ]);
  });

  it("parcela 1 começa no mês atual", () => {
    expect(financingStartDate("2027-01-05", 1)).toBe("2027-01-01");
  });
});
