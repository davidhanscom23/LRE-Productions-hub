import { redirect } from "next/navigation";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import { WarehouseClient } from "@/components/av-erp/warehouse-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { loadWarehouseBoard } from "@/lib/av-erp/warehouse-data";
import { createClient } from "@/lib/supabase/server";
import { canAccessVidentAv } from "@/lib/vident-av-access";

export const metadata = { title: "Warehouse — LRE AV" };

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function AvWarehousePage({ searchParams }: Props) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessVidentAv(profile)) redirect("/rentals");

  const { tab: tabRaw } = await searchParams;
  const tab =
    tabRaw === "out" || tabRaw === "overdue" || tabRaw === "checkout"
      ? tabRaw
      : "all";

  const supabase = await createClient();
  let board;
  let loadError: string | null = null;
  try {
    board = await loadWarehouseBoard(supabase);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown error";
  }

  if (loadError || !board) {
    return (
      <AvErpPage maxWidthClassName="max-w-5xl">
        <div className="max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Warehouse needs a database update</p>
          <p className="mt-2">
            Run migration <code>142_av_gear_movements.sql</code> in Supabase, then
            refresh. ({loadError ?? "Could not load warehouse"})
          </p>
        </div>
      </AvErpPage>
    );
  }

  return (
    <WarehouseClient
      stillOut={board.stillOut}
      checkoutReady={board.checkoutReady}
      overdueCount={board.overdueCount}
      stillOutCount={board.stillOutCount}
      initialTab={tab}
    />
  );
}
