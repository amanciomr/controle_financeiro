"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cx } from "./ui";

/**
 * Filtro rápido por pessoa (Todos / cada membro / Casa). Fica num cookie,
 * então vale para todas as telas até ser trocado.
 */
export function PersonFilter({
  value,
  members,
}: {
  value: string;
  members: { userId: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const options = [
    { value: "", label: "Todos" },
    ...members.map((m) => ({ value: m.userId, label: m.name })),
    { value: "casa", label: "Casa" },
  ];
  return (
    <div
      className={cx("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1", pending && "opacity-60")}
      role="group"
      aria-label="Filtrar por pessoa"
    >
      {options.map((o) => (
        <button
          key={o.value || "todos"}
          type="button"
          aria-pressed={value === o.value}
          className="chip py-1 text-xs"
          onClick={() => {
            document.cookie = `pessoa=${o.value}; path=/; max-age=31536000; samesite=lax`;
            start(() => router.refresh());
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
