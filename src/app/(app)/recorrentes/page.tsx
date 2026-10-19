import type { Metadata } from "next";
import Link from "next/link";
import { Card, cx, Empty, Money, PageHeader, SectionTitle } from "@/components/ui";
import { getAppContext, memberName } from "@/lib/data/context";
import { categoryMap, type Recurrence, recurrenceRule } from "@/lib/data/month";
import { formatMonthBR, monthOf } from "@/lib/domain/dates";
import { installmentProgress } from "@/lib/domain/recurrence";
import { frequencyDescription } from "@/lib/labels";

export const metadata: Metadata = { title: "Recorrentes" };

export default async function RecurrencesPage() {
  const ctx = await getAppContext();
  const { data } = await ctx.supabase
    .from("recurrences")
    .select("*")
    .eq("household_id", ctx.household.id)
    .order("active", { ascending: false })
    .order("day_of_month")
    .order("description");
  const categories = categoryMap(ctx);
  const recurrences = data ?? [];
  const income = recurrences.filter((r) => r.type === "income");
  const expense = recurrences.filter((r) => r.type === "expense");
  const monthly = (list: Recurrence[]) =>
    list.filter((r) => r.active && r.frequency === "monthly").reduce((s, r) => s + r.amount, 0);

  const renderList = (list: Recurrence[]) =>
    list.length === 0 ? (
      <Empty>Nada cadastrado.</Empty>
    ) : (
      <div className="divide-y divide-line">
        {list.map((r) => {
          const progress = installmentProgress(recurrenceRule(r), ctx.today);
          const category = categories.get(r.category_id);
          return (
            <Link
              key={r.id}
              href={`/recorrentes/${r.id}`}
              className={cx("flex items-center gap-3 py-2.5", !r.active && "opacity-50")}
            >
              <span className="text-xl" aria-hidden>
                {category?.icon ?? "📦"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {r.description}
                  {!r.active && <span className="ml-2 text-xs text-muted">(pausada)</span>}
                </span>
                <span className="block truncate text-xs text-muted">
                  {frequencyDescription(r)} · {memberName(ctx, r.person_user_id)}
                  {progress &&
                    (progress.remaining > 0
                      ? ` · parcela ${progress.elapsed}/${progress.total}, faltam ${progress.remaining} (até ${formatMonthBR(monthOf(progress.last!.date))})`
                      : " · quitado")}
                </span>
              </span>
              <span className="text-right text-sm font-semibold">
                {r.is_estimate && <span className="text-xs font-normal text-muted">≈ </span>}
                <Money cents={r.amount} tone={r.type === "income" ? "income" : "expense"} />
              </span>
            </Link>
          );
        })}
      </div>
    );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recorrentes"
        back="/mais"
        action={
          <Link href="/recorrentes/nova" className="btn-primary py-2">
            + Nova
          </Link>
        }
      />
      <Card>
        <SectionTitle action={<Money cents={monthly(income)} tone="income" className="text-sm" />}>
          Receitas
        </SectionTitle>
        {renderList(income)}
      </Card>
      <Card>
        <SectionTitle
          action={<Money cents={monthly(expense)} tone="expense" className="text-sm" />}
        >
          Despesas fixas
        </SectionTitle>
        {renderList(expense)}
      </Card>
      <p className="px-1 text-xs text-muted">
        Os totais somam as recorrências mensais ativas. Cada recorrência gera um lançamento previsto
        no mês, que vocês confirmam com um toque na tela Hoje.
      </p>
    </div>
  );
}
