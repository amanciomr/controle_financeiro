import type { Metadata } from "next";
import { Card, Money, PageHeader, SectionTitle } from "@/components/ui";
import { getAppContext } from "@/lib/data/context";
import { formatDateBR } from "@/lib/domain/dates";
import { ACCOUNT_KINDS } from "@/lib/labels";
import {
  AccountItem,
  HouseholdForm,
  InviteForm,
  MyNameForm,
  NewAccount,
  PendingInvite,
  ThemeSwitch,
} from "./forms";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const ctx = await getAppContext();
  const { data: invites } = await ctx.supabase
    .from("household_invites")
    .select("id, email, token, expires_at")
    .eq("household_id", ctx.household.id)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at");
  const members = ctx.members.map((m) => ({ userId: m.user_id, name: m.display_name }));
  const accounts = ctx.accounts.filter((a) => a.kind !== "credit_card");

  return (
    <div className="space-y-4">
      <PageHeader title="Configurações" back="/mais" />

      <Card>
        <SectionTitle>Casa</SectionTitle>
        <HouseholdForm
          name={ctx.household.name}
          savingsGoalMode={ctx.household.savings_goal_mode}
          savingsGoalValue={ctx.household.savings_goal_value}
        />
      </Card>

      <Card className="space-y-4">
        <SectionTitle>Você</SectionTitle>
        <MyNameForm displayName={ctx.me.display_name} />
        <ThemeSwitch />
      </Card>

      <Card>
        <SectionTitle>Membros</SectionTitle>
        <ul className="mb-4 divide-y divide-line">
          {ctx.members.map((m) => (
            <li key={m.user_id} className="flex justify-between py-2 text-sm">
              <span>
                {m.display_name}
                {m.user_id === ctx.userId && <span className="text-muted"> (você)</span>}
              </span>
              <span className="text-muted">{m.role === "owner" ? "criou a casa" : "membro"}</span>
            </li>
          ))}
        </ul>
        {(invites?.length ?? 0) > 0 && (
          <div className="mb-4">
            <div className="label">Convites pendentes</div>
            <div className="divide-y divide-line">
              {invites!.map((i) => (
                <PendingInvite
                  key={i.id}
                  id={i.id}
                  email={i.email}
                  token={i.token}
                  householdName={ctx.household.name}
                />
              ))}
            </div>
          </div>
        )}
        <div className="label">Convidar alguém</div>
        <InviteForm householdName={ctx.household.name} />
      </Card>

      <Card>
        <SectionTitle>Contas</SectionTitle>
        <p className="mb-2 text-xs text-muted">
          O saldo das contas alimenta o “saldo projetado” da tabela do mês. Cartões de crédito
          chegam na Fase 2.
        </p>
        <div className="mb-3 divide-y divide-line">
          {accounts.map((a) => (
            <AccountItem
              key={a.id}
              members={members}
              account={{
                id: a.id,
                name: a.name,
                kind: a.kind === "credit_card" ? "checking" : a.kind,
                ownerUserId: a.owner_user_id,
                openingBalance: a.opening_balance,
                openingDate: a.opening_date,
                archived: a.archived,
              }}
              summary={
                <span className="block">
                  <span className="block font-medium">{a.name}</span>
                  <span className="block text-xs text-muted">
                    {ACCOUNT_KINDS.find((k) => k.value === a.kind)?.label} ·{" "}
                    {members.find((m) => m.userId === a.owner_user_id)?.name ?? "conjunta"} · saldo{" "}
                    <Money cents={a.opening_balance} /> em {formatDateBR(a.opening_date)}
                  </span>
                </span>
              }
            />
          ))}
        </div>
        <NewAccount members={members} today={ctx.today} />
      </Card>
    </div>
  );
}
