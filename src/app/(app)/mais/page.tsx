import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/actions/settings";
import { Card, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/data/context";

export const metadata: Metadata = { title: "Mais" };

const LINKS = [
  { href: "/cartoes", icon: "💳", label: "Cartões", hint: "Faturas, parcelas e limite" },
  {
    href: "/recorrentes",
    icon: "🔁",
    label: "Recorrentes",
    hint: "Salários, aluguel, financiamentos",
  },
  { href: "/categorias", icon: "🏷️", label: "Categorias", hint: "Fixas e variáveis" },
  {
    href: "/configuracoes",
    icon: "⚙️",
    label: "Configurações",
    hint: "Casa, membros, meta, contas",
  },
];

export default async function MorePage() {
  const ctx = await getAppContext();
  return (
    <div className="space-y-4">
      <PageHeader title="Mais" />
      <Card className="divide-y divide-line py-1">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3 py-3">
            <span className="text-2xl" aria-hidden>
              {l.icon}
            </span>
            <span className="flex-1">
              <span className="block font-medium">{l.label}</span>
              <span className="block text-xs text-muted">{l.hint}</span>
            </span>
            <span className="text-muted">›</span>
          </Link>
        ))}
      </Card>
      <p className="px-1 text-xs text-muted">
        Orçamento por categoria, importação e exportação chegam na Fase 3.
      </p>
      <form action={signOut}>
        <button className="btn-ghost w-full">Sair ({ctx.email})</button>
      </form>
    </div>
  );
}
