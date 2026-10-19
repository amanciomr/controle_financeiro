"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, dbError, fail, ok, validationError } from "@/lib/action";
import { getAppContext } from "@/lib/data/context";
import { cents, id, isoDate, optionalText, paymentMethod, txType } from "@/lib/schemas";

const transactionInput = z.object({
  id: id.optional(),
  type: txType,
  amount: cents,
  description: z.string().trim().min(1, "Informe a descrição.").max(120, "Descrição muito longa."),
  categoryId: id,
  paymentMethod: paymentMethod.nullish(),
  accountId: id.nullish(),
  /** null = casa/compartilhado */
  personUserId: id.nullish(),
  date: isoDate,
  /** Se omitido: data futura → previsto; hoje ou passado → realizado. */
  status: z.enum(["planned", "done"]).optional(),
  notes: optionalText(500),
});
export type TransactionInput = z.input<typeof transactionInput>;

export async function saveTransaction(
  raw: TransactionInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = transactionInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  const ctx = await getAppContext();

  const category = ctx.categories.find((c) => c.id === input.categoryId);
  if (!category) return fail("Categoria não encontrada.");
  if (category.kind !== input.type)
    return fail("A categoria não combina com o tipo do lançamento.");

  const values = {
    type: input.type,
    amount: input.amount,
    description: input.description,
    category_id: input.categoryId,
    payment_method: input.paymentMethod ?? null,
    account_id: input.accountId ?? null,
    person_user_id: input.personUserId ?? null,
    date: input.date,
    // Fase 1: sem cartão, caixa = competência. Na Fase 2 o cartão define o vencimento.
    cash_date: input.date,
    status: input.status ?? (input.date > ctx.today ? "planned" : "done"),
    notes: input.notes,
  } as const;

  if (input.id) {
    const { data, error } = await ctx.supabase
      .from("transactions")
      .update(values)
      .eq("id", input.id)
      .select("id")
      .single();
    if (error) return dbError(error);
    revalidatePath("/", "layout");
    return ok({ id: data.id });
  }

  const { data, error } = await ctx.supabase
    .from("transactions")
    .insert({ ...values, household_id: ctx.household.id })
    .select("id")
    .single();
  if (error) return dbError(error);

  // Lembra a última forma de pagamento/conta de quem lançou.
  if (input.paymentMethod && input.type === "expense") {
    await ctx.supabase
      .from("household_members")
      .update({
        last_payment_method: input.paymentMethod,
        last_account_id: input.accountId ?? null,
      })
      .eq("household_id", ctx.household.id)
      .eq("user_id", ctx.userId);
  }

  revalidatePath("/", "layout");
  return ok({ id: data.id });
}

/**
 * Exclui o lançamento. Ocorrências de recorrência viram "puladas" (ficam
 * ocultas) para não serem recriadas automaticamente.
 */
export async function deleteTransaction(txId: string): Promise<ActionResult> {
  if (!id.safeParse(txId).success) return fail("Lançamento inválido.");
  const ctx = await getAppContext();
  const { data: tx, error } = await ctx.supabase
    .from("transactions")
    .select("id, recurrence_id")
    .eq("id", txId)
    .single();
  if (error) return dbError(error);

  const result = tx.recurrence_id
    ? await ctx.supabase.from("transactions").update({ status: "skipped" }).eq("id", txId)
    : await ctx.supabase.from("transactions").delete().eq("id", txId);
  if (result.error) return dbError(result.error);
  revalidatePath("/", "layout");
  return ok();
}

const confirmInput = z.object({ id, amount: cents.optional(), date: isoDate.optional() });

/** Confirma um previsto com 1 toque, ajustando valor/data se preciso. */
export async function confirmTransaction(raw: z.input<typeof confirmInput>): Promise<ActionResult> {
  const parsed = confirmInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const { id: txId, amount, date } = parsed.data;
  const ctx = await getAppContext();
  const { error } = await ctx.supabase
    .from("transactions")
    .update({
      status: "done",
      ...(amount ? { amount } : {}),
      ...(date ? { date, cash_date: date } : {}),
    })
    .eq("id", txId)
    .eq("status", "planned");
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok();
}

/** Volta um lançamento realizado para previsto. */
export async function unconfirmTransaction(txId: string): Promise<ActionResult> {
  if (!id.safeParse(txId).success) return fail("Lançamento inválido.");
  const ctx = await getAppContext();
  const { error } = await ctx.supabase
    .from("transactions")
    .update({ status: "planned" })
    .eq("id", txId)
    .eq("status", "done");
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok();
}
