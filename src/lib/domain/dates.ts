/**
 * Datas de calendário sem hora, sempre no formato "YYYY-MM-DD" (ISODate) e
 * meses no formato "YYYY-MM" (YearMonth). Strings nesse formato comparam
 * corretamente com < e >. Toda aritmética usa UTC internamente, então o
 * fuso do servidor nunca interfere; o único ponto que depende de fuso é
 * `todayIn`, que descobre que dia é "hoje" para a casa.
 */
export type ISODate = string;
export type YearMonth = string;

export const DEFAULT_TIMEZONE = "America/Bahia";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH_RE = /^(\d{4})-(\d{2})$/;

export function isISODate(value: string): boolean {
  const m = ISO_DATE_RE.exec(value);
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function isYearMonth(value: string): boolean {
  const m = YEAR_MONTH_RE.exec(value);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

export function parseDate(date: ISODate): { year: number; month: number; day: number } {
  const m = ISO_DATE_RE.exec(date);
  if (!m) throw new Error(`Data inválida: ${date}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function parseYearMonth(ym: YearMonth): { year: number; month: number } {
  const m = YEAR_MONTH_RE.exec(ym);
  if (!m) throw new Error(`Mês inválido: ${ym}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

export function makeDate(year: number, month: number, day: number): ISODate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function makeYearMonth(year: number, month: number): YearMonth {
  return `${pad(year, 4)}-${pad(month)}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Dia `day` do mês, ou o último dia se o mês for mais curto (31 → 28/02). */
export function clampedDate(year: number, month: number, day: number): ISODate {
  return makeDate(year, month, Math.min(day, daysInMonth(year, month)));
}

function toUTC(date: ISODate): Date {
  const { year, month, day } = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUTC(d: Date): ISODate {
  return makeDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

/** Diferença em dias: diffDays("2026-01-03", "2026-01-01") = 2. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86_400_000);
}

/** 0 = domingo … 6 = sábado. */
export function weekday(date: ISODate): number {
  return toUTC(date).getUTCDay();
}

export function monthOf(date: ISODate): YearMonth {
  return date.slice(0, 7);
}

export function addMonths(ym: YearMonth, months: number): YearMonth {
  const { year, month } = parseYearMonth(ym);
  const index = year * 12 + (month - 1) + months;
  return makeYearMonth(Math.floor(index / 12), (index % 12) + 1);
}

/** Meses entre dois YearMonth: diffMonths("2027-01", "2026-11") = 2. */
export function diffMonths(a: YearMonth, b: YearMonth): number {
  const pa = parseYearMonth(a);
  const pb = parseYearMonth(b);
  return (pa.year - pb.year) * 12 + (pa.month - pb.month);
}

/** Soma meses mantendo o dia, limitado ao fim do mês: 31/01 + 1 → 28/02. */
export function addMonthsToDate(date: ISODate, months: number, day?: number): ISODate {
  const { day: d } = parseDate(date);
  const { year, month } = parseYearMonth(addMonths(monthOf(date), months));
  return clampedDate(year, month, day ?? d);
}

export function monthStart(ym: YearMonth): ISODate {
  return `${ym}-01`;
}

export function monthEnd(ym: YearMonth): ISODate {
  const { year, month } = parseYearMonth(ym);
  return makeDate(year, month, daysInMonth(year, month));
}

export function daysInYearMonth(ym: YearMonth): number {
  const { year, month } = parseYearMonth(ym);
  return daysInMonth(year, month);
}

/** Todas as datas do mês, em ordem. */
export function datesOfMonth(ym: YearMonth): ISODate[] {
  const { year, month } = parseYearMonth(ym);
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => makeDate(year, month, i + 1));
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

/** Que dia é hoje no fuso informado (padrão: America/Bahia). */
export function todayIn(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): ISODate {
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-10-19" → "19/10" */
export function formatDayMonth(date: ISODate): string {
  const { day, month } = parseDate(date);
  return `${pad(day)}/${pad(month)}`;
}

/** "2026-10-19" → "19/10/2026" */
export function formatDateBR(date: ISODate): string {
  const { day, month, year } = parseDate(date);
  return `${pad(day)}/${pad(month)}/${year}`;
}

/** "2026-10-19" → "seg" */
export function formatWeekdayShort(date: ISODate): string {
  return WEEKDAYS_SHORT[weekday(date)];
}

/** "2026-10" → "outubro de 2026" */
export function formatMonthBR(ym: YearMonth): string {
  const { year, month } = parseYearMonth(ym);
  return `${MONTHS[month - 1]} de ${year}`;
}

/** Converte "DD/MM/AAAA" (ou já ISO) para ISODate; null se inválido. */
export function parseDateBR(input: string): ISODate | null {
  const s = input.trim();
  if (isISODate(s)) return s;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const date = makeDate(Number(m[3]), Number(m[2]), Number(m[1]));
  return isISODate(date) ? date : null;
}
