import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage(props: PageProps<"/entrar">) {
  const { next, erro } = await props.searchParams;
  const target = safeNext(typeof next === "string" ? next : null);
  const { data } = await (await createClient()).auth.getClaims();
  if (data?.claims) redirect(target);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <div className="mb-3 text-5xl">🏡</div>
        <h1 className="text-2xl font-bold">Finanças Amâncio</h1>
        <p className="mt-1 text-sm text-muted">Quanto dá para gastar hoje, sem planilha.</p>
      </div>
      {erro && (
        <p className="mb-4 rounded-xl border border-neg/40 p-3 text-sm text-neg">
          O link expirou ou já foi usado. Peça um novo código.
        </p>
      )}
      <LoginForm next={target} />
    </main>
  );
}
