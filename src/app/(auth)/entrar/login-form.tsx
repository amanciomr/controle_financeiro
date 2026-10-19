"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getBrowserClient().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (error) {
      setError(
        error.status === 429
          ? "Muitas tentativas. Aguarde um minuto e tente de novo."
          : "Não foi possível enviar o e-mail. Confira o endereço.",
      );
      return;
    }
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getBrowserClient().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setBusy(false);
      setError("Código inválido ou expirado.");
      return;
    }
    // Recarga completa para o servidor enxergar os cookies da sessão.
    window.location.assign(next);
  }

  if (step === "code") {
    return (
      <form onSubmit={verify} className="space-y-4">
        <p className="text-sm text-muted">
          Enviamos um e-mail para <strong className="text-fg">{email}</strong> com um link e um
          código. Toque no link ou digite o código aqui (é o melhor caminho no app instalado).
        </p>
        <div>
          <label className="label" htmlFor="code">
            Código
          </label>
          <input
            id="code"
            className="field text-center text-2xl tracking-[0.5em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
            required
          />
        </div>
        {error && <p className="text-sm text-neg">{error}</p>}
        <button className="btn-primary w-full" disabled={busy || code.length < 6}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
        <button
          type="button"
          className="w-full text-sm text-muted underline"
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
          }}
        >
          Usar outro e-mail
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">
          Seu e-mail
        </label>
        <input
          id="email"
          className="field"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="voce@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
      </div>
      {error && <p className="text-sm text-neg">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "Enviando…" : "Receber código por e-mail"}
      </button>
      <p className="text-center text-xs text-muted">
        Sem senha: você recebe um código a cada login.
      </p>
    </form>
  );
}
