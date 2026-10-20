import { describe, expect, it } from "vitest";
import {
  limitUsed,
  planInstallments,
  statementForDueMonth,
  statementForPurchase,
  statementStatus,
} from "./card";

// Fecha dia 3, vence dia 10 (mesmo mês).
const nubank = { closingDay: 3, dueDay: 10 };
// Fecha dia 25, vence dia 5 do mês seguinte.
const itau = { closingDay: 25, dueDay: 5 };

describe("statementForPurchase", () => {
  it("compra antes do fechamento entra na fatura do mês", () => {
    expect(statementForPurchase("2026-10-02", nubank)).toEqual({
      month: "2026-10",
      openingDate: "2026-09-03",
      closingDate: "2026-10-03",
      dueDate: "2026-10-10",
    });
  });

  it("compra no dia do fechamento vai para a fatura seguinte", () => {
    expect(statementForPurchase("2026-10-03", nubank).month).toBe("2026-11");
    expect(statementForPurchase("2026-10-25", itau).month).toBe("2026-12");
  });

  it("vencimento no mês seguinte ao fechamento", () => {
    expect(statementForPurchase("2026-10-24", itau)).toEqual({
      month: "2026-11",
      openingDate: "2026-09-25",
      closingDate: "2026-10-25",
      dueDate: "2026-11-05",
    });
  });

  it("compra no fim do ano cai na fatura de janeiro", () => {
    expect(statementForPurchase("2026-12-26", itau).dueDate).toBe("2027-02-05");
    expect(statementForPurchase("2026-12-20", itau).dueDate).toBe("2027-01-05");
    expect(statementForPurchase("2026-12-31", nubank).dueDate).toBe("2027-01-10");
  });

  it("fechamento dia 31 em fevereiro usa o último dia do mês", () => {
    const card = { closingDay: 31, dueDay: 10 };
    expect(statementForPurchase("2026-02-27", card).closingDate).toBe("2026-02-28");
    expect(statementForPurchase("2026-02-28", card).closingDate).toBe("2026-03-31");
    expect(statementForPurchase("2028-02-28", card).closingDate).toBe("2028-02-29");
  });

  it("compra em todos os dias do mês cai numa fatura que a contém", () => {
    for (const card of [
      nubank,
      itau,
      { closingDay: 31, dueDay: 8 },
      { closingDay: 10, dueDay: 10 },
    ]) {
      for (let d = 1; d <= 31; d++) {
        const date = `2026-01-${String(d).padStart(2, "0")}`;
        const st = statementForPurchase(date, card);
        expect(date >= st.openingDate && date < st.closingDate).toBe(true);
        expect(
          st.dueDate > st.closingDate || st.dueDate.slice(0, 7) > st.closingDate.slice(0, 7),
        ).toBe(true);
      }
    }
  });
});

describe("statementForDueMonth", () => {
  it("é consistente com statementForPurchase", () => {
    const st = statementForPurchase("2026-10-15", itau);
    expect(statementForDueMonth(st.month, itau)).toEqual(st);
  });
});

describe("planInstallments", () => {
  it("divide sem perder centavos e põe o resto nas primeiras", () => {
    const parts = planInstallments({
      purchaseDate: "2026-10-20",
      total: 100000,
      count: 3,
      card: nubank,
    });
    expect(parts.map((p) => p.amount)).toEqual([33334, 33333, 33333]);
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(100000);
  });

  it("competência mês a mês e uma fatura por parcela", () => {
    const parts = planInstallments({
      purchaseDate: "2026-10-20",
      total: 30000,
      count: 3,
      card: nubank,
    });
    expect(parts.map((p) => [p.number, p.date, p.statement.dueDate])).toEqual([
      [1, "2026-10-20", "2026-11-10"],
      [2, "2026-11-20", "2026-12-10"],
      [3, "2026-12-20", "2027-01-10"],
    ]);
  });

  it("parcela de compra no dia 31 cai no último dia dos meses curtos", () => {
    const parts = planInstallments({
      purchaseDate: "2027-01-31",
      total: 300,
      count: 3,
      card: itau,
    });
    expect(parts.map((p) => p.date)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });

  it("parcela que cruza o ano", () => {
    const parts = planInstallments({
      purchaseDate: "2026-11-10",
      total: 1200,
      count: 4,
      card: itau,
    });
    expect(parts.map((p) => p.statement.month)).toEqual([
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
    ]);
  });

  it("à vista é uma parcela só", () => {
    expect(
      planInstallments({ purchaseDate: "2026-10-20", total: 999, count: 1, card: nubank }),
    ).toHaveLength(1);
  });

  it("rejeita número de parcelas inválido", () => {
    expect(() =>
      planInstallments({ purchaseDate: "2026-10-20", total: 1, count: 0, card: nubank }),
    ).toThrow();
  });
});

describe("statementStatus", () => {
  const st = statementForDueMonth("2026-11", nubank); // 03/10 a 02/11, vence 10/11
  it("futura, aberta, fechada, vencida e paga", () => {
    expect(statementStatus(st, "2026-09-20", false)).toBe("future");
    expect(statementStatus(st, "2026-10-03", false)).toBe("open");
    expect(statementStatus(st, "2026-11-02", false)).toBe("open");
    expect(statementStatus(st, "2026-11-03", false)).toBe("closed");
    expect(statementStatus(st, "2026-11-10", false)).toBe("closed");
    expect(statementStatus(st, "2026-11-11", false)).toBe("overdue");
    expect(statementStatus(st, "2026-11-11", true)).toBe("paid");
  });
});

describe("limitUsed", () => {
  it("soma só o que está em faturas não pagas", () => {
    const items = [
      { dueMonth: "2026-10", amount: 100 },
      { dueMonth: "2026-11", amount: 200 },
      { dueMonth: "2026-12", amount: 300 },
    ];
    expect(limitUsed(items, new Set(["2026-10"]))).toBe(500);
    expect(limitUsed(items, new Set())).toBe(600);
  });
});
