import Link from "next/link";
import { ConfirmPlanned } from "@/components/confirm-planned";
import { ForecastCard } from "@/components/forecast-card";
import { TransactionRow } from "@/components/transaction-row";
import { Card, cx, Empty, Money, SectionTitle } from "@/components/ui";
import { getAppContext } from "@/lib/data/context";
import { categoryMap, ensureRecurrences, loadMonth } from "@/lib/data/month";
import {
  addDays,
  addMonths,
  formatDayMonth,
  monthEnd,
  monthOf,
  monthStart,
  parseDate,
} from "@/lib/domain/dates";
import { MONTH_NAMES, WEEKDAYS } from "@/lib/labels";

export default async function TodayPage() {
  const ctx = await getAppContext();
  const month = monthOf(ctx.today);
  await ensureRecurrences(ctx, monthStart(month), monthEnd(addMonths(month, 1)));

  const [data, awaiting, upcoming, recent] = await Promise.all([
    loadMonth(ctx, month),
    ctx.supabase
      .from("transactions")
      .select("id, description, date, amount, type, category_id, recurrence_id")
      .eq("household_id", ctx.household.id)
      .eq("status", "planned")
      .lte("date", ctx.today)
      .order("date"),
    ctx.supabase
      .from("transactions")
      .select("*")
      .eq("household_id", ctx.household.id)
      .eq("status", "planned")
      .gt("date", ctx.today)
      .lte("date", addDays(ctx.today, 7))
      .order("date"),
    ctx.supabase
      .from("transactions")
      .select("*")
      .eq("household_id", ctx.household.id)
      .neq("status", "skipped")
      .is("recurrence_id", null)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const estimateIds = new Set<string>();
  const recurrenceIds = [
    ...new Set((awaiting.data ?? []).map((t) => t.recurrence_id).filter((x) => x !== null)),
  ];
  if (recurrenceIds.length) {
    const { data: estimates } = await ctx.supabase
      .from("recurrences")
      .select("id")
      .in("id", recurrenceIds)
      .eq("is_estimate", true);
    for (const r of estimates ?? []) estimateIds.add(r.id);
  }

  const { summary, forecast } = data;
  const categories = categoryMap(ctx);
  const lookups = { categories, members: ctx.members, userId: ctx.userId };
  const { day, month: m } = parseDate(ctx.today);
  const weekday = WEEKDAYS[new Date(`${ctx.today}T12:00:00Z`).getUTCDay()];
  const over = summary.canSpendToday < 0;
  const spentRatio =
    summary.dynamicDailyGoal > 0
      ? Math.min(1, summary.variableSpentToday / summary.dynamicDailyGoal)
      : 1;

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-sm text-muted first-letter:uppercase">
            {weekday}, {day} de {MONTH_NAMES[m - 1]}
          </p>
          <h1 className="text-xl font-bold">Olá, {ctx.me.display_name}</h1>
        </div>
        <Link href="/configuracoes" className="text-sm text-muted">
          {ctx.household.name}
        </Link>
      </header>

      <Card className="text-center">
        <p className="text-sm text-muted">
          {over ? "Hoje vocês passaram da meta em" : "Ainda dá para gastar hoje"}
        </p>
        <p className={cx("my-1 text-5xl font-bold tracking-tight", over ? "text-neg" : "text-pos")}>
          <Money cents={Math.abs(summary.canSpendToday)} />
        </p>
        <div className="mx-auto mt-3 h-2 max-w-xs overflow-hidden rounded-full bg-card-2">
          <div
            className={cx("h-full rounded-full", over ? "bg-neg" : "bg-pos")}
            style={{ width: `${spentRatio * 100}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-xs text-muted">Gasto hoje</div>
            <Money cents={summary.variableSpentToday} className="font-semibold" />
          </div>
          <div>
            <div className="text-xs text-muted">Meta de hoje</div>
            <Money cents={summary.dynamicDailyGoal} className="font-semibold" />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Restam <Money cents={summary.remainingAvailable} /> para gastos variáveis em{" "}
          {summary.context.remainingDays} {summary.context.remainingDays === 1 ? "dia" : "dias"}
        </p>
      </Card>

      <Link href={`/mes/${month}`} className="block">
        <ForecastCard summary={summary} forecast={forecast} />
      </Link>

      {(awaiting.data?.length ?? 0) > 0 && (
        <Card>
          <SectionTitle>Aguardando confirmação</SectionTitle>
          <div className="divide-y divide-line">
            {awaiting.data!.map((t) => (
              <ConfirmPlanned
                key={t.id}
                id={t.id}
                description={t.description}
                date={t.date}
                amount={t.amount}
                type={t.type}
                icon={categories.get(t.category_id)?.icon ?? "📦"}
                isEstimate={t.recurrence_id ? estimateIds.has(t.recurrence_id) : false}
                overdue={t.date < ctx.today}
              />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>Próximos 7 dias</SectionTitle>
        {upcoming.data?.length ? (
          <div className="divide-y divide-line">
            {upcoming.data.map((t) => (
              <TransactionRow key={t.id} tx={t} lookups={lookups} showDate hideStatus />
            ))}
          </div>
        ) : (
          <Empty>Nada agendado até {formatDayMonth(addDays(ctx.today, 7))}.</Empty>
        )}
      </Card>

      <Card>
        <SectionTitle
          action={
            <Link href="/lancamentos" className="text-sm text-accent">
              ver todos
            </Link>
          }
        >
          Últimos lançamentos
        </SectionTitle>
        {recent.data?.length ? (
          <div className="divide-y divide-line">
            {recent.data.map((t) => (
              <TransactionRow key={t.id} tx={t} lookups={lookups} showDate showAuthor />
            ))}
          </div>
        ) : (
          <Empty>Nenhum lançamento ainda. Toque no + para começar.</Empty>
        )}
      </Card>
    </div>
  );
}
