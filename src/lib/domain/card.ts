import {
  addMonths,
  addMonthsToDate,
  clampedDate,
  type ISODate,
  monthOf,
  parseDate,
  parseYearMonth,
  type YearMonth,
} from "./dates";
import { type Cents, splitEvenly } from "./money";

/** Ciclo do cartão: dias (1–31) de fechamento e de vencimento da fatura. */
export interface CardCycle {
  closingDay: number;
  dueDay: number;
}

/**
 * Uma fatura, identificada pelo mês de vencimento ("fatura de novembro").
 * Contém as compras feitas de `openingDate` (inclusive) até `closingDate`
 * (exclusive): compra no próprio dia do fechamento já vai para a seguinte.
 */
export interface Statement {
  month: YearMonth;
  openingDate: ISODate;
  closingDate: ISODate;
  dueDate: ISODate;
}

function dateIn(ym: YearMonth, day: number): ISODate {
  const { year, month } = parseYearMonth(ym);
  return clampedDate(year, month, day);
}

/** Fatura cujo vencimento cai no mês `dueMonth`. */
export function statementForDueMonth(dueMonth: YearMonth, card: CardCycle): Statement {
  // Vencimento depois do fechamento no mesmo mês (fecha 3, vence 10) ou no
  // mês seguinte (fecha 25, vence 5; ou dias iguais).
  const closingMonth = card.dueDay > card.closingDay ? dueMonth : addMonths(dueMonth, -1);
  return {
    month: dueMonth,
    openingDate: dateIn(addMonths(closingMonth, -1), card.closingDay),
    closingDate: dateIn(closingMonth, card.closingDay),
    dueDate: dateIn(dueMonth, card.dueDay),
  };
}

/** Em qual fatura cai uma compra feita em `date`. */
export function statementForPurchase(date: ISODate, card: CardCycle): Statement {
  const { year, month } = parseDate(date);
  let closingMonth = monthOf(date);
  // Compra no dia do fechamento (ou depois) entra na fatura seguinte.
  if (date >= clampedDate(year, month, card.closingDay)) closingMonth = addMonths(closingMonth, 1);
  const dueMonth = card.dueDay > card.closingDay ? closingMonth : addMonths(closingMonth, 1);
  return statementForDueMonth(dueMonth, card);
}

export interface Installment {
  /** 1 a `total`. */
  number: number;
  total: number;
  amount: Cents;
  /** Competência: data da compra para a 1ª; mesmo dia nos meses seguintes. */
  date: ISODate;
  /** Caixa: vencimento da fatura em que a parcela cai. */
  statement: Statement;
}

/**
 * Parcelas de uma compra no cartão. O centavo que sobra da divisão vai para
 * as primeiras parcelas (1000 em 3x → 3,34 + 3,33 + 3,33). A parcela k cai
 * na fatura k−1 meses depois da fatura da compra.
 */
export function planInstallments(input: {
  purchaseDate: ISODate;
  total: Cents;
  count: number;
  card: CardCycle;
}): Installment[] {
  const { purchaseDate, total, count, card } = input;
  if (!Number.isInteger(count) || count < 1) throw new Error(`Parcelas inválidas: ${count}`);
  const first = statementForPurchase(purchaseDate, card);
  return splitEvenly(total, count).map((amount, k) => ({
    number: k + 1,
    total: count,
    amount,
    date: k === 0 ? purchaseDate : addMonthsToDate(purchaseDate, k),
    statement: statementForDueMonth(addMonths(first.month, k), card),
  }));
}

export type StatementStatus = "future" | "open" | "closed" | "overdue" | "paid";

export function statementStatus(st: Statement, today: ISODate, paid: boolean): StatementStatus {
  if (paid) return "paid";
  if (today < st.openingDate) return "future";
  if (today < st.closingDate) return "open";
  if (today > st.dueDate) return "overdue";
  return "closed";
}

/** Limite comprometido: tudo que ainda não foi pago, de qualquer fatura. */
export function limitUsed(
  items: { dueMonth: YearMonth; amount: Cents }[],
  paidMonths: Set<YearMonth>,
): Cents {
  return items.reduce((sum, i) => (paidMonths.has(i.dueMonth) ? sum : sum + i.amount), 0);
}
