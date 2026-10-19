import Link from "next/link";
import type { ReactNode } from "react";
import { formatBRL } from "@/lib/domain/money";
import type { Signal } from "@/lib/domain/forecast";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-2xl border border-line bg-card p-4", className)}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  back,
  action,
}: {
  title: ReactNode;
  back?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-center gap-2">
      {back && (
        <Link href={back} className="-ml-2 rounded-full p-2 text-muted" aria-label="Voltar">
          ←
        </Link>
      )}
      <h1 className="flex-1 truncate text-xl font-bold">{title}</h1>
      {action}
    </header>
  );
}

/** Valor em R$. `tone` colore por sinal (positivo verde, negativo vermelho). */
export function Money({
  cents,
  tone = "none",
  className,
  signed = false,
}: {
  cents: number;
  tone?: "none" | "sign" | "income" | "expense";
  className?: string;
  /** Prefixa "+" em positivos. */
  signed?: boolean;
}) {
  const color =
    tone === "sign"
      ? cents < 0
        ? "text-neg"
        : cents > 0
          ? "text-pos"
          : ""
      : tone === "income"
        ? "text-pos"
        : "";
  const text = formatBRL(tone === "expense" ? -Math.abs(cents) : cents);
  return (
    <span className={cx("tabular-nums whitespace-nowrap", color, className)}>
      {signed && cents > 0 ? "+" : ""}
      {text}
    </span>
  );
}

const SIGNAL_STYLES: Record<Signal, { dot: string; label: string }> = {
  green: { dot: "bg-pos", label: "No caminho da meta" },
  yellow: { dot: "bg-warn", label: "Abaixo da meta de poupança" },
  red: { dot: "bg-neg", label: "Mês vai fechar no vermelho" },
};

export function SignalDot({ signal, withLabel = false }: { signal: Signal; withLabel?: boolean }) {
  const s = SIGNAL_STYLES[signal];
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cx("inline-block h-3 w-3 rounded-full", s.dot)} aria-hidden />
      {withLabel ? <span>{s.label}</span> : <span className="sr-only">{s.label}</span>}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}

export function Stat({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="truncate text-lg font-semibold">{children}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}
