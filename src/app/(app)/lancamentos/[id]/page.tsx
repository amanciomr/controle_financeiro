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

  const created = `Criado por ${memberName(ctx, tx.created_by)} em ${when.format(new Date(tx.created_at))}`;
  const edited =
    tx.updated_at !== tx.created_at
      ? `editado por ${memberName(ctx, tx.updated_by)} em ${when.format(new Date(tx.updated_at))}`
      : null;

  return (
    <div>
      <PageHeader title="Editar lançamento" back="/lancamentos" />
      {tx.recurrence_id && (
        <p className="mb-4 rounded-xl border border-line bg-card p-3 text-sm text-muted">
          🔁 Gerado por uma recorrência. Alterar aqui muda só este mês.
        </p>
      )}
      <EditTransaction
        options={options}
        initial={{
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
        }}
      />
      <p className="mt-6 text-xs text-muted">
        {created}
        {edited && `; ${edited}`}.
      </p>
    </div>
  );
}
