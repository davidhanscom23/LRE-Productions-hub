import { redirect } from "next/navigation";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import { CostsBoardClient } from "@/components/av-erp/costs-board-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { loadCostsBoard } from "@/lib/av-erp/job-finance";
import { createClient } from "@/lib/supabase/server";
import { canAccessVidentAv } from "@/lib/vident-av-access";

export const metadata = { title: "Costs — Vident AV" };

export default async function AvCostsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessVidentAv(profile)) redirect("/rentals");

  const supabase = await createClient();
  let rows;
  let loadError: string | null = null;
  try {
    rows = await loadCostsBoard(supabase);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown error";
  }

  if (loadError || !rows) {
    return (
      <AvErpPage maxWidthClassName="max-w-4xl">
        <div className="max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Costs needs a database update</p>
          <p className="mt-2">
            In Supabase → SQL Editor, paste and run the full contents of{" "}
            <code>supabase/migrations/145_av_job_costs_crew.sql</code>, then
            refresh. ({loadError ?? "Could not load costs"})
          </p>
        </div>
      </AvErpPage>
    );
  }

  return <CostsBoardClient rows={rows} />;
}
