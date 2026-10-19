"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { confirmTransaction, deleteTransaction } from "@/app/actions/transactions";
import { formatDayMonth } from "@/lib/domain/dates";
import { MoneyInput } from "./money-input";
import { Money } from "./ui";

/**
 * Previsto aguardando confirmação: ✓ confirma com 1 toque; "ajustar" permite
 * corrigir o valor (contas de consumo estimadas) antes de confirmar.
 */
export function ConfirmPlanned({
  id,
  description,
  date,
  amount,
  type,
  icon,
  isEstimate,
  overdue,
}: {
  id: string;
  description: string;
  date: string;
  amount: number;
  type: "income" | "expense";
  icon: string;
  isEstimate: boolean;
  overdue: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(amount);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const confirm = (amountToSave?: number) =>
    start(async () => {
      const res = await confirmTransaction({ id, amount: amountToSave });
      if (!res.ok) setError(res.error);
    });

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-xl" aria-hidden>
          {icon}
        </span>
        <Link href={`/lancamentos/${id}`} className="min-w-0 flex-1">
          <span className="block truncate font-medium">{description}</span>
          <span className="block text-xs text-muted">
            {overdue ? "venceu " : ""}
            {formatDayMonth(date)}
            {isEstimate && " · valor estimado"}
          </span>
        </Link>
        <Money
          cents={amount}
          tone={type === "income" ? "income" : "expense"}
          className="text-sm font-semibold"
        />
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-fg disabled:opacity-50"
          aria-label={`Confirmar ${description}`}
          disabled={pending}
          onClick={() => (isEstimate && !editing ? setEditing(true) : confirm())}
        >
          ✓
        </button>
      </div>
      {editing && (
        <div className="mt-2 flex items-center gap-2 pl-9">
          <MoneyInput
            value={value}
            onChange={setValue}
            className="py-1.5"
            aria-label="Valor real"
          />
          <button
            type="button"
            className="btn-primary py-1.5"
            disabled={pending || value <= 0}
            onClick={() => confirm(value)}
          >
            Confirmar
          </button>
        </div>
      )}
      {!editing && (
        <div className="flex gap-4 pl-9 text-xs">
          {!isEstimate && (
            <button type="button" className="text-muted underline" onClick={() => setEditing(true)}>
              ajustar valor
            </button>
          )}
          <button
            type="button"
            className="text-muted underline"
            disabled={pending}
            onClick={() =>
              window.confirm(`Pular "${description}" neste mês?`) &&
              start(async () => {
                const res = await deleteTransaction(id);
                if (!res.ok) setError(res.error);
              })
            }
          >
            não vai acontecer
          </button>
        </div>
      )}
      {error && <p className="pl-9 text-xs text-neg">{error}</p>}
    </div>
  );
}
