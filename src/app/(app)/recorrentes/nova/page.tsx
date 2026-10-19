import type { Metadata } from "next";
import { RecurrenceForm } from "@/components/recurrence-form";
import { PageHeader } from "@/components/ui";
import { getFormOptions } from "@/lib/data/form-options";
import { parseDate } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Nova recorrência" };

export default async function NewRecurrencePage() {
  const options = await getFormOptions();
  const { day, month } = parseDate(options.today);
  return (
    <div>
      <PageHeader title="Nova recorrência" back="/recorrentes" />
      <RecurrenceForm
        options={options}
        initial={{
          type: "expense",
          description: "",
          amount: 0,
          isEstimate: false,
          categoryId: "",
          paymentMethod: "boleto",
          accountId: options.accounts[0]?.id ?? null,
          personUserId: null,
          frequency: "monthly",
          dayOfMonth: day,
          monthOfYear: month,
          weekday: 1,
          startDate: `${options.today.slice(0, 7)}-01`,
          endDate: "",
          totalInstallments: null,
          active: true,
          notes: "",
        }}
      />
    </div>
  );
}
