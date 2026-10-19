import { describe, expect, it } from "vitest";
import {
  applyBasisPoints,
  centsToInput,
  digitsToCents,
  formatBRL,
  formatDecimal,
  parseBRL,
  splitEvenly,
} from "./money";

describe("formatBRL", () => {
  it("formata com separadores pt-BR", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
    expect(formatBRL(5)).toBe("R$ 0,05");
    expect(formatBRL(0)).toBe("R$ 0,00");
    expect(formatBRL(100000000)).toBe("R$ 1.000.000,00");
  });

  it("formata sem símbolo para tabelas", () => {
    expect(formatDecimal(123456)).toBe("1.234,56");
    expect(formatDecimal(-5)).toBe("-0,05");
  });

  it("formata negativos", () => {
    expect(formatBRL(-1050)).toBe("-R$ 10,50");
  });
});

describe("centsToInput", () => {
  it("gera texto editável", () => {
    expect(centsToInput(123456)).toBe("1234,56");
    expect(centsToInput(7)).toBe("0,07");
    expect(centsToInput(-250)).toBe("-2,50");
  });
});

describe("digitsToCents", () => {
  it("trata cada dígito como centavo", () => {
    expect(digitsToCents("1234")).toBe(1234);
    expect(digitsToCents("0005")).toBe(5);
    expect(digitsToCents("")).toBe(0);
    expect(digitsToCents("R$ 12,34")).toBe(1234);
  });

  it("limita o tamanho para manter inteiro seguro", () => {
    expect(digitsToCents("9".repeat(20))).toBe(9_999_999_999_999);
  });
});

describe("parseBRL", () => {
  it.each([
    ["12", 1200],
    ["12,5", 1250],
    ["12,50", 1250],
    ["0,07", 7],
    ["1.234,56", 123456],
    ["1.234", 123400],
    ["1234,56", 123456],
    ["R$ 1.234,56", 123456],
    ["12.5", 1250],
    ["12.50", 1250],
    ["-3,00", -300],
    ["-R$ 3,00", -300],
    [" 10 ", 1000],
  ])("%s → %d", (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });

  it.each(["", "abc", "1,2,3", "12,345", "1.23.4,00", "12.345.6"])("rejeita %s", (input) => {
    expect(parseBRL(input)).toBeNull();
  });

  it("nunca sofre erro de ponto flutuante", () => {
    // 0,1 + 0,2 em float daria 0.30000000000000004
    expect(parseBRL("0,10")! + parseBRL("0,20")!).toBe(30);
    expect(parseBRL("19,99")).toBe(1999);
    expect(parseBRL("1.000.000,01")).toBe(100000001);
  });
});

describe("splitEvenly", () => {
  it("soma exatamente o total", () => {
    expect(splitEvenly(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEvenly(900, 3)).toEqual([300, 300, 300]);
    expect(splitEvenly(1, 3)).toEqual([1, 0, 0]);
  });

  it("funciona com negativos", () => {
    const parts = splitEvenly(-1000, 3);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(-1000);
    expect(parts).toEqual([-333, -333, -334]);
  });

  it("rejeita partes inválidas", () => {
    expect(() => splitEvenly(100, 0)).toThrow();
  });
});

describe("applyBasisPoints", () => {
  it("aplica percentual", () => {
    expect(applyBasisPoints(1000000, 1000)).toBe(100000); // 10%
    expect(applyBasisPoints(333, 5000)).toBe(167); // 50% arredondado
  });
});
