"use client";

import { forwardRef } from "react";
import { digitsToCents, formatBRL } from "@/lib/domain/money";
import { cx } from "./ui";

/**
 * Campo de valor estilo "caixa eletrônico": os dígitos entram pela direita
 * (digitar 1, 2, 3, 4 → R$ 12,34). Sempre em centavos, sem float.
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  {
    value: number;
    onChange: (cents: number) => void;
    id?: string;
    className?: string;
    autoFocus?: boolean;
    "aria-label"?: string;
  }
>(function MoneyInput({ value, onChange, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      {...rest}
      className={cx("field tabular-nums", className)}
      inputMode="numeric"
      autoComplete="off"
      value={formatBRL(value)}
      onChange={(e) => onChange(digitsToCents(e.target.value))}
      onFocus={(e) => {
        const el = e.currentTarget;
        // Cursor sempre no fim: os dígitos entram pela direita.
        requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
      }}
    />
  );
});
