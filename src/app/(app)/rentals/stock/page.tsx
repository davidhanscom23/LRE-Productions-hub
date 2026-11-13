import { redirect } from "next/navigation";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import { StockClient } from "@/components/av-erp/stock-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { loadStockRows } from "@/lib/av-erp/warehouse-data";
import { createClient } from "@/lib/supabase/server";
import { canAccessAv } from "@/lib/av-access";

export const metadata = { title: "Stock — LRE AV" };

export default async function AvStockPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessAv(profile)) redirect("/rentals");

  const supabase = await createClient();
  let rows;
  let loadError: string | null = null;
  try {
    rows = await loadStockRows(supabase);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown error";
  }

  if (loadError || !rows) {
    return (
      <AvErpPage maxWidthClassName="max-w-5xl">
        <div className="max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Stock needs a database update</p>
          <p className="mt-2">
            Run migration <code>142_av_gear_movements.sql</code> in Supabase, then
            refresh. ({loadError ?? "Could not load stock"})
          </p>
        </div>
      </AvErpPage>
    );
  }

  return <StockClient rows={rows} />;
}
