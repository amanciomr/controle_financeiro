import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ForecastCard } from "@/components/forecast-card";
import { MonthCharts } from "@/components/month-charts";
import { PersonFilter } from "@/components/person-filter";
import { Card, cx, Money, SectionTitle } from "@/components/ui";
import { cardsOf } from "@/lib/data/cards";
import { getAppContext, memberName } from "@/lib/data/context";
import {
  ensureRecurrences,
  loadCashFlow,
  loadDailyTable,
  loadExpenseHistory,
  loadMonth,
} from "@/lib/data/month";
import { getPersonFilter, personLabel } from "@/lib/data/person";
import {
  categoryComparison,
  cumulativeSeries,
  dailyBars,
  spendingByPerson,
} from "@/lib/domain/charts";
import type { DailyRow } from "@/lib/domain/daily-table";
import {
  addMonths,
  formatMonthBR,
  formatWeekdayShort,
  isYearMonth,
  monthEnd,
  monthOf,
  monthStart,
  parseDate,
} from "@/lib/domain/dates";
import { formatDecimal } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Mês" };

function Num({ cents, tone }: { cents: number | null; tone?: boolean }) {
  if (cents === null) return <span className="text-muted">—</span>;
  return (
    <span className={cx(tone && cents < 0 && "text-neg", tone && cents > 0 && "text-pos")}>
      {formatDecimal(cents)}
    </span>
  );
}

function scheduled(row: DailyRow) {
  const parts: string[] = [];
  if (row.income) parts.push(`+${formatDecimal(row.income)}`);
  if (row.committed) parts.push(`−${formatDecimal(row.committed)}`);
  return parts.join(" ");
}

export default async function MonthPage(props: PageProps<"/mes/[mes]">) {
  const { mes } = await props.params;
  if (!isYearMonth(mes)) notFound();
  const ctx = await getAppContext();
  const current = monthOf(ctx.today);
  if (mes >= current) await ensureRecurrences(ctx, monthStart(mes), monthEnd(mes));

  const person = await getPersonFilter(ctx);
  const data = await loadMonth(ctx, mes, person);
  const [rows, cash, history] = await Promise.all([
    loadDailyTable(ctx, data),
    loadCashFlow(ctx, mes, person),
    loadExpenseHistory(ctx, mes, person),
  ]);
  const { summary, forecast } = data;
  const filterLabel = personLabel(ctx, person);
  const cardNames = new Map(cardsOf(ctx.accounts).map((c) => [c.id, c.name]));
  const categoryNames: Record<string, string> = Object.fromEntries(
    ctx.categories.map((c) => [c.id, c.name]),
  );
  const previousMonths = [1, 2, 3].map((k) => addMonths(mes, -k));
  const persons = person
    ? []
    : spendingByPerson(history.filter((h) => h.date.startsWith(mes))).map((p) => ({
        name: memberName(ctx, p.personUserId),
        total: p.total,
      }));
  const variablePct =
    summary.available > 0 ? Math.min(1, summary.variableSpent / summary.available) : 1;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <Link
          href={`/mes/${addMonths(mes, -1)}`}
          className="btn-ghost px-3"
          aria-label="Mês anterior"
        >
          ‹
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-bold first-letter:uppercase">{formatMonthBR(mes)}</h1>
          {mes !== current && (
            <Link href={`/mes/${current}`} className="text-xs text-accent">
              voltar para o mês atual
            </Link>
          )}
        </div>
        <Link
          href={`/mes/${addMonths(mes, 1)}`}
          className="btn-ghost px-3"
          aria-label="Próximo mês"
        >
          ›
        </Link>
      </header>
      <PersonFilter
        value={person}
        members={ctx.members.map((m) => ({ userId: m.user_id, name: m.display_name }))}
      />

      <Card>
        <SectionTitle>Resumo{filterLabel && ` · ${filterLabel}`}</SectionTitle>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt>Receita prevista</dt>
            <dd>
              <Money cents={summary.income} className="font-semibold text-pos" />
            </dd>
          </div>
          {summary.incomePlanned > 0 && (
            <div className="flex justify-between text-xs text-muted">
              <dt className="pl-3">ainda a receber</dt>
              <dd>
                <Money cents={summary.incomePlanned} />
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Comprometido (fixos e previstos)</dt>
            <dd>
              <Money cents={-summary.committed} />
            </dd>
          </div>
          {summary.committedPlanned > 0 && (
            <div className="flex justify-between text-xs text-muted">
              <dt className="pl-3">ainda a pagar</dt>
              <dd>
                <Money cents={summary.committedPlanned} />
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Meta de poupança</dt>
            <dd>
              <Money cents={-summary.savingsGoal} />
            </dd>
          </div>
          <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
            <dt>Disponível para variáveis</dt>
            <dd>
              <Money cents={summary.available} tone="sign" />
            </dd>
          </div>
        </dl>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>
              Variável gasto: <Money cents={summary.variableSpent} />
            </span>
            <span>
              resta <Money cents={summary.remainingAvailable} />
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-card-2">
            <div
              className={cx(
                "h-full rounded-full",
                summary.remainingAvailable < 0 ? "bg-neg" : "bg-accent",
              )}
              style={{ width: `${variablePct * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Meta diária inicial <Money cents={summary.initialDailyGoal} />
            {summary.context.phase === "current" && (
              <>
                {" "}
                · hoje <Money cents={summary.dynamicDailyGoal} />
              </>
            )}
          </p>
        </div>
      </Card>

      <ForecastCard summary={summary} forecast={forecast} />

      <Card>
        <SectionTitle>Caixa do mês</SectionTitle>
        <p className="-mt-1 mb-2 text-xs text-muted">
          O que entra e sai das contas neste mês. No cartão vale o vencimento da fatura, e não a
          data da compra (essa é usada na meta diária).
        </p>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt>Entradas</dt>
            <dd>
              <Money cents={cash.income} className="font-semibold text-pos" />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Saídas à vista (Pix, débito, boletos…)</dt>
            <dd>
              <Money cents={-cash.direct} />
            </dd>
          </div>
          {cash.bills.map((b) => (
            <div key={`${b.cardId}-${b.dueDate}`} className="flex justify-between">
              <dt>
                <Link
                  href={`/cartoes/${b.cardId}?fatura=${b.dueDate.slice(0, 7)}`}
                  className="underline-offset-2 hover:underline"
                >
                  💳 Fatura {cardNames.get(b.cardId) ?? "cartão"} · vence {b.dueDate.slice(8)}/
                  {b.dueDate.slice(5, 7)}
                </Link>
              </dt>
              <dd>
                <Money cents={-b.total} />
              </dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
            <dt>Saldo do mês</dt>
            <dd>
              <Money cents={cash.net} tone="sign" />
            </dd>
          </div>
        </dl>
      </Card>

      <MonthCharts
        cumulative={cumulativeSeries(rows, summary, forecast)}
        daily={dailyBars(rows)}
        categories={categoryComparison(history, mes, previousMonths)}
        categoryNames={categoryNames}
        persons={persons}
      />

      <Card className="p-0">
        <div className="p-4 pb-2">
          <SectionTitle>Dia a dia (R$)</SectionTitle>
          <p className="text-xs text-muted">
            Gasto = variáveis realizados. Desvio positivo = abaixo da meta. Toque no dia para ver os
            lançamentos.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-xs tabular-nums">
            <thead className="text-muted">
              <tr className="border-y border-line">
                <th className="sticky left-0 bg-card px-3 py-2 text-left font-medium">Dia</th>
                <th className="px-2 py-2 font-medium">Meta</th>
                <th className="px-2 py-2 font-medium">Gasto</th>
                <th className="px-2 py-2 font-medium">Dif.</th>
                <th className="px-2 py-2 font-medium">Acum. meta</th>
                <th className="px-2 py-2 font-medium">Acum. gasto</th>
                <th className="px-2 py-2 font-medium">Desvio</th>
                <th className="px-2 py-2 font-medium">Fixos / receitas</th>
                <th className="px-3 py-2 font-medium">Saldo proj.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.date}
                  className={cx(
                    "border-b border-line last:border-0",
                    row.phase === "today" && "bg-accent/10 font-semibold",
                    row.phase === "future" && "text-muted",
                  )}
                >
                  <td
                    className={cx(
                      "sticky left-0 px-3 py-2 text-left",
                      row.phase === "today" ? "bg-card" : "bg-card",
                    )}
                  >
                    <Link
                      href={`/lancamentos?de=${row.date}&ate=${row.date}`}
                      className="block whitespace-nowrap text-fg underline-offset-2 hover:underline"
                    >
                      {String(parseDate(row.date).day).padStart(2, "0")}{" "}
                      <span className="text-muted">{formatWeekdayShort(row.date)}</span>
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <Num cents={row.goal} />
                  </td>
                  <td className="px-2 py-2">
                    <Num cents={row.spent} />
                  </td>
                  <td className="px-2 py-2">
                    <Num cents={row.difference} tone />
                  </td>
                  <td className="px-2 py-2">
                    <Num cents={row.accumulatedGoal} />
                  </td>
                  <td className="px-2 py-2">
                    <Num cents={row.accumulatedSpent} />
                  </td>
                  <td className="px-2 py-2">
                    <Num cents={row.deviation} tone />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{scheduled(row)}</td>
                  <td className="px-3 py-2">
                    {person ? <Num cents={null} /> : <Num cents={row.balance} tone />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
