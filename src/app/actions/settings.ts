"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionResult, dbError, fail, ok, validationError } from "@/lib/action";
import { getAppContext, getUser } from "@/lib/data/context";
import { id, isoDate } from "@/lib/schemas";

const name = (label: string, max: number) =>
  z.string().trim().min(1, `Informe ${label}.`).max(max, `Use no máximo ${max} caracteres.`);

// ---------------------------------------------------------------- onboarding

export async function createHousehold(raw: {
  name: string;
  displayName: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({ name: name("o nome da casa", 80), displayName: name("seu nome", 40) })
    .safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("create_household", {
    p_name: parsed.data.name,
    p_display_name: parsed.data.displayName,
  });
  if (error) return dbError(error);
  redirect("/");
}

export async function acceptInvite(raw: {
  token: string;
  displayName: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({ token: z.string().min(10).max(100), displayName: name("seu nome", 40) })
    .safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("accept_invite", {
    p_token: parsed.data.token,
    p_display_name: parsed.data.displayName,
  });
  if (error) return dbError(error);
  redirect("/");
}

export async function signOut() {
  const { supabase } = await getUser();
  await supabase.auth.signOut();
  redirect("/entrar");
}

// ---------------------------------------------------------------- casa

const householdInput = z.object({
  name: name("o nome da casa", 80),
  savingsGoalMode: z.enum(["amount", "percent"]),
  /** centavos (amount) ou pontos-base (percent) */
  savingsGoalValue: z.int().min(0, "A meta não pode ser negativa."),
});

export async function updateHousehold(raw: z.input<typeof householdInput>): Promise<ActionResult> {
  const parsed = householdInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  if (parsed.data.savingsGoalMode === "percent" && parsed.data.savingsGoalValue > 10000) {
    return fail("O percentual deve ficar entre 0% e 100%.");
  }
  const ctx = await getAppContext();
  const { error } = await ctx.supabase
    .from("households")
    .update({
      name: parsed.data.name,
      savings_goal_mode: parsed.data.savingsGoalMode,
      savings_goal_value: parsed.data.savingsGoalValue,
    })
    .eq("id", ctx.household.id);
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok();
}

export async function updateMyName(displayName: string): Promise<ActionResult> {
  const parsed = name("seu nome", 40).safeParse(displayName);
  if (!parsed.success) return validationError(parsed.error);
  const ctx = await getAppContext();
  const { error } = await ctx.supabase
    .from("household_members")
    .update({ display_name: parsed.data })
    .eq("household_id", ctx.household.id)
    .eq("user_id", ctx.userId);
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok();
}

// ---------------------------------------------------------------- convites

export async function createInvite(raw: {
  email: string;
  displayName?: string;
}): Promise<ActionResult<{ token: string }>> {
  const parsed = z
    .object({
      email: z.email("E-mail inválido.").trim().toLowerCase(),
      displayName: z.string().trim().max(40).optional(),
    })
    .safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const ctx = await getAppContext();
  if (parsed.data.email === ctx.email?.toLowerCase()) return fail("Esse é o seu próprio e-mail.");

  const { data, error } = await ctx.supabase
    .from("household_invites")
    .insert({
      household_id: ctx.household.id,
      email: parsed.data.email,
      display_name: parsed.data.displayName || null,
      invited_by: ctx.userId,
    })
    .select("token")
    .single();
  if (error) return dbError(error);
  revalidatePath("/configuracoes");
  return ok({ token: data.token });
}

export async function deleteInvite(inviteId: string): Promise<ActionResult> {
  if (!id.safeParse(inviteId).success) return fail("Convite inválido.");
  const ctx = await getAppContext();
  const { error } = await ctx.supabase.from("household_invites").delete().eq("id", inviteId);
  if (error) return dbError(error);
  revalidatePath("/configuracoes");
  return ok();
}

// ---------------------------------------------------------------- contas

const accountInput = z.object({
  id: id.optional(),
  name: name("o nome da conta", 60),
  kind: z.enum(["checking", "savings", "cash"]),
  ownerUserId: id.nullish(),
  openingBalance: z.int("Saldo inválido."),
  openingDate: isoDate,
  archived: z.boolean().default(false),
});

export async function saveAccount(raw: z.input<typeof accountInput>): Promise<ActionResult> {
  const parsed = accountInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  const ctx = await getAppContext();
  const values = {
    name: input.name,
    kind: input.kind,
    owner_user_id: input.ownerUserId ?? null,
    opening_balance: input.openingBalance,
    opening_date: input.openingDate,
    archived: input.archived,
  };
  const { error } = input.id
    ? await ctx.supabase.from("accounts").update(values).eq("id", input.id)
    : await ctx.supabase.from("accounts").insert({ ...values, household_id: ctx.household.id });
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok();
}

export async function deleteAccount(accountId: string): Promise<ActionResult> {
  if (!id.safeParse(accountId).success) return fail("Conta inválida.");
  const ctx = await getAppContext();
  const { error } = await ctx.supabase.from("accounts").delete().eq("id", accountId);
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok();
}
