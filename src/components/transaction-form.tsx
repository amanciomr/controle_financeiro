"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  deletePurchase,
  deleteTransaction,
  saveTransaction,
  type TransactionInput,
} from "@/app/actions/transactions";
import { planInstallments } from "@/lib/domain/card";
import { formatDayMonth } from "@/lib/domain/dates";
import { formatBRL } from "@/lib/domain/money";
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
  /** Cartões de crédito ativos. */
  cards: { id: string; name: string; closingDay: number; dueDay: number }[];
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
  /** Compra no cartão. */
  cardId: string | null;
  installments: number;
  /** Ao editar uma compra no cartão existente. */
  purchaseId?: string;
}

const CASA = "casa";
const QUICK_CATEGORY_COUNT = 8;
const INSTALLMENT_OPTIONS = Array.from({ length: 24 }, (_, i) => i + 1);

export function emptyValues(options: FormOptions): TransactionValues {
  const last = options.me.lastAccountId;
  return {
    type: "expense",
    amount: 0,
    description: "",
    categoryId: null,
    paymentMethod: options.me.lastPaymentMethod ?? "pix",
    accountId: options.accounts.some((a) => a.id === last) ? last : null,
    personUserId: options.me.userId,
    date: options.today,
    notes: "",
    cardId: options.cards.find((c) => c.id === last)?.id ?? options.cards[0]?.id ?? null,
    installments: 1,
  };
}

function normalize(s: string) {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
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
    if (onCard && !v.cardId) return setError("Escolha o cartão.");
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
      status: onCard ? undefined : v.status,
      notes: v.notes,
      cardId: onCard ? v.cardId : null,
      installments: onCard ? v.installments : 1,
      purchaseId: v.purchaseId,
    };
    start(async () => {
      const res = await saveTransaction(input);
      if (!res.ok) return setError(res.error);
      onSaved?.();
    });
  }

  function remove() {
    if (v.purchaseId) {
      if (!confirm("Excluir esta compra e todas as parcelas?")) return;
    } else if (!v.id || !confirm("Excluir este lançamento?")) return;
    start(async () => {
      const res = v.purchaseId
        ? await deletePurchase(v.purchaseId)
        : await deleteTransaction(v.id!);
      if (!res.ok) return setError(res.error);
      onDeleted?.();
    });
  }

  const isFuture = v.date > options.today;
  const onCard =
    v.type === "expense" && v.paymentMethod === "credit_card" && options.cards.length > 0;
  const selectedCard = options.cards.find((c) => c.id === v.cardId);
  const plan =
    onCard && selectedCard && v.amount > 0
      ? planInstallments({
          purchaseDate: v.date,
          total: v.amount,
          count: v.installments,
          card: selectedCard,
        })
      : null;

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

      {onCard && (
        <div className="space-y-3 rounded-xl border border-line bg-card-2 p-3">
          <div className="flex flex-wrap gap-2">
            {options.cards.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={v.cardId === c.id}
                onClick={() => set("cardId", c.id)}
              >
                💳 {c.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted" htmlFor="tx-installments">
              Parcelas
            </label>
            <select
              id="tx-installments"
              className="field w-24! py-1.5"
              value={v.installments}
              onChange={(e) => set("installments", Number(e.target.value))}
            >
              {INSTALLMENT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "À vista" : `${n}x`}
                </option>
              ))}
            </select>
            {plan && v.installments > 1 && (
              <span className="text-sm text-muted">de {formatBRL(plan[1].amount)}</span>
            )}
          </div>
          {plan && (
            <p className="text-xs text-muted">
              {v.installments > 1 ? "1ª parcela na fatura" : "Entra na fatura"} que vence em{" "}
              <strong className="text-fg">{formatDayMonth(plan[0].statement.dueDate)}</strong>
              {v.installments > 1 &&
                `; a última vence em ${formatDayMonth(plan[plan.length - 1].statement.dueDate)}/${plan[plan.length - 1].statement.dueDate.slice(0, 4)}`}
              . No dia a dia conta {v.installments > 1 ? "só a 1ª parcela" : "o valor"} hoje; as
              demais entram como comprometido nos próximos meses.
            </p>
          )}
        </div>
      )}
      {v.type === "expense" && v.paymentMethod === "credit_card" && options.cards.length === 0 && (
        <p className="text-xs text-muted">
          Dica: cadastre seus cartões em{" "}
          <Link href="/cartoes" className="underline">
            Cartões
          </Link>{" "}
          para controlar faturas e parcelas.
        </p>
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
          {options.accounts.length > 0 && !onCard && (
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
          {variant === "full" && !onCard && (
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

      {variant === "quick" && isFuture && !onCard && (
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
