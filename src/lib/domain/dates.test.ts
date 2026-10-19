import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  addMonthsToDate,
  clampedDate,
  datesOfMonth,
  daysInMonth,
  diffDays,
  diffMonths,
  formatDateBR,
  formatMonthBR,
  formatWeekdayShort,
  isISODate,
  monthEnd,
  parseDateBR,
  todayIn,
  weekday,
} from "./dates";

describe("daysInMonth", () => {
  it("cobre meses de 28, 29, 30 e 31 dias", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28); // não bissexto (divisível por 100)
    expect(daysInMonth(2000, 2)).toBe(29); // bissexto (divisível por 400)
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe("clampedDate", () => {
  it("usa o último dia quando o mês é mais curto", () => {
    expect(clampedDate(2026, 2, 31)).toBe("2026-02-28");
    expect(clampedDate(2028, 2, 31)).toBe("2028-02-29");
    expect(clampedDate(2026, 4, 31)).toBe("2026-04-30");
    expect(clampedDate(2026, 1, 31)).toBe("2026-01-31");
  });
});

describe("aritmética de datas", () => {
  it("addDays cruza mês e ano", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("diffDays", () => {
    expect(diffDays("2027-01-01", "2026-12-31")).toBe(1);
    expect(diffDays("2026-10-01", "2026-10-19")).toBe(-18);
  });

  it("addMonths cruza o ano nos dois sentidos", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-01", -13)).toBe("2024-12");
    expect(addMonths("2026-10", 0)).toBe("2026-10");
  });

  it("diffMonths", () => {
    expect(diffMonths("2027-01", "2026-11")).toBe(2);
    expect(diffMonths("2026-01", "2026-03")).toBe(-2);
  });

  it("addMonthsToDate limita ao fim do mês", () => {
    expect(addMonthsToDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToDate("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonthsToDate("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonthsToDate("2026-11-30", 3, 31)).toBe("2027-02-28");
  });

  it("weekday (0 = domingo)", () => {
    expect(weekday("2026-10-18")).toBe(0);
    expect(weekday("2026-10-19")).toBe(1);
    expect(formatWeekdayShort("2026-10-24")).toBe("sáb");
  });

  it("monthEnd e datesOfMonth", () => {
    expect(monthEnd("2026-02")).toBe("2026-02-28");
    expect(monthEnd("2028-02")).toBe("2028-02-29");
    const days = datesOfMonth("2026-10");
    expect(days).toHaveLength(31);
    expect(days[0]).toBe("2026-10-01");
    expect(days[30]).toBe("2026-10-31");
  });
});

describe("todayIn", () => {
  it("usa o fuso da Bahia, não o UTC do servidor", () => {
    // 02:00 UTC do dia 20 ainda é 23:00 do dia 19 na Bahia (UTC−3).
    expect(todayIn("America/Bahia", new Date("2026-10-20T02:00:00Z"))).toBe("2026-10-19");
    expect(todayIn("America/Bahia", new Date("2026-10-20T03:00:00Z"))).toBe("2026-10-20");
  });

  it("vira o ano corretamente", () => {
    expect(todayIn("America/Bahia", new Date("2027-01-01T02:59:59Z"))).toBe("2026-12-31");
  });
});

describe("validação e formatação", () => {
  it("isISODate", () => {
    expect(isISODate("2026-02-28")).toBe(true);
    expect(isISODate("2026-02-29")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("19/10/2026")).toBe(false);
  });

  it("parseDateBR", () => {
    expect(parseDateBR("19/10/2026")).toBe("2026-10-19");
    expect(parseDateBR("1/2/2026")).toBe("2026-02-01");
    expect(parseDateBR("2026-10-19")).toBe("2026-10-19");
    expect(parseDateBR("31/02/2026")).toBeNull();
    expect(parseDateBR("ontem")).toBeNull();
  });

  it("formata em pt-BR", () => {
    expect(formatDateBR("2026-10-05")).toBe("05/10/2026");
    expect(formatMonthBR("2026-03")).toBe("março de 2026");
  });
});
