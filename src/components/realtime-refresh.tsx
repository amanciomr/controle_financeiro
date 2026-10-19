"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Mantém a tela em dia com o que o outro membro lança: escuta mudanças em
 * `transactions` da casa (Supabase Realtime, que respeita a RLS) e também
 * recarrega os dados quando o app volta ao primeiro plano.
 */
export function RealtimeRefresh({ householdId }: { householdId: string }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    const supabase = getBrowserClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    // O socket precisa do token do usuário antes de assinar: sem ele entra
    // como anônimo e a RLS (corretamente) não deixa ver nada.
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel(`casa-${householdId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transactions",
            filter: `household_id=eq.${householdId}`,
          },
          refresh,
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("Realtime indisponível; atualização só ao voltar para o app.", err);
          } else if (process.env.NODE_ENV !== "production") {
            console.debug("realtime:", status);
          }
        });
    });

    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (Date.now() - hiddenAt > 15_000) refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [householdId, router]);

  return null;
}
