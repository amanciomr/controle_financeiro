import type { MonthSummary } from "@/lib/domain/budget";
import type { Forecast } from "@/lib/domain/forecast";
import { Card, Money, SectionTitle, SignalDot } from "./ui";

const PACE_SOURCE: Record<Forecast["paceSource"], string> = {
  month: "no ritmo atual",
  previous_month: "no ritmo do mês passado",
  goal: "no ritmo da meta",
};

/** Rolling forecast: onde o mês fecha nos dois cenários, com semáforo. */
export function ForecastCard({
  summary,
  forecast,
  title = "Fechamento do mês",
}: {
  summary: MonthSummary;
  forecast: Forecast;
  title?: string;
}) {
  const past = summary.context.phase === "past";
  return (
    <Card>
      <SectionTitle>{past ? "Resultado do mês" : title}</SectionTitle>
      <div className="text-xs text-muted">
        {past ? "Sobrou" : `Vai sobrar ${PACE_SOURCE[forecast.paceSource]}`}
      </div>
      <Money cents={forecast.pace.projectedSavings} tone="sign" className="text-2xl font-bold" />
      <p className="mt-1 text-sm">
        <SignalDot signal={forecast.signal} withLabel />
      </p>
      <p className="text-xs text-muted">
        Meta de poupança: <Money cents={forecast.savingsGoal} />
      </p>
      {!past && (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
          <div>
            <div className="text-xs text-muted">Cumprindo a meta diária</div>
            <Money cents={forecast.goal.projectedSavings} tone="sign" className="font-semibold" />
          </div>
          <div>
            <div className="text-xs text-muted">Ritmo de gasto variável</div>
            <span className="font-semibold">
              <Money cents={forecast.pace.dailyRate} />
              <span className="text-xs font-normal text-muted">/dia</span>
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
