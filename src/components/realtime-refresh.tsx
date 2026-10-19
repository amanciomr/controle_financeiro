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
    const channel = supabase
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
      .subscribe();

    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (Date.now() - hiddenAt > 15_000) refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [householdId, router]);

  return null;
}
