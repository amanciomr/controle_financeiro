"use client";

import { useCallback, useRef, useState } from "react";
import { Sheet } from "./sheet";
import { emptyValues, type FormOptions, TransactionForm } from "./transaction-form";

/** Botão flutuante "+" presente em todas as telas: lançamento em segundos. */
export function QuickAdd({ options }: { options: FormOptions }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  // Muda ao fechar, para o formulário já estar limpo (e montado) na próxima abertura.
  const [formKey, setFormKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const resetForm = useCallback(() => setFormKey((k) => k + 1), []);

  function open() {
    dialogRef.current?.showModal();
    // Foco no valor na mesma interação do toque (o iOS só abre o teclado assim).
    amountRef.current?.focus();
    requestAnimationFrame(() => amountRef.current?.focus());
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl font-light text-accent-fg shadow-lg shadow-black/20 active:scale-95"
        aria-label="Novo lançamento"
      >
        +
      </button>

      <Sheet
        dialogRef={dialogRef}
        title="Novo lançamento"
        onClose={resetForm}
      >
        <TransactionForm
          key={formKey}
          options={options}
          initial={emptyValues(options)}
          variant="quick"
          amountRef={amountRef}
          onSaved={() => {
            dialogRef.current?.close();
            setToast("Lançado ✓");
            setTimeout(() => setToast(null), 2000);
          }}
        />
      </Sheet>

      {toast && (
        <div
          role="status"
          className="fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-50 mx-auto w-fit rounded-full bg-fg px-4 py-2 text-sm font-medium text-bg shadow-lg"
        >
          {toast}
        </div>
      )}
    </>
  );
}
