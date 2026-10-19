import {
  addDays,
  addMonths,
  clampedDate,
  type ISODate,
  monthOf,
  parseDate,
  parseYearMonth,
  weekday as weekdayOf,
} from "./dates";

export type Frequency = "monthly" | "yearly" | "weekly";

export interface RecurrenceRule {
  frequency: Frequency;
  /** Dia do mês (1–31) para mensal/anual. Dia inexistente → último dia do mês. */
  dayOfMonth?: number | null;
  /** Mês (1–12) para anual. */
  monthOfYear?: number | null;
  /** Dia da semana (0 = domingo) para semanal. */
  weekday?: number | null;
  /** Primeira data possível (inclusive). */
  startDate: ISODate;
  /** Última data possível (inclusive), opcional. */
  endDate?: ISODate | null;
  /** Financiamentos: número total de parcelas. */
  totalInstallments?: number | null;
}

export interface Occurrence {
  date: ISODate;
  /** Posição da ocorrência a partir de 1 (nº da parcela, no financiamento). */
  index: number;
}

export function validateRule(rule: RecurrenceRule): string[] {
  const errors: string[] = [];
  const { frequency, dayOfMonth, monthOfYear, weekday, startDate, endDate, totalInstallments } =
    rule;
  if ((frequency === "monthly" || frequency === "yearly") && dayOfMonth != null) {
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      errors.push("Dia do mês deve estar entre 1 e 31.");
    }
  }
  if (frequency === "yearly" && monthOfYear != null) {
    if (!Number.isInteger(monthOfYear) || monthOfYear < 1 || monthOfYear > 12) {
      errors.push("Mês deve estar entre 1 e 12.");
    }
  }
  if (frequency === "weekly" && weekday != null) {
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      errors.push("Dia da semana inválido.");
    }
  }
  if (endDate && endDate < startDate) {
    errors.push("A data final não pode ser anterior à inicial.");
  }
  if (
    totalInstallments != null &&
    (!Number.isInteger(totalInstallments) || totalInstallments < 1)
  ) {
    errors.push("Número de parcelas deve ser pelo menos 1.");
  }
  return errors;
}

/** Gera as datas da recorrência em ordem, a partir de startDate (sem limite). */
function* candidateDates(rule: RecurrenceRule): Generator<ISODate> {
  const start = parseDate(rule.startDate);
  switch (rule.frequency) {
    case "monthly": {
      const day = rule.dayOfMonth ?? start.day;
      for (let ym = monthOf(rule.startDate); ; ym = addMonths(ym, 1)) {
        const { year, month } = parseYearMonth(ym);
        const date = clampedDate(year, month, day);
        if (date >= rule.startDate) yield date;
      }
    }
    case "yearly": {
      const month = rule.monthOfYear ?? start.month;
      const day = rule.dayOfMonth ?? start.day;
      for (let year = start.year; ; year++) {
        const date = clampedDate(year, month, day);
        if (date >= rule.startDate) yield date;
      }
    }
    case "weekly": {
      const target = rule.weekday ?? weekdayOf(rule.startDate);
      const offset = (target - weekdayOf(rule.startDate) + 7) % 7;
      for (let date = addDays(rule.startDate, offset); ; date = addDays(date, 7)) {
        yield date;
      }
    }
  }
}

/** Todas as ocorrências válidas, em ordem, respeitando fim e nº de parcelas. */
export function* occurrences(rule: RecurrenceRule): Generator<Occurrence> {
  let index = 0;
  for (const date of candidateDates(rule)) {
    index++;
    if (rule.endDate && date > rule.endDate) return;
    if (rule.totalInstallments != null && index > rule.totalInstallments) return;
    yield { date, index };
  }
}

/** Ocorrências com data entre `from` e `to` (inclusive). */
export function occurrencesBetween(rule: RecurrenceRule, from: ISODate, to: ISODate): Occurrence[] {
  const result: Occurrence[] = [];
  if (to < from) return result;
  for (const occ of occurrences(rule)) {
    if (occ.date > to) break;
    if (occ.date >= from) result.push(occ);
  }
  return result;
}

/** Data da última ocorrência, se a recorrência tiver fim; null se for indeterminada. */
export function lastOccurrence(rule: RecurrenceRule): Occurrence | null {
  if (rule.totalInstallments == null && !rule.endDate) return null;
  let last: Occurrence | null = null;
  for (const occ of occurrences(rule)) last = occ;
  return last;
}

export interface InstallmentProgress {
  total: number;
  /** Parcelas com data até hoje (inclusive). */
  elapsed: number;
  remaining: number;
  /** Próxima parcela depois de hoje, se houver. */
  next: Occurrence | null;
  last: Occurrence | null;
}

/** Progresso de um financiamento: "parcela 23 de 48, faltam 25". */
export function installmentProgress(
  rule: RecurrenceRule,
  today: ISODate,
): InstallmentProgress | null {
  if (rule.totalInstallments == null) return null;
  let elapsed = 0;
  let next: Occurrence | null = null;
  let last: Occurrence | null = null;
  for (const occ of occurrences(rule)) {
    last = occ;
    if (occ.date <= today) elapsed = occ.index;
    else if (!next) next = occ;
  }
  const total = last?.index ?? 0;
  return { total, elapsed, remaining: total - elapsed, next, last };
}

/**
 * Financiamento mensal informado como "a parcela deste mês é a nº N":
 * a 1ª parcela caiu N−1 meses atrás. Devolve o 1º dia daquele mês como data
 * inicial, de modo que a ocorrência deste mês tenha índice N.
 */
export function financingStartDate(today: ISODate, currentInstallment: number): ISODate {
  return `${addMonths(monthOf(today), -(currentInstallment - 1))}-01`;
}

/** Inverso de financingStartDate: qual parcela cai no mês de `today`. */
export function installmentOfMonth(startDate: ISODate, today: ISODate): number {
  const [sy, sm] = startDate.split("-").map(Number);
  const [ty, tm] = today.split("-").map(Number);
  return (ty - sy) * 12 + (tm - sm) + 1;
}
