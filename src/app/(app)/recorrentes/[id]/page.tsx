import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecurrenceForm } from "@/components/recurrence-form";
import { PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/data/context";
import { getFormOptions } from "@/lib/data/form-options";

export const metadata: Metadata = { title: "Editar recorrência" };

export default async function EditRecurrencePage(props: PageProps<"/recorrentes/[id]">) {
  const { id } = await props.params;
  const ctx = await getAppContext();
  const [options, { data: r }] = await Promise.all([
    getFormOptions(),
    ctx.supabase.from("recurrences").select("*").eq("id", id).maybeSingle(),
  ]);
  if (!r) notFound();
  return (
    <div>
      <PageHeader title="Editar recorrência" back="/recorrentes" />
      <RecurrenceForm
        options={options}
        initial={{
          id: r.id,
          type: r.type,
          description: r.description,
          amount: r.amount,
          isEstimate: r.is_estimate,
          categoryId: r.category_id,
          paymentMethod: r.payment_method,
          accountId: r.account_id,
          personUserId: r.person_user_id,
          frequency: r.frequency,
          dayOfMonth: r.day_of_month ?? 1,
          monthOfYear: r.month_of_year ?? 1,
          weekday: r.weekday ?? 1,
          startDate: r.start_date,
          endDate: r.end_date ?? "",
          totalInstallments: r.total_installments,
          active: r.active,
          notes: r.notes ?? "",
        }}
      />
    </div>
  );
}
