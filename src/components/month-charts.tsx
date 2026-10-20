"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryComparison, CumulativePoint, DailyBar } from "@/lib/domain/charts";
import { formatAxis, formatBRL } from "@/lib/domain/money";
import { Card, SectionTitle } from "./ui";

// Ordem fixa da paleta categórica (validada para daltonismo nos dois temas).
const S1 = "var(--series-1)";
const S2 = "var(--series-2)";
const S3 = "var(--series-3)";
const MUTED = "var(--muted)";
const GRID = "var(--grid)";

const axisProps = {
  stroke: MUTED,
  tick: { fill: "var(--muted)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

// Texto da legenda em tinta neutra; a cor fica só no marcador.
const legendText = (value: string) => <span style={{ color: "var(--muted)" }}>{value}</span>;

const money = (v: unknown) => (typeof v === "number" ? formatBRL(v) : "—");
const tooltipStyle = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: 12,
    color: "var(--fg)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--muted)" },
  itemStyle: { color: "var(--fg)", padding: 0 },
};

function ChartCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {hint && <p className="-mt-1 mb-2 text-xs text-muted">{hint}</p>}
      <div className="h-56 w-full">{children}</div>
    </Card>
  );
}

export function MonthCharts({
  cumulative,
  daily,
  categories,
  categoryNames,
  persons,
}: {
  cumulative: CumulativePoint[];
  daily: DailyBar[];
  categories: CategoryComparison[];
  categoryNames: Record<string, string>;
  /** Vazio quando há filtro por pessoa. */
  persons: { name: string; total: number }[];
}) {
  const categoryData = categories.map((c) => ({
    // "Alimentação/Mercado" → "Alimentação": cabe no eixo de 380px.
    name: (categoryNames[c.categoryId] ?? "Outras").split("/")[0],
    current: c.current,
    average: c.average,
  }));

  return (
    <div className="space-y-4">
      <ChartCard
        title="Acumulado do mês"
        hint="Gasto variável acumulado comparado com a meta e com a projeção no ritmo atual."
      >
        <ResponsiveContainer>
          <LineChart data={cumulative} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="day" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
            <YAxis {...axisProps} width={44} tickFormatter={formatAxis} />
            <Tooltip {...tooltipStyle} formatter={money} labelFormatter={(d) => `Dia ${d}`} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
            <Line
              name="Realizado"
              dataKey="realized"
              stroke={S1}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              name="Meta"
              dataKey="goal"
              stroke={S2}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              name="Projeção"
              dataKey="projection"
              stroke={S3}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Gasto por dia" hint="Barras: gasto variável do dia. Linha: meta do dia.">
        <ResponsiveContainer>
          <ComposedChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="day" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
            <YAxis {...axisProps} width={44} tickFormatter={formatAxis} />
            <Tooltip
              {...tooltipStyle}
              formatter={money}
              labelFormatter={(d) => `Dia ${d}`}
              cursor={{ fill: "var(--card-2)" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
            <Bar
              name="Gasto"
              dataKey="spent"
              fill={S1}
              radius={[4, 4, 0, 0]}
              maxBarSize={14}
              isAnimationActive={false}
            />
            <Line
              name="Meta do dia"
              dataKey="goal"
              type="stepAfter"
              stroke={S2}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {categoryData.length > 0 && (
        <Card>
          <SectionTitle>Por categoria</SectionTitle>
          <p className="-mt-1 mb-2 text-xs text-muted">
            Todas as despesas do mês comparadas com a média dos 3 meses anteriores.
          </p>
          <div className="w-full" style={{ height: Math.max(160, categoryData.length * 52 + 40) }}>
            <ResponsiveContainer>
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                barGap={2}
              >
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" {...axisProps} tickFormatter={formatAxis} />
                <YAxis type="category" dataKey="name" {...axisProps} width={92} />
                <Tooltip {...tooltipStyle} formatter={money} cursor={{ fill: "var(--card-2)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
                <Bar
                  name="Este mês"
                  dataKey="current"
                  fill={S1}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={14}
                  isAnimationActive={false}
                />
                <Bar
                  name="Média 3 meses"
                  dataKey="average"
                  fill={S2}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={14}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {persons.length > 0 && (
        <Card>
          <SectionTitle>Por pessoa</SectionTitle>
          <p className="-mt-1 mb-2 text-xs text-muted">Todas as despesas do mês.</p>
          <div className="w-full" style={{ height: persons.length * 44 + 24 }}>
            <ResponsiveContainer>
              <BarChart
                data={persons}
                layout="vertical"
                margin={{ top: 0, right: 72, bottom: 0, left: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" {...axisProps} width={72} />
                <Tooltip {...tooltipStyle} formatter={money} cursor={{ fill: "var(--card-2)" }} />
                <Bar
                  name="Despesas"
                  dataKey="total"
                  fill={S1}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                  isAnimationActive={false}
                  label={{
                    position: "right",
                    fill: "var(--fg)",
                    fontSize: 12,
                    formatter: (v: unknown) => (typeof v === "number" ? formatBRL(v) : ""),
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
