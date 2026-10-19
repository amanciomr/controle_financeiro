import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { DEFAULT_TIMEZONE, todayIn } from "@/lib/domain/dates";
import type { SavingsGoal } from "@/lib/domain/budget";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];
export type Household = Tables["households"]["Row"];
export type Member = Pick<
  Tables["household_members"]["Row"],
  "user_id" | "display_name" | "role" | "last_payment_method" | "last_account_id"
>;
export type Category = Tables["categories"]["Row"];
export type Account = Tables["accounts"]["Row"];

export interface AppContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string | null;
  household: Household;
  me: Member;
  members: Member[];
  /** Categorias ativas e arquivadas, ordenadas. */
  categories: Category[];
  accounts: Account[];
  /** Hoje no fuso da casa. */
  today: string;
  savingsGoal: SavingsGoal;
}

/** Usuário logado (ou redireciona para o login). Deduplicado por requisição. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/entrar");
  return {
    supabase,
    userId: data.claims.sub,
    email: (data.claims.email as string | undefined) ?? null,
  };
});

/**
 * Contexto de quase toda tela: usuário, casa, membros, categorias e contas.
 * Sem casa ainda → onboarding.
 */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const { supabase, userId, email } = await getUser();

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, households(*)")
    .eq("user_id", userId)
    .order("joined_at")
    .limit(1)
    .maybeSingle();
  if (!membership?.households) redirect("/bem-vindo");
  const household = membership.households;

  const [members, categories, accounts] = await Promise.all([
    supabase
      .from("household_members")
      .select("user_id, display_name, role, last_payment_method, last_account_id")
      .eq("household_id", household.id)
      .order("joined_at"),
    supabase
      .from("categories")
      .select("*")
      .eq("household_id", household.id)
      .order("kind", { ascending: false })
      .order("sort_order")
      .order("name"),
    supabase.from("accounts").select("*").eq("household_id", household.id).order("created_at"),
  ]);

  const memberList = members.data ?? [];
  const me = memberList.find((m) => m.user_id === userId);
  if (!me) redirect("/bem-vindo");

  return {
    supabase,
    userId,
    email,
    household,
    me,
    members: memberList,
    categories: categories.data ?? [],
    accounts: accounts.data ?? [],
    today: todayIn(household.timezone || DEFAULT_TIMEZONE),
    savingsGoal: { mode: household.savings_goal_mode, value: household.savings_goal_value },
  };
});

export function memberName(ctx: Pick<AppContext, "members">, userId: string | null): string {
  if (!userId) return "Casa";
  return ctx.members.find((m) => m.user_id === userId)?.display_name ?? "—";
}
