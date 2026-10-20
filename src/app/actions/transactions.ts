"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, dbError, fail, ok, validationError } from "@/lib/action";
import { type AppContext, getAppContext } from "@/lib/data/context";
import { cardsOf } from "@/lib/data/cards";
import { planInstallments } from "@/lib/domain/card";
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
  /** Compra no cartão: cartão e nº de parcelas (1 = à vista). */
  cardId: id.nullish(),
  installments: z.int().min(1).max(48, "No máximo 48 parcelas.").default(1),
  /** Preenchido ao editar uma compra no cartão já existente. */
  purchaseId: id.nullish(),
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

  if (input.type === "expense" && input.paymentMethod === "credit_card" && input.cardId) {
    return saveCardPurchase(ctx, { ...input, cardId: input.cardId });
  }

  // Era compra no cartão e virou outra forma de pagamento: a compra (e suas
  // parcelas) dá lugar a um lançamento avulso, criado logo abaixo.
  if (input.purchaseId) {
    const { error } = await ctx.supabase.from("card_purchases").delete().eq("id", input.purchaseId);
    if (error) return dbError(error);
    input.id = undefined;
  }

  const values = {
    type: input.type,
    amount: input.amount,
    description: input.description,
    category_id: input.categoryId,
    payment_method: input.paymentMethod ?? null,
    account_id: input.accountId ?? null,
    person_user_id: input.personUserId ?? null,
    date: input.date,
    // Fora do cartão, o dinheiro sai/entra no próprio dia.
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

type ParsedInput = z.output<typeof transactionInput>;

/** Compra no cartão: grava a compra e todas as parcelas de uma vez (RPC). */
async function saveCardPurchase(
  ctx: AppContext,
  input: ParsedInput & { cardId: string },
): Promise<ActionResult<{ id: string }>> {
  const card = cardsOf(ctx.accounts).find((c) => c.id === input.cardId);
  if (!card) return fail("Cartão não encontrado.");

  // Editando um lançamento avulso que virou compra no cartão: ele é
  // substituído (ou, se veio de uma recorrência, marcado como pulado).
  let replace: string | null = null;
  let skipRecurring: string | null = null;
  if (input.id && !input.purchaseId) {
    const { data: old } = await ctx.supabase
      .from("transactions")
      .select("id, recurrence_id")
      .eq("id", input.id)
      .single();
    if (old?.recurrence_id) skipRecurring = old.id;
    else replace = input.id;
  }

  const plan = planInstallments({
    purchaseDate: input.date,
    total: input.amount,
    count: input.installments,
    card: card.cycle,
  });
  const { data: purchaseId, error } = await ctx.supabase.rpc("save_card_purchase", {
    p_purchase: {
      id: input.purchaseId ?? null,
      household_id: ctx.household.id,
      account_id: card.id,
      purchase_date: input.date,
      description: input.description,
      total_amount: input.amount,
      installments: input.installments,
      category_id: input.categoryId,
      person_user_id: input.personUserId ?? null,
      notes: input.notes,
    },
    p_installments: plan.map((p) => ({
      number: p.number,
      total: p.total,
      amount: p.amount,
      date: p.date,
      cash_date: p.statement.dueDate,
    })),
    p_replace_transaction: replace ?? undefined,
  });
  if (error) return dbError(error);
  if (skipRecurring) {
    await ctx.supabase.from("transactions").update({ status: "skipped" }).eq("id", skipRecurring);
  }

  await ctx.supabase
    .from("household_members")
    .update({ last_payment_method: "credit_card", last_account_id: card.id })
    .eq("household_id", ctx.household.id)
    .eq("user_id", ctx.userId);

  revalidatePath("/", "layout");
  return ok({ id: purchaseId });
}

/** Exclui uma compra no cartão com todas as parcelas. */
export async function deletePurchase(purchaseId: string): Promise<ActionResult> {
  if (!id.safeParse(purchaseId).success) return fail("Compra inválida.");
  const ctx = await getAppContext();
  const { error } = await ctx.supabase.from("card_purchases").delete().eq("id", purchaseId);
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok();
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
