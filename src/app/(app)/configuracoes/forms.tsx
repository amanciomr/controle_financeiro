"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import {
  createInvite,
  deleteAccount,
  deleteInvite,
  saveAccount,
  updateHousehold,
  updateMyName,
} from "@/app/actions/settings";
import { MoneyInput } from "@/components/money-input";
import { cx } from "@/components/ui";
import { ACCOUNT_KINDS } from "@/lib/labels";

function useAction() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success = "Salvo ✓") =>
    start(async () => {
      const res = await fn();
      setMessage(res.ok ? { ok: true, text: success } : { ok: false, text: res.error ?? "Erro" });
    });
  const feedback = message && (
    <p className={cx("text-sm", message.ok ? "text-pos" : "text-neg")} role="status">
      {message.text}
    </p>
  );
  return { pending, run, feedback };
}

// ------------------------------------------------------------------ casa

export function HouseholdForm(props: {
  name: string;
  savingsGoalMode: "amount" | "percent";
  savingsGoalValue: number;
}) {
  const [name, setName] = useState(props.name);
  const [mode, setMode] = useState(props.savingsGoalMode);
  const [amount, setAmount] = useState(
    props.savingsGoalMode === "amount" ? props.savingsGoalValue : 0,
  );
  // percentual com até 2 casas, guardado em pontos-base (1000 = 10%)
  const [percent, setPercent] = useState(
    props.savingsGoalMode === "percent"
      ? String(props.savingsGoalValue / 100).replace(".", ",")
      : "10",
  );
  const { pending, run, feedback } = useAction();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const bp = Math.round(Number(percent.replace(",", ".")) * 100);
        run(() =>
          updateHousehold({
            name,
            savingsGoalMode: mode,
            savingsGoalValue: mode === "amount" ? amount : Number.isFinite(bp) ? bp : -1,
          }),
        );
      }}
    >
      <div>
        <label className="label" htmlFor="h-name">
          Nome da casa
        </label>
        <input
          id="h-name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <div className="label">Meta de poupança mensal</div>
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-card-2 p-1">
          {(
            [
              ["percent", "% da receita"],
              ["amount", "Valor fixo"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cx(
                "rounded-lg py-2 text-sm font-semibold",
                mode === value ? "bg-card text-fg shadow-sm" : "text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "amount" ? (
          <MoneyInput value={amount} onChange={setAmount} aria-label="Valor da meta" />
        ) : (
          <div className="flex items-center gap-2">
            <input
              className="field w-28 text-right"
              inputMode="decimal"
              value={percent}
              onChange={(e) => setPercent(e.target.value.replace(/[^\d,]/g, ""))}
              aria-label="Percentual da meta"
            />
            <span className="text-muted">% da receita prevista do mês</span>
          </div>
        )}
      </div>
      {feedback}
      <button className="btn-primary w-full" disabled={pending}>
        Salvar
      </button>
    </form>
  );
}

// ------------------------------------------------------------------ você

export function MyNameForm({ displayName }: { displayName: string }) {
  const [name, setName] = useState(displayName);
  const { pending, run, feedback } = useAction();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateMyName(name));
      }}
    >
      <label className="label" htmlFor="me-name">
        Seu nome no app
      </label>
      <div className="flex gap-2">
        <input
          id="me-name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn-ghost" disabled={pending}>
          Salvar
        </button>
      </div>
      {feedback}
    </form>
  );
}

const THEMES = [
  ["sistema", "Automático"],
  ["claro", "Claro"],
  ["escuro", "Escuro"],
] as const;

const noSubscribe = () => () => {};

function readTheme() {
  try {
    return localStorage.getItem("tema") ?? "sistema";
  } catch {
    return "sistema";
  }
}

export function ThemeSwitch() {
  const stored = useSyncExternalStore(noSubscribe, readTheme, () => "sistema");
  const [chosen, setTheme] = useState<string | null>(null);
  const theme = chosen ?? stored;
  function choose(t: string) {
    setTheme(t);
    try {
      if (t === "sistema") localStorage.removeItem("tema");
      else localStorage.setItem("tema", t);
    } catch {}
    const dark =
      t === "escuro" || (t === "sistema" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }
  return (
    <div>
      <div className="label">Aparência</div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-card-2 p-1">
        {THEMES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            onClick={() => choose(value)}
            className={cx(
              "rounded-lg py-2 text-sm font-semibold",
              theme === value ? "bg-card text-fg shadow-sm" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ convites

function ShareInvite({ token, householdName }: { token: string; householdName: string }) {
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(
    noSubscribe,
    () => location.origin,
    () => "",
  );
  const url = `${origin}/convite/${token}`;
  const text = `Entre na nossa casa "${householdName}" no Finanças Amâncio: ${url}`;
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="btn-ghost flex-1 py-2"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copiado ✓" : "Copiar link"}
      </button>
      <a
        className="btn-primary flex-1 py-2"
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noreferrer"
      >
        WhatsApp
      </a>
    </div>
  );
}

export function InviteForm({ householdName }: { householdName: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (token) {
    return (
      <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-3">
        <p className="text-sm">
          Convite criado para <strong>{email}</strong>. Mande o link; ao entrar com esse e-mail, a
          pessoa cai direto na casa.
        </p>
        <ShareInvite token={token} householdName={householdName} />
        <button
          type="button"
          className="text-sm text-muted underline"
          onClick={() => {
            setToken(null);
            setEmail("");
            setName("");
          }}
        >
          Fazer outro convite
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await createInvite({ email, displayName: name });
          if (!res.ok) return setError(res.error);
          setToken(res.data.token);
        });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <input
          className="field col-span-2"
          type="email"
          placeholder="e-mail (ex.: ana@gmail.com)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="field"
          placeholder="Nome (Ana)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn-primary" disabled={pending}>
          Convidar
        </button>
      </div>
      {error && <p className="text-sm text-neg">{error}</p>}
    </form>
  );
}

export function PendingInvite(props: {
  id: string;
  email: string;
  token: string;
  householdName: string;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 py-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate">✉️ {props.email}</span>
        <button
          type="button"
          className="text-xs text-neg underline"
          disabled={pending}
          onClick={() => start(async () => void (await deleteInvite(props.id)))}
        >
          cancelar
        </button>
      </div>
      <ShareInvite token={props.token} householdName={props.householdName} />
    </div>
  );
}

// ------------------------------------------------------------------ contas

export interface AccountValues {
  id?: string;
  name: string;
  kind: "checking" | "savings" | "cash";
  ownerUserId: string | null;
  openingBalance: number;
  openingDate: string;
  archived: boolean;
}

export function AccountForm({
  initial,
  members,
  onDone,
}: {
  initial: AccountValues;
  members: { userId: string; name: string }[];
  onDone?: () => void;
}) {
  const [v, setV] = useState(initial);
  const [negative, setNegative] = useState(initial.openingBalance < 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof AccountValues>(k: K, value: AccountValues[K]) =>
    setV((p) => ({ ...p, [k]: value }));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await saveAccount({
            ...v,
            openingBalance: negative ? -Math.abs(v.openingBalance) : Math.abs(v.openingBalance),
          });
          if (!res.ok) return setError(res.error);
          onDone?.();
        });
      }}
    >
      <input
        className="field"
        placeholder="Nome (ex.: Nubank Rafael)"
        value={v.name}
        onChange={(e) => set("name", e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          className="field"
          value={v.kind}
          onChange={(e) => set("kind", e.target.value as AccountValues["kind"])}
          aria-label="Tipo"
        >
          {ACCOUNT_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={v.ownerUserId ?? ""}
          onChange={(e) => set("ownerUserId", e.target.value || null)}
          aria-label="Titular"
        >
          <option value="">Conjunta</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className="label">Saldo em</div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            className="field"
            value={v.openingDate}
            onChange={(e) => e.target.value && set("openingDate", e.target.value)}
            aria-label="Data do saldo"
          />
          <MoneyInput
            value={Math.abs(v.openingBalance)}
            onChange={(c) => set("openingBalance", c)}
            aria-label="Saldo"
          />
        </div>
        <label className="mt-1 flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={negative}
            onChange={(e) => setNegative(e.target.checked)}
          />
          saldo negativo (cheque especial)
        </label>
        <p className="mt-1 text-xs text-muted">
          Saldo real no início do dia escolhido. Lançamentos a partir dessa data movimentam o saldo
          projetado.
        </p>
      </div>
      {error && <p className="text-sm text-neg">{error}</p>}
      <div className="flex gap-2">
        {v.id && (
          <button
            type="button"
            className="btn-danger"
            disabled={pending}
            onClick={() =>
              confirm("Excluir esta conta? Os lançamentos continuam, só sem conta.") &&
              start(async () => {
                const res = await deleteAccount(v.id!);
                if (!res.ok) return setError(res.error);
                onDone?.();
              })
            }
          >
            Excluir
          </button>
        )}
        <button className="btn-primary flex-1" disabled={pending}>
          {v.id ? "Salvar conta" : "Adicionar conta"}
        </button>
      </div>
    </form>
  );
}

export function AccountItem({
  account,
  members,
  summary,
}: {
  account: AccountValues;
  members: { userId: string; name: string }[];
  summary: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-3">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="flex-1">{summary}</span>
        <span className="text-muted">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="mt-3">
          <AccountForm initial={account} members={members} onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

export function NewAccount({
  members,
  today,
}: {
  members: { userId: string; name: string }[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  if (!open) {
    return (
      <button type="button" className="btn-ghost w-full" onClick={() => setOpen(true)}>
        + Adicionar conta
      </button>
    );
  }
  return (
    <AccountForm
      key={key}
      members={members}
      initial={{
        name: "",
        kind: "checking",
        ownerUserId: null,
        openingBalance: 0,
        openingDate: today,
        archived: false,
      }}
      onDone={() => {
        setOpen(false);
        setKey((k) => k + 1);
      }}
    />
  );
}
