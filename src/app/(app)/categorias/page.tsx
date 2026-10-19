import type { Metadata } from "next";
import Link from "next/link";
import { Card, cx, PageHeader, SectionTitle } from "@/components/ui";
import { type Category, getAppContext } from "@/lib/data/context";

export const metadata: Metadata = { title: "Categorias" };

function Row({ c, sub = false }: { c: Category; sub?: boolean }) {
  return (
    <Link
      href={`/categorias/${c.id}`}
      className={cx("flex items-center gap-3 py-2.5", sub && "pl-8", c.archived && "opacity-50")}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: `${c.color}26` }}
        aria-hidden
      >
        {c.icon}
      </span>
      <span className="flex-1 truncate">
        {c.name}
        {c.archived && <span className="ml-2 text-xs text-muted">(arquivada)</span>}
      </span>
      {c.kind === "expense" && !sub && (
        <span
          className={cx(
            "rounded-full px-2 py-0.5 text-xs",
            c.nature === "fixed" ? "bg-accent/15 text-accent" : "bg-card-2 text-muted",
          )}
        >
          {c.nature === "fixed" ? "fixa" : "variável"}
        </span>
      )}
    </Link>
  );
}

export default async function CategoriesPage() {
  const ctx = await getAppContext();
  const group = (kind: "income" | "expense") => {
    const top = ctx.categories.filter((c) => c.kind === kind && !c.parent_id);
    return top.flatMap((c) => [
      <Row key={c.id} c={c} />,
      ...ctx.categories
        .filter((s) => s.parent_id === c.id)
        .map((s) => <Row key={s.id} c={s} sub />),
    ]);
  };
  return (
    <div className="space-y-4">
      <PageHeader
        title="Categorias"
        back="/mais"
        action={
          <Link href="/categorias/nova" className="btn-primary py-2">
            + Nova
          </Link>
        }
      />
      <p className="px-1 text-sm text-muted">
        Categorias <strong>fixas</strong> entram no comprometido do mês; as{" "}
        <strong>variáveis</strong> contam na meta diária.
      </p>
      <Card>
        <SectionTitle>Despesas</SectionTitle>
        <div className="divide-y divide-line">{group("expense")}</div>
      </Card>
      <Card>
        <SectionTitle>Receitas</SectionTitle>
        <div className="divide-y divide-line">{group("income")}</div>
      </Card>
    </div>
  );
}
