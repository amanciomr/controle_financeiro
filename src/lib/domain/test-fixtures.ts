import type { BudgetEntry } from "./budget";

export const income = (
  date: string,
  amount: number,
  status: BudgetEntry["status"] = "done",
): BudgetEntry => ({
  date,
  amount,
  type: "income",
  status,
  nature: "fixed",
});
export const fixed = (
  date: string,
  amount: number,
  status: BudgetEntry["status"] = "done",
): BudgetEntry => ({
  date,
  amount,
  type: "expense",
  status,
  nature: "fixed",
});
export const variable = (
  date: string,
  amount: number,
  status: BudgetEntry["status"] = "done",
): BudgetEntry => ({
  date,
  amount,
  type: "expense",
  status,
  nature: "variable",
});

/** Outubro/2026 (31 dias), hoje = 19/10. */
export const october: BudgetEntry[] = [
  income("2026-10-05", 800000), // salário Rafael (recebido)
  income("2026-10-20", 600000, "planned"), // salário Ana (previsto)
  fixed("2026-10-10", 300000), // aluguel
  fixed("2026-10-15", 50000, "planned"), // condomínio vencido, não confirmado
  fixed("2026-10-25", 10000, "planned"), // internet
  variable("2026-10-28", 20000, "planned"), // boleto variável agendado → comprometido
  variable("2026-10-03", 50000), // mercado
  variable("2026-10-18", 12000), // restaurante
  variable("2026-10-19", 3000), // padaria (hoje)
  variable("2026-10-12", 99999, "skipped"), // ignorado
  variable("2026-09-30", 77777), // outro mês, ignorado
];
