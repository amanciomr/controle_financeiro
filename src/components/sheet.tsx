"use client";

import { type ReactNode, type RefObject, useEffect } from "react";

/**
 * Painel que sobe da parte de baixo da tela (bottom sheet), usando o
 * <dialog> nativo: foco preso dentro, Esc fecha, fundo escurecido.
 */
export function Sheet({
  dialogRef,
  title,
  children,
  onClose,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  title: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  useEffect(() => {
    const el = dialogRef.current;
    if (!el || !onClose) return;
    el.addEventListener("close", onClose);
    return () => el.removeEventListener("close", onClose);
  }, [dialogRef, onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-line bg-card p-0 text-fg backdrop:bg-black/50 sm:mx-auto sm:mb-auto sm:max-w-md sm:rounded-3xl"
      onClick={(e) => {
        // Toque no fundo escurecido fecha.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-card px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <button
          type="button"
          className="rounded-full px-2 text-2xl leading-none text-muted"
          aria-label="Fechar"
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
      </div>
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}
