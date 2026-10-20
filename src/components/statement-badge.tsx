import type { StatementStatus } from "@/lib/domain/card";
import { cx } from "./ui";

const LABELS: Record<StatementStatus, { text: string; className: string }> = {
  future: { text: "futura", className: "bg-card-2 text-muted" },
  open: { text: "aberta", className: "bg-accent/15 text-accent" },
  closed: { text: "fechada", className: "bg-warn/15 text-warn" },
  overdue: { text: "vencida", className: "bg-neg/15 text-neg" },
  paid: { text: "paga", className: "bg-card-2 text-muted" },
};

export function StatementBadge({ status }: { status: StatementStatus }) {
  const l = LABELS[status];
  return (
    <span className={cx("rounded-full px-2 py-0.5 text-xs font-semibold", l.className)}>
      {l.text}
    </span>
  );
}
