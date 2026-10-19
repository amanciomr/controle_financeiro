import type { ISODate } from "./dates";
import type { Cents } from "./money";

export interface AccountOpening {
  id: string;
  /** Saldo no início do dia `openingDate`. */
  openingBalance: Cents;
  openingDate: ISODate;
}

/** Entrada (+) ou saída (−) de dinheiro das contas, na data de caixa. */
export interface CashMovement {
  date: ISODate;
  /** Com sinal: receita positiva, despesa negativa. */
  amount: Cents;
  accountId?: string | null;
}

/**
 * Saldo consolidado das contas no início de `date`.
 *
 * Cada conta começa a contar no seu `openingDate`. Movimentos sem conta (o
 * lançamento rápido não exige conta) contam a partir da conta mais antiga.
 * Sem nenhuma conta cadastrada, só os movimentos do próprio intervalo
 * pedido contam: o saldo vira "receitas − despesas acumuladas" a partir de
 * zero em `zeroDate`.
 */
export function balanceBefore(
  date: ISODate,
  accounts: AccountOpening[],
  movements: CashMovement[],
  zeroDate?: ISODate,
): Cents {
  const openings = new Map(accounts.map((a) => [a.id, a.openingDate]));
  const earliest = accounts.reduce<ISODate | null>(
    (min, a) => (min === null || a.openingDate < min ? a.openingDate : min),
    null,
  );
  const fallbackStart = earliest ?? zeroDate ?? null;

  let total = 0;
  for (const a of accounts) {
    if (a.openingDate <= date) total += a.openingBalance;
  }
  for (const m of movements) {
    if (m.date >= date) continue;
    const start = (m.accountId && openings.get(m.accountId)) || fallbackStart;
    if (start !== null && m.date < start) continue;
    total += m.amount;
  }
  return total;
}
