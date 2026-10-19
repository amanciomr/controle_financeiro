"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, dbError, fail, ok, validationError } from "@/lib/action";
import { getAppContext } from "@/lib/data/context";
import { id, txType } from "@/lib/schemas";

const categoryInput = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, "Informe o nome.").max(40, "Nome muito longo."),
  icon: z.string().trim().min(1, "Escolha um ícone.").max(16),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  kind: txType,
  nature: z.enum(["fixed", "variable"]),
  parentId: id.nullish(),
  archived: z.boolean().default(false),
});
export type CategoryInput = z.input<typeof categoryInput>;

export async function saveCategory(raw: CategoryInput): Promise<ActionResult> {
  const parsed = categoryInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  const ctx = await getAppContext();

  if (input.parentId) {
    const parent = ctx.categories.find((c) => c.id === input.parentId);
    if (!parent) return fail("Categoria pai não encontrada.");
    if (parent.parent_id) return fail("Só é possível um nível de subcategoria.");
    if (parent.id === input.id) return fail("Uma categoria não pode ser pai dela mesma.");
    if (input.id && ctx.categories.some((c) => c.parent_id === input.id)) {
      return fail("Esta categoria tem subcategorias e não pode virar subcategoria.");
    }
  }

  const values = {
    name: input.name,
    icon: input.icon,
    color: input.color,
    kind: input.kind,
    nature: input.nature,
    parent_id: input.parentId ?? null,
    archived: input.archived,
  };
  const { error } = input.id
    ? await ctx.supabase.from("categories").update(values).eq("id", input.id)
    : await ctx.supabase.from("categories").insert({
        ...values,
        household_id: ctx.household.id,
        sort_order: 1000,
      });
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok();
}

/** Exclui se não tiver uso; caso contrário, arquiva. */
export async function deleteCategory(categoryId: string): Promise<ActionResult<{ archived: boolean }>> {
  if (!id.safeParse(categoryId).success) return fail("Categoria inválida.");
  const ctx = await getAppContext();
  const { error } = await ctx.supabase.from("categories").delete().eq("id", categoryId);
  if (!error) {
    revalidatePath("/", "layout");
    return ok({ archived: false });
  }
  if (error.code !== "23503") return dbError(error);
  const { error: archiveError } = await ctx.supabase
    .from("categories")
    .update({ archived: true })
    .eq("id", categoryId);
  if (archiveError) return dbError(archiveError);
  revalidatePath("/", "layout");
  return ok({ archived: true });
}
