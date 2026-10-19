import Link from "next/link";
import type { Category, Member } from "@/lib/data/context";
import type { Transaction } from "@/lib/data/month";
import { formatDayMonth, formatWeekdayShort } from "@/lib/domain/dates";
import { paymentMethodLabel } from "@/lib/labels";
import { cx, Money } from "./ui";

export interface RowLookups {
  categories: Map<string, Category>;
  members: Member[];
  userId: string;
}

function nameOf(members: Member[], userId: string | null) {
  if (!userId) return "Casa";
  return members.find((m) => m.user_id === userId)?.display_name ?? "—";
}

/** Linha de lançamento: ícone, descrição, detalhes e valor. Toque abre a edição. */
export function TransactionRow({
  tx,
  lookups,
  showDate = false,
  showAuthor = false,
  hideStatus = false,
}: {
  tx: Transaction;
  lookups: RowLookups;
  showDate?: boolean;
  showAuthor?: boolean;
  /** Esconde o selo "previsto" quando a lista já é só de previstos. */
  hideStatus?: boolean;
}) {
  const category = lookups.categories.get(tx.category_id);
  const details = [
    category?.name,
    nameOf(lookups.members, tx.person_user_id),
    tx.type === "expense" && tx.payment_method ? paymentMethodLabel(tx.payment_method) : null,
    tx.installment_total ? `${tx.installment_number}/${tx.installment_total}` : null,
  ].filter(Boolean);
  const author =
    showAuthor && tx.created_by && !tx.recurrence_id
      ? `lançado por ${tx.created_by === lookups.userId ? "você" : nameOf(lookups.members, tx.created_by)}`
      : null;

  return (
    <Link
      href={`/lancamentos/${tx.id}`}
      className="flex items-center gap-3 py-2.5 active:opacity-70"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
        style={{ backgroundColor: `${category?.color ?? "#94a3b8"}26` }}
        aria-hidden
      >
        {category?.icon ?? "📦"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{tx.description}</span>
        <span className="block truncate text-xs text-muted">
          {tx.recurrence_id && <span title="Recorrente">🔁 </span>}
          {tx.status === "planned" && !hideStatus && (
            <span className="font-semibold text-warn">previsto · </span>
          )}
          {showDate && `${formatWeekdayShort(tx.date)} ${formatDayMonth(tx.date)} · `}
          {details.join(" · ")}
          {author && ` · ${author}`}
        </span>
      </span>
      <Money
        cents={tx.amount}
        tone={tx.type === "income" ? "income" : "expense"}
        className={cx("text-sm font-semibold", tx.status === "planned" && "opacity-60")}
      />
    </Link>
  );
}
