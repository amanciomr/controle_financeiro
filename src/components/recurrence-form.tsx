"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteRecurrence, type RecurrenceInput, saveRecurrence } from "@/app/actions/recurrences";
import { financingStartDate, installmentOfMonth } from "@/lib/domain/recurrence";
import {
  FREQUENCIES,
  type Frequency,
  MONTH_NAMES,
  PAYMENT_METHODS,
  type PaymentMethod,
  WEEKDAYS,
} from "@/lib/labels";
import { MoneyInput } from "./money-input";
import type { FormOptions } from "./transaction-form";
import { cx } from "./ui";

export interface RecurrenceValues {
  id?: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  isEstimate: boolean;
  categoryId: string;
  paymentMethod: PaymentMethod | null;
  accountId: string | null;
  personUserId: string | null;
  frequency: Frequency;
  dayOfMonth: number;
  monthOfYear: number;
  weekday: number;
  startDate: string;
  endDate: string;
  totalInstallments: number | null;
  active: boolean;
  notes: string;
}

const CASA = "casa";

export function RecurrenceForm({
  options,
  initial,
}: {
  options: FormOptions;
  initial: RecurrenceValues;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [financing, setFinancing] = useState(initial.totalInstallments != null);
  const [currentInstallment, setCurrentInstallment] = useState(
    initial.totalInstallments != null ? installmentOfMonth(initial.startDate, options.today) : 1,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof RecurrenceValues>(k: K, value: RecurrenceValues[K]) =>
    setV((prev) => ({ ...prev, [k]: value }));

  const categories = options.categories.filter(
    (c) => c.kind === v.type && (!c.archived || c.id === initial.categoryId),
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (v.amount <= 0) return setError("Informe o valor.");
    if (!v.categoryId) return setError("Escolha uma categoria.");
    const isFinancing = financing && v.frequency === "monthly";
    if (isFinancing && (!v.totalInstallments || currentInstallment > v.totalInstallments)) {
      return setError("A parcela atual não pode passar do total de parcelas.");
    }
    const input: RecurrenceInput = {
      id: v.id,
      type: v.type,
      description: v.description,
      amount: v.amount,
      isEstimate: v.isEstimate,
      categoryId: v.categoryId,
      paymentMethod: v.paymentMethod,
      accountId: v.accountId,
      personUserId: v.personUserId,
      frequency: v.frequency,
      dayOfMonth: v.dayOfMonth,
      monthOfYear: v.monthOfYear,
      weekday: v.weekday,
      startDate: isFinancing ? financingStartDate(options.today, currentInstallment) : v.startDate,
      endDate: isFinancing ? null : v.endDate || null,
      totalInstallments: isFinancing ? v.totalInstallments : null,
      active: v.active,
      notes: v.notes,
    };
    start(async () => {
      const res = await saveRecurrence(input);
      if (!res.ok) return setError(res.error);
      router.push("/recorrentes");
    });
  }

  function remove() {
    if (!v.id) return;
    if (!confirm("Excluir esta recorrência? Os previstos futuros também serão removidos.")) return;
    start(async () => {
      const res = await deleteRecurrence(v.id!);
      if (!res.ok) return setError(res.error);
      router.push("/recorrentes");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-card-2 p-1" role="radiogroup">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={v.type === t}
            onClick={() => setV((p) => ({ ...p, type: t, categoryId: "" }))}
            className={cx(
              "rounded-lg py-2 text-sm font-semibold",
              v.type === t ? "bg-card text-fg shadow-sm" : "text-muted",
            )}
          >
            {t === "expense" ? "Despesa fixa" : "Receita fixa"}
          </button>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="r-desc">
          Descrição
        </label>
        <input
          id="r-desc"
          className="field"
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder={
            v.type === "expense" ? "Aluguel, internet, financiamento…" : "Salário Rafael"
          }
          maxLength={120}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="r-amount">
          Valor {v.isEstimate && "(estimado)"}
        </label>
        <MoneyInput
          id="r-amount"
          value={v.amount}
          onChange={(c) => set("amount", c)}
          className="text-xl font-semibold"
        />
        {v.type === "expense" && (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={v.isEstimate}
              onChange={(e) => set("isEstimate", e.target.checked)}
            />
            Valor varia (conta de consumo): confirmo o valor real quando chegar
          </label>
        )}
      </div>

      <div>
        <label className="label" htmlFor="r-cat">
          Categoria
        </label>
        <select
          id="r-cat"
          className="field"
          value={v.categoryId}
          onChange={(e) => set("categoryId", e.target.value)}
          required
        >
          <option value="">Escolha…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="r-freq">
            Frequência
          </label>
          <select
            id="r-freq"
            className="field"
            value={v.frequency}
            onChange={(e) => set("frequency", e.target.value as Frequency)}
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        {v.frequency === "weekly" ? (
          <div>
            <label className="label" htmlFor="r-wd">
              Dia da semana
            </label>
            <select
              id="r-wd"
              className="field"
              value={v.weekday}
              onChange={(e) => set("weekday", Number(e.target.value))}
            >
              {WEEKDAYS.map((w, i) => (
                <option key={w} value={i}>
                  {w}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="r-day">
              Dia do mês
            </label>
            <select
              id="r-day"
              className="field"
              value={v.dayOfMonth}
              onChange={(e) => set("dayOfMonth", Number(e.target.value))}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {v.frequency === "yearly" && (
        <div>
          <label className="label" htmlFor="r-month">
            Mês
          </label>
          <select
            id="r-month"
            className="field"
            value={v.monthOfYear}
            onChange={(e) => set("monthOfYear", Number(e.target.value))}
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}
      {v.frequency === "monthly" && v.dayOfMonth > 28 && (
        <p className="text-xs text-muted">Em meses mais curtos, cai no último dia do mês.</p>
      )}

      {v.type === "expense" && v.frequency === "monthly" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={financing}
            onChange={(e) => {
              setFinancing(e.target.checked);
              if (e.target.checked && !v.totalInstallments) set("totalInstallments", 12);
            }}
          />
          É financiamento / tem número de parcelas
        </label>
      )}

      {financing && v.frequency === "monthly" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="r-total">
              Total de parcelas
            </label>
            <input
              id="r-total"
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              className="field"
              value={v.totalInstallments ?? ""}
              onChange={(e) =>
                set("totalInstallments", e.target.value ? Number(e.target.value) : null)
              }
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="r-current">
              Parcela deste mês
            </label>
            <input
              id="r-current"
              type="number"
              inputMode="numeric"
              min={1}
              max={v.totalInstallments ?? 600}
              className="field"
              value={currentInstallment}
              onChange={(e) => setCurrentInstallment(Math.max(1, Number(e.target.value) || 1))}
              required
            />
          </div>
          {v.totalInstallments != null && (
            <p className="col-span-2 text-xs text-muted">
              Faltam {Math.max(0, v.totalInstallments - currentInstallment + 1)} parcelas contando a
              deste mês.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="r-start">
              Começa em
            </label>
            <input
              id="r-start"
              type="date"
              className="field"
              value={v.startDate}
              onChange={(e) => e.target.value && set("startDate", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="r-end">
              Termina em (opcional)
            </label>
            <input
              id="r-end"
              type="date"
              className="field"
              value={v.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="r-person">
            De quem
          </label>
          <select
            id="r-person"
            className="field"
            value={v.personUserId ?? CASA}
            onChange={(e) => set("personUserId", e.target.value === CASA ? null : e.target.value)}
          >
            {options.members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
            <option value={CASA}>Casa</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="r-pm">
            Forma
          </label>
          <select
            id="r-pm"
            className="field"
            value={v.paymentMethod ?? ""}
            onChange={(e) => set("paymentMethod", (e.target.value || null) as PaymentMethod | null)}
          >
            <option value="">—</option>
            {PAYMENT_METHODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {options.accounts.length > 0 && (
        <div>
          <label className="label" htmlFor="r-acc">
            Conta
          </label>
          <select
            id="r-acc"
            className="field"
            value={v.accountId ?? ""}
            onChange={(e) => set("accountId", e.target.value || null)}
          >
            <option value="">—</option>
            {options.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label" htmlFor="r-notes">
          Observação
        </label>
        <textarea
          id="r-notes"
          className="field"
          rows={2}
          maxLength={500}
          value={v.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      {v.id && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={v.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          Ativa (desmarque para pausar e remover os previstos futuros)
        </label>
      )}

      {error && (
        <p className="text-sm text-neg" role="alert">
          {error}
        </p>
      )}
      <p className="text-xs text-muted">
        Salvar refaz os previstos de hoje em diante. Lançamentos já confirmados não mudam.
      </p>
      <div className="flex gap-2">
        {v.id && (
          <button type="button" className="btn-danger" onClick={remove} disabled={pending}>
            Excluir
          </button>
        )}
        <button className="btn-primary flex-1 py-3" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
