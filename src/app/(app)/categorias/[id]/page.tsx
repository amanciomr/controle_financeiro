import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/category-form";
import { PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/data/context";

export const metadata: Metadata = { title: "Categoria" };

/** /categorias/nova cria; /categorias/<id> edita. */
export default async function CategoryPage(props: PageProps<"/categorias/[id]">) {
  const { id } = await props.params;
  const ctx = await getAppContext();
  const isNew = id === "nova";
  const category = isNew ? null : ctx.categories.find((c) => c.id === id);
  if (!isNew && !category) notFound();

  const parents = ctx.categories
    .filter((c) => !c.archived)
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon, kind: c.kind, parentId: c.parent_id }));

  return (
    <div>
      <PageHeader title={isNew ? "Nova categoria" : "Editar categoria"} back="/categorias" />
      <CategoryForm
        parents={parents}
        initial={
          category
            ? {
                id: category.id,
                name: category.name,
                icon: category.icon,
                color: category.color,
                kind: category.kind,
                nature: category.nature,
                parentId: category.parent_id,
                archived: category.archived,
              }
            : {
                name: "",
                icon: "📦",
                color: "#64748b",
                kind: "expense",
                nature: "variable",
                parentId: null,
                archived: false,
              }
        }
      />
    </div>
  );
}
