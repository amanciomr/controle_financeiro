/**
 * Valores monetários são sempre inteiros em centavos. Nunca usar float para
 * guardar ou somar dinheiro: só convertemos para reais na hora de exibir.
 */
export type Cents = number;

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function assertCents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Valor em centavos inválido: ${value}`);
  }
  return value;
}

/** 123456 → "R$ 1.234,56" (com espaço normal, não o NBSP do Intl). */
export function formatBRL(cents: Cents): string {
  return brl.format(cents / 100).replace(/ /g, " ");
}

/** 123456 → "R$ 1.235" — para eixos de gráfico e espaços apertados. */
export function formatBRLCompact(cents: Cents): string {
  return brlCompact.format(Math.round(cents / 100)).replace(/ /g, " ");
}

/** "1234,56" → "1234,56" sem símbolo, para preencher inputs de edição. */
export function centsToInput(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const cent = String(abs % 100).padStart(2, "0");
  return `${sign}${reais},${cent}`;
}

/**
 * Entrada estilo "caixa eletrônico": cada dígito digitado empurra os
 * anteriores para a esquerda. "1234" → 1234 centavos (R$ 12,34).
 * Qualquer caractere que não seja dígito é ignorado.
 */
export function digitsToCents(input: string): Cents {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "");
  if (digits === "") return 0;
  // Limite de 13 dígitos (R$ 99 bilhões) mantém o valor um inteiro seguro.
  return Number(digits.slice(0, 13));
}

/**
 * Converte texto digitado em formato brasileiro para centavos, sem passar
 * por float. Aceita "12", "12,5", "12,50", "1.234,56", "R$ 1.234,56",
 * "-3,00". Usado na importação e em campos livres. Retorna null se inválido.
 */
export function parseBRL(input: string): Cents | null {
  let s = input
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s/g, "");
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1).replace(/^R\$/i, "");
  }
  if (s === "") return null;

  let intPart: string;
  let fracPart = "";
  if (s.includes(",")) {
    // Vírgula é o separador decimal; pontos são de milhar.
    const [i, f, ...rest] = s.split(",");
    if (rest.length > 0) return null;
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(i)) return null;
    intPart = i.replace(/\./g, "");
    fracPart = f;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" sem vírgula: ponto de milhar.
    intPart = s.replace(/\./g, "");
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    // "12.5" / "12.50": ponto decimal (formato de planilha em inglês).
    [intPart, fracPart] = s.split(".");
  } else {
    intPart = s;
  }

  if (!/^\d+$/.test(intPart) || !/^\d{0,2}$/.test(fracPart)) return null;
  const cents = Number(intPart) * 100 + Number(fracPart.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

export function sumCents(values: Iterable<Cents>): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/**
 * Divide um total em `parts` inteiros cuja soma é exatamente o total.
 * O resto vai para as primeiras partes: 1000 / 3 → [334, 333, 333].
 * Funciona também com totais negativos (cada parte usa floor).
 */
export function splitEvenly(total: Cents, parts: number): Cents[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new Error(`Número de partes inválido: ${parts}`);
  }
  const base = Math.floor(total / parts);
  const remainder = total - base * parts; // 0 ≤ remainder < parts
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Percentual em pontos-base (1000 = 10%) aplicado a um valor, arredondado. */
export function applyBasisPoints(cents: Cents, basisPoints: number): Cents {
  return Math.round((cents * basisPoints) / 10000);
}
