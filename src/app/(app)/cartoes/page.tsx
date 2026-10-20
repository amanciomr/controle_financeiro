import type { Metadata } from "next";
import Link from "next/link";
import { PersonFilter } from "@/components/person-filter";
import { StatementBadge } from "@/components/statement-badge";
import { Card, cx, Empty, Money, PageHeader } from "@/components/ui";
import { loadCardOverview } from "@/lib/data/cards";
import { getAppContext, memberName } from "@/lib/data/context";
import { getPersonFilter } from "@/lib/data/person";
import { formatDayMonth, formatMonthBR } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Cartões" };

export default async function CardsPage() {
  const ctx = await getAppContext();
  const person = await getPersonFilter(ctx);
  const overviews = (await loadCardOverview(ctx, person)).filter(
    (o) => !o.card.archived || o.limitUsed > 0,
  );
  const members = ctx.members.map((m) => ({ userId: m.user_id, name: m.display_name }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cartões"
        back="/mais"
        action={
          <Link href="/cartoes/novo" className="btn-primary py-2">
            + Novo
          </Link>
        }
      />
      <PersonFilter value={person} members={members} />
      {overviews.length === 0 && (
        <Card>
          <Empty>
            Nenhum cartão cadastrado. Cadastre o dia de fechamento e de vencimento para o app
            calcular as faturas e as parcelas.
          </Empty>
        </Card>
      )}
      {overviews.map((o) => {
        const usedPct = o.card.limit ? Math.min(1, o.limitUsed / o.card.limit) : 0;
        const showFiltered = person !== "";
        return (
          <Link key={o.card.id} href={`/cartoes/${o.card.id}`} className="block">
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">💳 {o.card.name}</h2>
                  <p className="text-xs text-muted">
                    {memberName(ctx, o.card.ownerUserId)} · fecha dia {o.card.cycle.closingDay} ·
                    vence dia {o.card.cycle.dueDay}
                    {o.card.archived && " · arquivado"}
                  </p>
                </div>
                <span className="text-muted">›</span>
              </div>

              {o.card.limit ? (
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>
                      Limite usado <Money cents={o.limitUsed} />
                    </span>
                    <span>
                      disponível <Money cents={o.card.limit - o.limitUsed} />
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-card-2">
                    <div
                      className={cx("h-full rounded-full", usedPct > 0.9 ? "bg-neg" : "bg-accent")}
                      style={{ width: `${usedPct * 100}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {o.toPay.map((s) => (
                <div key={s.statement.month} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <StatementBadge status={s.status} /> vence {formatDayMonth(s.statement.dueDate)}
                  </span>
                  <Money
                    cents={showFiltered ? s.filteredTotal : s.total}
                    className="font-semibold"
                  />
                </div>
              ))}
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <StatementBadge status={o.open.status} /> vence{" "}
                  {formatDayMonth(o.open.statement.dueDate)}
                </span>
                <Money
                  cents={showFiltered ? o.open.filteredTotal : o.open.total}
                  className="font-semibold"
                />
              </div>

              {o.upcoming.length > 0 && (
                <div className="border-t border-line pt-2">
                  <div className="mb-1 text-xs text-muted">
                    Próximas faturas (parcelas já feitas)
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {o.upcoming.slice(0, 6).map((s) => (
                      <div key={s.statement.month}>
                        <div className="text-muted first-letter:uppercase">
                          {formatMonthBR(s.statement.month).replace(" de ", "/").slice(0, 3)}/
                          {s.statement.month.slice(2, 4)}
                        </div>
                        <Money cents={showFiltered ? s.filteredTotal : s.total} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </Link>
        );
      })}
      {person && (
        <p className="px-1 text-xs text-muted">
          Valores filtrados pela pessoa escolhida. O limite usado é sempre do cartão inteiro.
        </p>
      )}
    </div>
  );
}
