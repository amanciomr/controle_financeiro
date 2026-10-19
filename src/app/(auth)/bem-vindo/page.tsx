import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data/context";
import { AcceptInviteForm, CreateHouseholdForm } from "./forms";

export const metadata: Metadata = { title: "Bem-vindo" };

export default async function WelcomePage() {
  const { supabase, userId, email } = await getUser();

  const { count } = await supabase
    .from("household_members")
    .select("household_id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (count) redirect("/");

  const { data: invites } = await supabase.rpc("my_pending_invites");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <div className="mb-3 text-5xl">👋</div>
        <h1 className="text-2xl font-bold">Bem-vindo!</h1>
        <p className="mt-1 text-sm text-muted">{email}</p>
      </div>

      {invites && invites.length > 0 ? (
        <div className="space-y-4">
          {invites.map((inv) => (
            <AcceptInviteForm
              key={inv.token}
              token={inv.token}
              householdName={inv.household_name}
              invitedBy={inv.invited_by_name}
              suggestedName={inv.display_name ?? ""}
            />
          ))}
        </div>
      ) : (
        <CreateHouseholdForm />
      )}
    </main>
  );
}
