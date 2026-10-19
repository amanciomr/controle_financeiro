"use client";

import { useRouter } from "next/navigation";
import {
  type FormOptions,
  TransactionForm,
  type TransactionValues,
} from "@/components/transaction-form";

export function EditTransaction({
  options,
  initial,
}: {
  options: FormOptions;
  initial: TransactionValues;
}) {
  const router = useRouter();
  const back = () => (history.length > 1 ? router.back() : router.push("/lancamentos"));
  return (
    <TransactionForm
      options={options}
      initial={initial}
      variant="full"
      onSaved={back}
      onDeleted={back}
    />
  );
}
