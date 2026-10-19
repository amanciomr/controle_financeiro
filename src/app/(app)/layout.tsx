import { BottomNav } from "@/components/bottom-nav";
import { QuickAdd } from "@/components/quick-add";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { getAppContext } from "@/lib/data/context";
import { getFormOptions } from "@/lib/data/form-options";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [ctx, options] = await Promise.all([getAppContext(), getFormOptions()]);
  return (
    <>
      <main className="mx-auto max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-32">
        {children}
      </main>
      <QuickAdd options={options} />
      <BottomNav />
      <RealtimeRefresh householdId={ctx.household.id} />
    </>
  );
}
