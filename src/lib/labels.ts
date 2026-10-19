import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];
export type PaymentMethod = Enums["payment_method"];
export type AccountKind = Enums["account_kind"];
export type Frequency = Enums["recurrence_frequency"];

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: "pix", label: "Pix", icon: "⚡" },
  { value: "credit_card", label: "Crédito", icon: "💳" },
  { value: "debit", label: "Débito", icon: "🏧" },
  { value: "cash", label: "Dinheiro", icon: "💵" },
  { value: "boleto", label: "Boleto", icon: "📄" },
  { value: "transfer", label: "Transferência", icon: "🔁" },
  { value: "auto_debit", label: "Débito automático", icon: "🔄" },
];

export function paymentMethodLabel(value: PaymentMethod | null | undefined): string {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? "—";
}

export const ACCOUNT_KINDS: { value: AccountKind; label: string }[] = [
  { value: "checking", label: "Conta corrente" },
  { value: "savings", label: "Poupança" },
  { value: "cash", label: "Dinheiro / carteira" },
];

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
  { value: "weekly", label: "Semanal" },
];

export const WEEKDAYS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

export const MONTH_NAMES = [
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

export function frequencyDescription(r: {
  frequency: Frequency;
  day_of_month: number | null;
  month_of_year: number | null;
  weekday: number | null;
}): string {
  switch (r.frequency) {
    case "monthly":
      return `todo dia ${r.day_of_month}`;
    case "yearly":
      return `todo ${r.day_of_month} de ${MONTH_NAMES[(r.month_of_year ?? 1) - 1]}`;
    case "weekly":
      return `toda ${WEEKDAYS[r.weekday ?? 0]}`;
  }
}
