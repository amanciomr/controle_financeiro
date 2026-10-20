"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { setStatementPaid } from "@/app/actions/cards";

export function StatementPaidButton(props: {
  cardId: string;
  dueMonth: string;
  paid: boolean;
  amount: number;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <button
      type="button"
      className={props.paid ? "btn-ghost w-full" : "btn-primary w-full"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setStatementPaid({
            cardId: props.cardId,
            dueMonth: props.dueMonth,
            paid: !props.paid,
            amount: props.amount,
          });
          // Continua mostrando esta fatura (sem ?fatura a tela pularia para a próxima a pagar).
          router.replace(`${pathname}?fatura=${props.dueMonth}`);
        })
      }
    >
      {props.paid ? "Desmarcar pagamento" : "✓ Marcar fatura como paga"}
    </button>
  );
}
