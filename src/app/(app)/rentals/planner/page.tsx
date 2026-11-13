import { redirect } from "next/navigation";
import { GearPlannerClient } from "@/components/av-erp/gear-planner-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { loadGearJobs } from "@/lib/av-erp/ops-data";
import { ymdInZone } from "@/lib/av-erp/ops-schedule";
import { createClient } from "@/lib/supabase/server";
import { canAccessAv } from "@/lib/av-access";

export const metadata = { title: "Planner — LRE AV" };

export default async function AvGearPlannerPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessAv(profile)) redirect("/rentals");

  const supabase = await createClient();
  let jobs;
  let loadError: string | null = null;
  try {
    jobs = await loadGearJobs(supabase);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown error";
  }

  if (loadError || !jobs) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Planner needs Hub estimates data</p>
        <p className="mt-2">{loadError ?? "Could not load jobs"}</p>
      </div>
    );
  }

  const todayYmd = ymdInZone(new Date().toISOString(), "America/New_York");
  return <GearPlannerClient jobs={jobs} todayYmd={todayYmd} />;
}
