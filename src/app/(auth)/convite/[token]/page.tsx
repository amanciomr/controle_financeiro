import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data/context";
import { AcceptInviteForm } from "../../bem-vindo/forms";

export const metadata: Metadata = { title: "Convite" };

/** Link de convite enviado pelo WhatsApp: /convite/<token>. */
export default async function InvitePage(props: PageProps<"/convite/[token]">) {
  const { token } = await props.params;
  const { supabase, email } = await getUser();
  const { data: invites } = await supabase.rpc("my_pending_invites");
  const invite = invites?.find((i) => i.token === token);

  if (!invite) {
    const { count } = await supabase
      .from("household_members")
      .select("household_id", { count: "exact", head: true });
    if (count) redirect("/");
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10 text-center">
        <div className="mb-3 text-5xl">✉️</div>
        <h1 className="mb-2 text-xl font-bold">Convite não encontrado</h1>
        <p className="mb-6 text-sm text-muted">
          Você entrou como <strong>{email}</strong>. O convite pode ter sido feito para outro
          e-mail, ter expirado ou já ter sido usado.
        </p>
        <Link href="/bem-vindo" className="btn-ghost">
          Continuar
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center text-5xl">🏡</div>
      <AcceptInviteForm
        token={invite.token}
        householdName={invite.household_name}
        invitedBy={invite.invited_by_name}
        suggestedName={invite.display_name ?? ""}
      />
    </main>
  );
}
