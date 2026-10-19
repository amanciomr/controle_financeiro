import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/data/context";
import { monthOf } from "@/lib/domain/dates";

export default async function CurrentMonthPage() {
  const ctx = await getAppContext();
  redirect(`/mes/${monthOf(ctx.today)}`);
}
