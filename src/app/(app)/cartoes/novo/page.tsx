import type { Metadata } from "next";
import { CardForm } from "@/components/card-form";
import { PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/data/context";

export const metadata: Metadata = { title: "Novo cartão" };

export default async function NewCardPage() {
  const ctx = await getAppContext();
  return (
    <div>
      <PageHeader title="Novo cartão" back="/cartoes" />
      <CardForm
        today={ctx.today}
        members={ctx.members.map((m) => ({ userId: m.user_id, name: m.display_name }))}
        accounts={ctx.accounts
          .filter((a) => a.kind !== "credit_card" && !a.archived)
          .map((a) => ({ id: a.id, name: a.name }))}
        initial={{
          name: "",
          ownerUserId: ctx.userId,
          closingDay: 1,
          dueDay: 10,
          creditLimit: null,
          paymentAccountId: ctx.accounts.find((a) => a.kind === "checking")?.id ?? null,
        }}
      />
    </div>
  );
}
