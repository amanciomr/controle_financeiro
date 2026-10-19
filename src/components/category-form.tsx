"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type CategoryInput, deleteCategory, saveCategory } from "@/app/actions/categories";
import { cx } from "./ui";

const ICONS = [
  "🏠",
  "🛒",
  "🍽️",
  "⛽",
  "🚗",
  "💊",
  "🎓",
  "🎉",
  "🛍️",
  "📺",
  "🏦",
  "🧾",
  "📦",
  "💼",
  "✨",
  "💰",
  "🐶",
  "👶",
  "✈️",
  "🎁",
  "💡",
  "💧",
  "📱",
  "🏋️",
  "💇",
  "🧹",
];

export interface CategoryOption {
  id: string;
  name: string;
  icon: string;
  kind: "income" | "expense";
  parentId: string | null;
}

export function CategoryForm({
  initial,
  parents,
}: {
  initial: CategoryInput & { kind: "income" | "expense"; nature: "fixed" | "variable" };
  parents: CategoryOption[];
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) =>
    setV((p) => ({ ...p, [k]: value }));
  const availableParents = parents.filter((p) => p.kind === v.kind && p.id !== v.id && !p.parentId);
  const isSub = Boolean(v.parentId);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await saveCategory(v);
          if (!res.ok) return setError(res.error);
          router.push("/categorias");
        });
      }}
    >
      {!v.id && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-card-2 p-1">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={v.kind === t}
              onClick={() => setV((p) => ({ ...p, kind: t, parentId: null }))}
              className={cx(
                "rounded-lg py-2 text-sm font-semibold",
                v.kind === t ? "bg-card text-fg shadow-sm" : "text-muted",
              )}
            >
              {t === "expense" ? "Despesa" : "Receita"}
            </button>
          ))}
        </div>
      )}
      <div>
        <label className="label" htmlFor="c-name">
          Nome
        </label>
        <input
          id="c-name"
          className="field"
          value={v.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={40}
          required
        />
      </div>
      <div>
        <div className="label">Ícone</div>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              aria-pressed={v.icon === icon}
              onClick={() => set("icon", icon)}
              className={cx(
                "h-10 w-10 rounded-xl border text-xl",
                v.icon === icon ? "border-accent bg-accent/15" : "border-line bg-card",
              )}
            >
              {icon}
            </button>
          ))}
          <input
            aria-label="Outro emoji"
            className="field h-10 w-16 px-2 text-center text-xl"
            value={ICONS.includes(v.icon) ? "" : v.icon}
            onChange={(e) => e.target.value && set("icon", e.target.value.slice(0, 8))}
            placeholder="…"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="label mb-0" htmlFor="c-color">
          Cor
        </label>
        <input
          id="c-color"
          type="color"
          className="h-10 w-16 rounded-lg border border-line bg-card"
          value={v.color}
          onChange={(e) => set("color", e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="c-parent">
          Subcategoria de
        </label>
        <select
          id="c-parent"
          className="field"
          value={v.parentId ?? ""}
          onChange={(e) => set("parentId", e.target.value || null)}
        >
          <option value="">— (categoria principal)</option>
          {availableParents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name}
            </option>
          ))}
        </select>
      </div>
      {v.kind === "expense" && !isSub && (
        <div>
          <div className="label">Tipo de gasto</div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["fixed", "Fixo", "Entra no comprometido (aluguel, escola…)"],
                ["variable", "Variável", "Conta na meta diária (mercado, lazer…)"],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                aria-pressed={v.nature === value}
                onClick={() => set("nature", value)}
                className={cx(
                  "rounded-xl border p-3 text-left",
                  v.nature === value ? "border-accent bg-accent/10" : "border-line bg-card",
                )}
              >
                <div className="font-semibold">{label}</div>
                <div className="text-xs text-muted">{hint}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {isSub && (
        <p className="text-xs text-muted">
          Subcategorias seguem o tipo (fixo/variável) da principal.
        </p>
      )}
      {error && <p className="text-sm text-neg">{error}</p>}
      <div className="flex gap-2">
        {v.id && (
          <button
            type="button"
            className="btn-danger"
            disabled={pending}
            onClick={() =>
              confirm("Excluir esta categoria? Se ela já tiver lançamentos, será só arquivada.") &&
              start(async () => {
                const res = await deleteCategory(v.id!);
                if (!res.ok) return setError(res.error);
                router.push("/categorias");
              })
            }
          >
            Excluir
          </button>
        )}
        {v.id && v.archived && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => set("archived", false)}
            disabled={pending}
          >
            Desarquivar
          </button>
        )}
        <button className="btn-primary flex-1" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
