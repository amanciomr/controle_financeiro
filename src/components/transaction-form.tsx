"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  deleteTransaction,
  saveTransaction,
  type TransactionInput,
} from "@/app/actions/transactions";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/labels";
import { MoneyInput } from "./money-input";
import { cx } from "./ui";

export interface FormCategory {
  id: string;
  name: string;
  icon: string;
  kind: "income" | "expense";
  parentId: string | null;
  archived: boolean;
}

export interface FormOptions {
  /** Ordenadas pelas mais usadas primeiro. */
  categories: FormCategory[];
  members: { userId: string; name: string }[];
  accounts: { id: string; name: string }[];
  me: { userId: string; lastPaymentMethod: PaymentMethod | null; lastAccountId: string | null };
  today: string;
  /** Descrições recentes → categoria usada (sugestão de categoria). */
  hints: { description: string; categoryId: string; type: "income" | "expense" }[];
}

export interface TransactionValues {
  id?: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  categoryId: string | null;
  paymentMethod: PaymentMethod | null;
  accountId: string | null;
  personUserId: string | null;
  date: string;
  status?: "planned" | "done";
  notes: string;
}

const CASA = "casa";
const QUICK_CATEGORY_COUNT = 8;

export function emptyValues(options: FormOptions): TransactionValues {
  return {
    type: "expense",
    amount: 0,
    description: "",
    categoryId: null,
    paymentMethod: options.me.lastPaymentMethod ?? "pix",
    accountId: options.me.lastAccountId,
    personUserId: options.me.userId,
    date: options.today,
    notes: "",
  };
}

function normalize(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function TransactionForm({
  options,
  initial,
  variant,
  onSaved,
  onDeleted,
  amountRef,
}: {
  options: FormOptions;
  initial: TransactionValues;
  variant: "quick" | "full";
  onSaved?: () => void;
  onDeleted?: () => void;
  amountRef?: React.Ref<HTMLInputElement>;
}) {
  const [v, setV] = useState<TransactionValues>(initial);
  const [showMore, setShowMore] = useState(variant === "full");
  const [showAllCategories, setShowAllCategories] = useState(variant === "full");
  const [categoryTouched, setCategoryTouched] = useState(Boolean(initial.categoryId));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const descriptionRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof TransactionValues>(key: K, value: TransactionValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const categories = useMemo(
    () =>
      options.categories.filter(
        (c) => c.kind === v.type && (!c.archived || c.id === initial.categoryId),
      ),
    [options.categories, v.type, initial.categoryId],
  );
  const visibleCategories = showAllCategories
    ? categories
    : (() => {
        const top = categories.slice(0, QUICK_CATEGORY_COUNT);
        const selected = categories.find((c) => c.id === v.categoryId);
        return selected && !top.includes(selected) ? [selected, ...top.slice(0, -1)] : top;
      })();

  const hintsForType = useMemo(
    () => options.hints.filter((h) => h.type === v.type),
    [options.hints, v.type],
  );

  function onDescriptionChange(description: string) {
    setV((prev) => {
      const next = { ...prev, description };
      // Sugere a categoria usada antes com a mesma descrição.
      if (!categoryTouched) {
        const hint = hintsForType.find((h) => normalize(h.description) === normalize(description));
        if (hint) next.categoryId = hint.categoryId;
      }
      return next;
    });
  }

  function switchType(type: "income" | "expense") {
    setV((prev) => ({
      ...prev,
      type,
      categoryId: null,
      personUserId: prev.personUserId,
    }));
    setCategoryTouched(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (v.amount <= 0) return setError("Informe o valor.");
    if (!v.description.trim()) {
      descriptionRef.current?.focus();
      return setError("Informe a descrição.");
    }
    if (!v.categoryId) return setError("Escolha uma categoria.");
    const input: TransactionInput = {
      id: v.id,
      type: v.type,
      amount: v.amount,
      description: v.description,
      categoryId: v.categoryId,
      paymentMethod: v.paymentMethod,
      accountId: v.accountId,
      personUserId: v.personUserId,
      date: v.date,
      status: v.status,
      notes: v.notes,
    };
    start(async () => {
      const res = await saveTransaction(input);
      if (!res.ok) return setError(res.error);
      onSaved?.();
    });
  }

  function remove() {
    if (!v.id || !confirm("Excluir este lançamento?")) return;
    start(async () => {
      const res = await deleteTransaction(v.id!);
      if (!res.ok) return setError(res.error);
      onDeleted?.();
    });
  }

  const isFuture = v.date > options.today;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-card-2 p-1" role="radiogroup">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={v.type === t}
            onClick={() => switchType(t)}
            className={cx(
              "rounded-lg py-2 text-sm font-semibold",
              v.type === t ? "bg-card text-fg shadow-sm" : "text-muted",
            )}
          >
            {t === "expense" ? "Despesa" : "Receita"}
          </button>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="tx-amount">
          Valor
        </label>
        <MoneyInput
          id="tx-amount"
          ref={amountRef}
          value={v.amount}
          onChange={(amount) => set("amount", amount)}
          className={cx(
            "py-3 text-center text-3xl font-bold",
            v.type === "income" ? "text-pos" : "",
          )}
        />
      </div>

      <div>
        <label className="label" htmlFor="tx-desc">
          Descrição
        </label>
        <input
          id="tx-desc"
          ref={descriptionRef}
          className="field"
          value={v.description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          list="tx-desc-hints"
          placeholder={v.type === "expense" ? "Mercado, padaria, Uber…" : "Salário, freela…"}
          maxLength={120}
          enterKeyHint="next"
          autoCapitalize="sentences"
        />
        <datalist id="tx-desc-hints">
          {hintsForType.slice(0, 50).map((h) => (
            <option key={h.description} value={h.description} />
          ))}
        </datalist>
      </div>

      <div>
        <div className="label">Categoria</div>
        <div className="flex flex-wrap gap-2">
          {visibleCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={v.categoryId === c.id}
              onClick={() => {
                set("categoryId", c.id);
                setCategoryTouched(true);
              }}
            >
              <span aria-hidden>{c.icon}</span>
              {c.name}
            </button>
          ))}
          {categories.length > visibleCategories.length && (
            <button
              type="button"
              className="chip text-muted"
              onClick={() => setShowAllCategories(true)}
            >
              + todas
            </button>
          )}
        </div>
      </div>

      {v.type === "expense" && (
        <div>
          <div className="label">Forma de pagamento</div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {PAYMENT_METHODS.map((p) => (
              <button
                key={p.value}
                type="button"
                className="chip"
                aria-pressed={v.paymentMethod === p.value}
                onClick={() => set("paymentMethod", p.value)}
              >
                <span aria-hidden>{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!showMore ? (
        <button
          type="button"
          className="text-sm text-muted underline"
          onClick={() => setShowMore(true)}
        >
          Mais opções (data, pessoa, conta, observação)
        </button>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="tx-date">
                Data
              </label>
              <input
                id="tx-date"
                type="date"
                className="field"
                value={v.date}
                onChange={(e) => e.target.value && set("date", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="tx-person">
                {v.type === "expense" ? "Gasto de" : "Receita de"}
              </label>
              <select
                id="tx-person"
                className="field"
                value={v.personUserId ?? CASA}
                onChange={(e) =>
                  set("personUserId", e.target.value === CASA ? null : e.target.value)
                }
              >
                {options.members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
                <option value={CASA}>Casa (compartilhado)</option>
              </select>
            </div>
          </div>
          {options.accounts.length > 0 && (
            <div>
              <label className="label" htmlFor="tx-account">
                Conta
              </label>
              <select
                id="tx-account"
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
            <label className="label" htmlFor="tx-notes">
              Observação
            </label>
            <textarea
              id="tx-notes"
              className="field"
              rows={2}
              maxLength={500}
              value={v.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          {variant === "full" && (
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--accent)]"
                checked={(v.status ?? (isFuture ? "planned" : "done")) === "done"}
                onChange={(e) => set("status", e.target.checked ? "done" : "planned")}
              />
              {v.type === "expense" ? "Já foi pago" : "Já foi recebido"}
              <span className="text-muted">(desmarcado = previsto)</span>
            </label>
          )}
        </div>
      )}

      {variant === "quick" && isFuture && (
        <p className="text-xs text-muted">Data futura: será lançado como previsto.</p>
      )}
      {error && (
        <p className="text-sm text-neg" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {variant === "full" && v.id && (
          <button type="button" className="btn-danger" onClick={remove} disabled={pending}>
            Excluir
          </button>
        )}
        <button className="btn-primary flex-1 py-3 text-base" disabled={pending}>
          {pending ? "Salvando…" : v.id ? "Salvar alterações" : "Lançar"}
        </button>
      </div>
    </form>
  );
}
