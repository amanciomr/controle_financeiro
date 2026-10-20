import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardForm } from "@/components/card-form";
import { PageHeader } from "@/components/ui";
import { cardsOf } from "@/lib/data/cards";
import { getAppContext } from "@/lib/data/context";

export const metadata: Metadata = { title: "Editar cartão" };

export default async function EditCardPage(props: PageProps<"/cartoes/[id]/editar">) {
  const { id } = await props.params;
  const ctx = await getAppContext();
  const card = cardsOf(ctx.accounts).find((c) => c.id === id);
  if (!card) notFound();
  return (
    <div>
      <PageHeader title="Editar cartão" back={`/cartoes/${id}`} />
      <p className="mb-4 text-xs text-muted">
        Mudar o fechamento ou o vencimento recalcula a fatura de todas as compras deste cartão.
      </p>
      <CardForm
        today={ctx.today}
        members={ctx.members.map((m) => ({ userId: m.user_id, name: m.display_name }))}
        accounts={ctx.accounts
          .filter((a) => a.kind !== "credit_card" && !a.archived)
          .map((a) => ({ id: a.id, name: a.name }))}
        initial={{
          id: card.id,
          name: card.name,
          ownerUserId: card.ownerUserId,
          closingDay: card.cycle.closingDay,
          dueDay: card.cycle.dueDay,
          creditLimit: card.limit,
          paymentAccountId: card.paymentAccountId,
          archived: card.archived,
        }}
      />
    </div>
  );
}
