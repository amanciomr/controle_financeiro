"use client";

import { useState, useTransition } from "react";
import { acceptInvite, createHousehold } from "@/app/actions/settings";

export function CreateHouseholdForm() {
  const [name, setName] = useState("Casa Amâncio");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createHousehold({ name, displayName });
          if (res && !res.ok) setError(res.error);
        });
      }}
    >
      <p className="text-sm text-muted">
        Crie a casa e depois convide quem vai dividir as finanças com você em Configurações.
      </p>
      <div>
        <label className="label" htmlFor="display">
          Seu nome
        </label>
        <input
          id="display"
          className="field"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Rafael"
          autoFocus
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="house">
          Nome da casa
        </label>
        <input
          id="house"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-neg">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Criando…" : "Criar casa"}
      </button>
    </form>
  );
}

export function AcceptInviteForm(props: {
  token: string;
  householdName: string;
  invitedBy: string | null;
  suggestedName: string;
}) {
  const [displayName, setDisplayName] = useState(props.suggestedName);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4 rounded-2xl border border-line bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await acceptInvite({ token: props.token, displayName });
          if (res && !res.ok) setError(res.error);
        });
      }}
    >
      <p>
        {props.invitedBy ? <strong>{props.invitedBy}</strong> : "Alguém"} convidou você para{" "}
        <strong>{props.householdName}</strong>.
      </p>
      <div>
        <label className="label" htmlFor={`name-${props.token}`}>
          Seu nome
        </label>
        <input
          id={`name-${props.token}`}
          className="field"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-neg">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar na casa"}
      </button>
    </form>
  );
}
