import { z } from "zod";
import { isISODate } from "@/lib/domain/dates";

export const id = z.guid("Identificador inválido.");
export const isoDate = z.string().refine(isISODate, "Data inválida.");
export const cents = z.int("Valor inválido.").positive("Informe um valor maior que zero.");
export const txType = z.enum(["income", "expense"]);
export const paymentMethod = z.enum([
  "credit_card",
  "pix",
  "debit",
  "cash",
  "boleto",
  "transfer",
  "auto_debit",
]);
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));
