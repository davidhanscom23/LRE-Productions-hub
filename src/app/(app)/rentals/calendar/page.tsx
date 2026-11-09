import { redirect } from "next/navigation";
import { GearCalendarClient } from "@/components/av-erp/gear-calendar-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { loadGearJobs } from "@/lib/av-erp/ops-data";
import { ymdInZone } from "@/lib/av-erp/ops-schedule";
import { createClient } from "@/lib/supabase/server";
import { canAccessVidentAv } from "@/lib/vident-av-access";

export const metadata = { title: "Gear calendar — Vident AV" };

export default async function AvGearCalendarPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessVidentAv(profile)) redirect("/rentals");

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
        <p className="font-semibold">Gear calendar needs Hub estimates data</p>
        <p className="mt-2">{loadError ?? "Could not load jobs"}</p>
      </div>
    );
  }

  const today = ymdInZone(new Date().toISOString(), "America/New_York");
  const [y, m] = today.split("-").map(Number);

  return (
    <GearCalendarClient jobs={jobs} initialYear={y} initialMonth={m - 1} />
  );
}
