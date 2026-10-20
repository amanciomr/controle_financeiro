import "server-only";
import { cookies } from "next/headers";
import type { AppContext } from "./context";

/** "" = todos; "casa" = só compartilhados; ou o user_id de um membro. */
export type PersonFilter = string;

export const PERSON_COOKIE = "pessoa";

export function matchesPerson(personUserId: string | null, filter: PersonFilter): boolean {
  if (!filter) return true;
  if (filter === "casa") return personUserId === null;
  return personUserId === filter;
}

/** Filtro por pessoa escolhido (cookie), validado contra os membros da casa. */
export async function getPersonFilter(ctx: Pick<AppContext, "members">): Promise<PersonFilter> {
  const value = (await cookies()).get(PERSON_COOKIE)?.value ?? "";
  if (value === "casa" || ctx.members.some((m) => m.user_id === value)) return value;
  return "";
}

export function personLabel(ctx: Pick<AppContext, "members">, filter: PersonFilter): string | null {
  if (!filter) return null;
  if (filter === "casa") return "Casa (compartilhados)";
  return ctx.members.find((m) => m.user_id === filter)?.display_name ?? null;
}
