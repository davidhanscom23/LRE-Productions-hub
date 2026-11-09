import { redirect } from "next/navigation";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import { ReportsClient } from "@/components/av-erp/reports-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { loadAvReports } from "@/lib/av-erp/reports";
import { createClient } from "@/lib/supabase/server";
import { canAccessVidentAv } from "@/lib/vident-av-access";

export const metadata = { title: "Reports — Vident AV" };

export default async function AvReportsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessVidentAv(profile)) redirect("/rentals");

  const supabase = await createClient();
  let data;
  let loadError: string | null = null;
  try {
    data = await loadAvReports(supabase);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown error";
  }

  if (loadError || !data) {
    return (
      <AvErpPage maxWidthClassName="max-w-4xl">
        <div className="max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Reports could not load</p>
          <p className="mt-2">
            Confirm AV migrations through 145 are applied. If Costs/Crew are
            also empty, paste and run{" "}
            <code>supabase/migrations/145_av_job_costs_crew.sql</code> in
            Supabase → SQL Editor, then refresh. (
            {loadError ?? "Unknown error"})
          </p>
        </div>
      </AvErpPage>
    );
  }

  return <ReportsClient data={data} />;
}
