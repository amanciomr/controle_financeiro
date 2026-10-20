import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getAppContext, memberName } from "@/lib/data/context";
import { getFormOptions } from "@/lib/data/form-options";
import { EditTransaction } from "./edit-transaction";

export const metadata: Metadata = { title: "Editar lançamento" };

const when = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Bahia",
  dateStyle: "short",
  timeStyle: "short",
});

export default async function EditTransactionPage(props: PageProps<"/lancamentos/[id]">) {
  const { id } = await props.params;
  const ctx = await getAppContext();
  const [options, { data: tx }] = await Promise.all([
    getFormOptions(),
    ctx.supabase.from("transactions").select("*").eq("id", id).maybeSingle(),
  ]);
  if (!tx) notFound();

  // Parcela de compra no cartão: edita a compra inteira.
  const { data: purchase } = tx.purchase_id
    ? await ctx.supabase.from("card_purchases").select("*").eq("id", tx.purchase_id).maybeSingle()
    : { data: null };
  const audit = purchase ?? tx;
  const created = `Criado por ${memberName(ctx, audit.created_by)} em ${when.format(new Date(audit.created_at))}`;
  const edited =
    audit.updated_at !== audit.created_at
      ? `editado por ${memberName(ctx, audit.updated_by)} em ${when.format(new Date(audit.updated_at))}`
      : null;
  const lastCard = options.cards.find((c) => c.id === ctx.me.last_account_id)?.id;

  return (
    <div>
      <PageHeader
        title={purchase ? "Editar compra no cartão" : "Editar lançamento"}
        back="/lancamentos"
      />
      {purchase && purchase.installments > 1 && (
        <p className="mb-4 rounded-xl border border-line bg-card p-3 text-sm text-muted">
          💳 Parcela {tx.installment_number} de {purchase.installments}. Aqui você edita a compra
          inteira (valor total, parcelas, data); as parcelas são refeitas.
        </p>
      )}
      {tx.recurrence_id && (
        <p className="mb-4 rounded-xl border border-line bg-card p-3 text-sm text-muted">
          🔁 Gerado por uma recorrência. Alterar aqui muda só este mês.
        </p>
      )}
      <EditTransaction
        options={options}
        initial={
          purchase
            ? {
                id: tx.id,
                purchaseId: purchase.id,
                type: "expense",
                amount: purchase.total_amount,
                description: purchase.description,
                categoryId: purchase.category_id,
                paymentMethod: "credit_card",
                accountId: null,
                personUserId: purchase.person_user_id,
                date: purchase.purchase_date,
                notes: purchase.notes ?? "",
                cardId: purchase.account_id,
                installments: purchase.installments,
              }
            : {
                id: tx.id,
                type: tx.type,
                amount: tx.amount,
                description: tx.description,
                categoryId: tx.category_id,
                paymentMethod: tx.payment_method,
                accountId: tx.account_id,
                personUserId: tx.person_user_id,
                date: tx.date,
                status: tx.status === "skipped" ? "planned" : tx.status,
                notes: tx.notes ?? "",
                cardId: lastCard ?? options.cards[0]?.id ?? null,
                installments: 1,
              }
        }
      />
      <p className="mt-6 text-xs text-muted">
        {created}
        {edited && `; ${edited}`}.
      </p>
    </div>
  );
}
