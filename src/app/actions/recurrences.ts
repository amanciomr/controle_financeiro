"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, dbError, fail, ok, validationError } from "@/lib/action";
import { getAppContext } from "@/lib/data/context";
import { ensureRecurrences } from "@/lib/data/month";
import { addMonths, monthEnd, monthOf, monthStart } from "@/lib/domain/dates";
import { validateRule } from "@/lib/domain/recurrence";
import { cents, id, isoDate, optionalText, paymentMethod, txType } from "@/lib/schemas";

const recurrenceInput = z.object({
  id: id.optional(),
  type: txType,
  description: z.string().trim().min(1, "Informe a descrição.").max(120, "Descrição muito longa."),
  amount: cents,
  isEstimate: z.boolean().default(false),
  categoryId: id,
  paymentMethod: paymentMethod.nullish(),
  accountId: id.nullish(),
  personUserId: id.nullish(),
  frequency: z.enum(["monthly", "yearly", "weekly"]),
  dayOfMonth: z.int().min(1).max(31).nullish(),
  monthOfYear: z.int().min(1).max(12).nullish(),
  weekday: z.int().min(0).max(6).nullish(),
  startDate: isoDate,
  endDate: isoDate.nullish(),
  totalInstallments: z.int().min(1, "Parcelas deve ser pelo menos 1.").max(600).nullish(),
  active: z.boolean().default(true),
  notes: optionalText(500),
});
export type RecurrenceInput = z.input<typeof recurrenceInput>;

/** Mês corrente e o próximo, para "próximos vencimentos" funcionar na virada do mês. */
function horizon(today: string) {
  return { from: monthStart(monthOf(today)), to: monthEnd(addMonths(monthOf(today), 1)) };
}

export async function saveRecurrence(raw: RecurrenceInput): Promise<ActionResult<{ id: string }>> {
  const parsed = recurrenceInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  const ctx = await getAppContext();

  const category = ctx.categories.find((c) => c.id === input.categoryId);
  if (!category) return fail("Categoria não encontrada.");
  if (category.kind !== input.type) return fail("A categoria não combina com o tipo.");

  const rule = {
    frequency: input.frequency,
    dayOfMonth: input.frequency === "weekly" ? null : (input.dayOfMonth ?? null),
    monthOfYear: input.frequency === "yearly" ? (input.monthOfYear ?? null) : null,
    weekday: input.frequency === "weekly" ? (input.weekday ?? null) : null,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    totalInstallments: input.totalInstallments ?? null,
  };
  if (rule.frequency !== "weekly" && rule.dayOfMonth == null) return fail("Informe o dia do mês.");
  if (rule.frequency === "yearly" && rule.monthOfYear == null) return fail("Informe o mês.");
  if (rule.frequency === "weekly" && rule.weekday == null) return fail("Informe o dia da semana.");
  const ruleErrors = validateRule(rule);
  if (ruleErrors.length) return fail(ruleErrors[0]);

  const values = {
    type: input.type,
    description: input.description,
    amount: input.amount,
    is_estimate: input.isEstimate,
    category_id: input.categoryId,
    payment_method: input.paymentMethod ?? null,
    account_id: input.accountId ?? null,
    person_user_id: input.personUserId ?? null,
    frequency: rule.frequency,
    day_of_month: rule.dayOfMonth,
    month_of_year: rule.monthOfYear,
    weekday: rule.weekday,
    start_date: rule.startDate,
    end_date: rule.endDate,
    total_installments: rule.totalInstallments,
    active: input.active,
    notes: input.notes,
  };

  let recurrenceId: string;
  if (input.id) {
    const { error } = await ctx.supabase.from("recurrences").update(values).eq("id", input.id);
    if (error) return dbError(error);
    recurrenceId = input.id;
    // Previstos futuros (de hoje em diante) são refeitos com os novos dados;
    // realizados e pulados ficam como estão.
    const { error: delError } = await ctx.supabase
      .from("transactions")
      .delete()
      .eq("recurrence_id", recurrenceId)
      .eq("status", "planned")
      .gte("date", ctx.today);
    if (delError) return dbError(delError);
  } else {
    const { data, error } = await ctx.supabase
      .from("recurrences")
      .insert({
        ...values,
        household_id: ctx.household.id,
        generate_from: monthStart(monthOf(ctx.today)),
      })
      .select("id")
      .single();
    if (error) return dbError(error);
    recurrenceId = data.id;
  }

  const { from, to } = horizon(ctx.today);
  await ensureRecurrences(ctx, from, to);
  revalidatePath("/", "layout");
  return ok({ id: recurrenceId });
}

/**
 * Exclui a recorrência e seus previstos futuros. Lançamentos já realizados
 * continuam no histórico (perdem só o vínculo).
 */
export async function deleteRecurrence(recurrenceId: string): Promise<ActionResult> {
  if (!id.safeParse(recurrenceId).success) return fail("Recorrência inválida.");
  const ctx = await getAppContext();
  const { error: delTx } = await ctx.supabase
    .from("transactions")
    .delete()
    .eq("recurrence_id", recurrenceId)
    .in("status", ["planned", "skipped"]);
  if (delTx) return dbError(delTx);
  const { error } = await ctx.supabase.from("recurrences").delete().eq("id", recurrenceId);
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok();
}

/** Pausa ou retoma: pausar remove os previstos futuros. */
export async function setRecurrenceActive(
  recurrenceId: string,
  active: boolean,
): Promise<ActionResult> {
  if (!id.safeParse(recurrenceId).success) return fail("Recorrência inválida.");
  const ctx = await getAppContext();
  const { error } = await ctx.supabase
    .from("recurrences")
    .update({ active })
    .eq("id", recurrenceId);
  if (error) return dbError(error);
  if (!active) {
    const { error: delError } = await ctx.supabase
      .from("transactions")
      .delete()
      .eq("recurrence_id", recurrenceId)
      .eq("status", "planned")
      .gte("date", ctx.today);
    if (delError) return dbError(delError);
  } else {
    const { from, to } = horizon(ctx.today);
    await ensureRecurrences(ctx, from, to);
  }
  revalidatePath("/", "layout");
  return ok();
}
