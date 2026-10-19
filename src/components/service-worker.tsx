"use client";

import { useEffect } from "react";

/** Registra o service worker (só em produção, para não atrapalhar o dev). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
