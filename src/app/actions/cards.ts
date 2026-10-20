"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, dbError, fail, ok, validationError } from "@/lib/action";
import { cardsOf } from "@/lib/data/cards";
import { getAppContext } from "@/lib/data/context";
import { planInstallments } from "@/lib/domain/card";
import { isYearMonth } from "@/lib/domain/dates";
import { id } from "@/lib/schemas";

const day = z.int().min(1, "Dia inválido.").max(31, "Dia inválido.");

const cardInput = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, "Informe o nome do cartão.").max(60),
  ownerUserId: id.nullish(),
  closingDay: day,
  dueDay: day,
  creditLimit: z.int().min(0).nullish(),
  paymentAccountId: id.nullish(),
  archived: z.boolean().default(false),
});
export type CardInput = z.input<typeof cardInput>;

export async function saveCard(raw: CardInput): Promise<ActionResult> {
  const parsed = cardInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  const ctx = await getAppContext();
  const values = {
    name: input.name,
    kind: "credit_card" as const,
    owner_user_id: input.ownerUserId ?? null,
    closing_day: input.closingDay,
    due_day: input.dueDay,
    credit_limit: input.creditLimit ?? null,
    payment_account_id: input.paymentAccountId ?? null,
    archived: input.archived,
  };

  if (!input.id) {
    const { error } = await ctx.supabase
      .from("accounts")
      .insert({ ...values, household_id: ctx.household.id });
    if (error) return dbError(error);
    revalidatePath("/", "layout");
    return ok();
  }

  const before = cardsOf(ctx.accounts).find((c) => c.id === input.id);
  const { error } = await ctx.supabase.from("accounts").update(values).eq("id", input.id);
  if (error) return dbError(error);

  // Mudou o fechamento ou o vencimento: recalcula a fatura de cada parcela.
  if (
    before &&
    (before.cycle.closingDay !== input.closingDay || before.cycle.dueDay !== input.dueDay)
  ) {
    const { data: purchases, error: listError } = await ctx.supabase
      .from("card_purchases")
      .select("*")
      .eq("account_id", input.id);
    if (listError) return dbError(listError);
    for (const p of purchases ?? []) {
      const plan = planInstallments({
        purchaseDate: p.purchase_date,
        total: p.total_amount,
        count: p.installments,
        card: { closingDay: input.closingDay, dueDay: input.dueDay },
      });
      const { error: rpcError } = await ctx.supabase.rpc("save_card_purchase", {
        p_purchase: { ...p, id: p.id },
        p_installments: plan.map((i) => ({
          number: i.number,
          total: i.total,
          amount: i.amount,
          date: i.date,
          cash_date: i.statement.dueDate,
        })),
      });
      if (rpcError) return dbError(rpcError);
    }
  }
  revalidatePath("/", "layout");
  return ok();
}

/** Exclui o cartão. Com compras registradas, só arquiva (o histórico fica). */
export async function deleteCard(cardId: string): Promise<ActionResult<{ archived: boolean }>> {
  if (!id.safeParse(cardId).success) return fail("Cartão inválido.");
  const ctx = await getAppContext();
  const { count } = await ctx.supabase
    .from("card_purchases")
    .select("id", { count: "exact", head: true })
    .eq("account_id", cardId);
  const { error } = count
    ? await ctx.supabase.from("accounts").update({ archived: true }).eq("id", cardId)
    : await ctx.supabase.from("accounts").delete().eq("id", cardId);
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok({ archived: Boolean(count) });
}

/** Marca (ou desmarca) a fatura do mês de vencimento `dueMonth` como paga. */
export async function setStatementPaid(raw: {
  cardId: string;
  dueMonth: string;
  paid: boolean;
  amount?: number;
}): Promise<ActionResult> {
  if (!id.safeParse(raw.cardId).success || !isYearMonth(raw.dueMonth)) {
    return fail("Fatura inválida.");
  }
  const ctx = await getAppContext();
  const due_month = `${raw.dueMonth}-01`;
  const { error } = raw.paid
    ? await ctx.supabase.from("card_statement_payments").upsert({
        household_id: ctx.household.id,
        account_id: raw.cardId,
        due_month,
        amount: raw.amount ?? null,
      })
    : await ctx.supabase
        .from("card_statement_payments")
        .delete()
        .eq("account_id", raw.cardId)
        .eq("due_month", due_month);
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok();
}
