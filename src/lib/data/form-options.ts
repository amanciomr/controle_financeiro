import "server-only";
import { cache } from "react";
import type { FormOptions } from "@/components/transaction-form";
import { addDays } from "@/lib/domain/dates";
import { getAppContext } from "./context";

/**
 * Dados para o formulário de lançamento: categorias ordenadas pelas mais
 * usadas nos últimos 90 dias e descrições recentes (para sugerir a
 * categoria pela descrição).
 */
export const getFormOptions = cache(async (): Promise<FormOptions> => {
  const ctx = await getAppContext();
  const { data: recent } = await ctx.supabase
    .from("transactions")
    .select("description, category_id, type")
    .eq("household_id", ctx.household.id)
    .is("recurrence_id", null)
    .gte("date", addDays(ctx.today, -90))
    .order("created_at", { ascending: false })
    .limit(500);

  const usage = new Map<string, number>();
  const hints = new Map<string, FormOptions["hints"][number]>();
  for (const r of recent ?? []) {
    usage.set(r.category_id, (usage.get(r.category_id) ?? 0) + 1);
    const key = `${r.type}:${r.description.trim().toLowerCase()}`;
    if (!hints.has(key)) {
      hints.set(key, {
        description: r.description.trim(),
        categoryId: r.category_id,
        type: r.type,
      });
    }
  }

  const categories = ctx.categories
    .map((c, index) => ({ c, index }))
    .sort((a, b) => (usage.get(b.c.id) ?? 0) - (usage.get(a.c.id) ?? 0) || a.index - b.index)
    .map(({ c }) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      kind: c.kind,
      parentId: c.parent_id,
      archived: c.archived,
    }));

  return {
    categories,
    members: ctx.members.map((m) => ({ userId: m.user_id, name: m.display_name })),
    accounts: ctx.accounts
      .filter((a) => !a.archived && a.kind !== "credit_card")
      .map((a) => ({ id: a.id, name: a.name })),
    me: {
      userId: ctx.userId,
      lastPaymentMethod: ctx.me.last_payment_method,
      lastAccountId: ctx.me.last_account_id,
    },
    today: ctx.today,
    hints: [...hints.values()],
  };
});
