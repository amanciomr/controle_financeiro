"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type CardInput, deleteCard, saveCard } from "@/app/actions/cards";
import { statementForPurchase } from "@/lib/domain/card";
import { formatDayMonth } from "@/lib/domain/dates";
import { MoneyInput } from "./money-input";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export function CardForm({
  initial,
  members,
  accounts,
  today,
}: {
  initial: CardInput;
  members: { userId: string; name: string }[];
  accounts: { id: string; name: string }[];
  today: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof CardInput>(k: K, value: CardInput[K]) =>
    setV((p) => ({ ...p, [k]: value }));
  const example = statementForPurchase(today, { closingDay: v.closingDay, dueDay: v.dueDay });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await saveCard(v);
          if (!res.ok) return setError(res.error);
          router.push("/cartoes");
        });
      }}
    >
      <div>
        <label className="label" htmlFor="card-name">
          Nome
        </label>
        <input
          id="card-name"
          className="field"
          placeholder="Nubank Rafael"
          value={v.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={60}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="card-closing">
            Dia do fechamento
          </label>
          <select
            id="card-closing"
            className="field"
            value={v.closingDay}
            onChange={(e) => set("closingDay", Number(e.target.value))}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="card-due">
            Dia do vencimento
          </label>
          <select
            id="card-due"
            className="field"
            value={v.dueDay}
            onChange={(e) => set("dueDay", Number(e.target.value))}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-muted">
        Compra feita hoje entra na fatura que fecha em {formatDayMonth(example.closingDate)} e vence
        em {formatDayMonth(example.dueDate)}. Compra no dia do fechamento já vai para a fatura
        seguinte.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="card-owner">
            Titular
          </label>
          <select
            id="card-owner"
            className="field"
            value={v.ownerUserId ?? ""}
            onChange={(e) => set("ownerUserId", e.target.value || null)}
          >
            <option value="">—</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="card-limit">
            Limite
          </label>
          <MoneyInput
            id="card-limit"
            value={v.creditLimit ?? 0}
            onChange={(c) => set("creditLimit", c || null)}
          />
        </div>
      </div>
      {accounts.length > 0 && (
        <div>
          <label className="label" htmlFor="card-pay">
            Fatura paga pela conta
          </label>
          <select
            id="card-pay"
            className="field"
            value={v.paymentAccountId ?? ""}
            onChange={(e) => set("paymentAccountId", e.target.value || null)}
          >
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {v.id && v.archived && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!v.archived}
            onChange={(e) => set("archived", !e.target.checked)}
          />
          Reativar cartão
        </label>
      )}
      {error && <p className="text-sm text-neg">{error}</p>}
      <div className="flex gap-2">
        {v.id && (
          <button
            type="button"
            className="btn-danger"
            disabled={pending}
            onClick={() =>
              confirm("Excluir este cartão? Se já tiver compras, ele só será arquivado.") &&
              start(async () => {
                const res = await deleteCard(v.id!);
                if (!res.ok) return setError(res.error);
                router.push("/cartoes");
              })
            }
          >
            Excluir
          </button>
        )}
        <button className="btn-primary flex-1" disabled={pending}>
          {pending ? "Salvando…" : "Salvar cartão"}
        </button>
      </div>
    </form>
  );
}
