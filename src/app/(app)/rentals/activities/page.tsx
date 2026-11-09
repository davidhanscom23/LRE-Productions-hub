import { redirect } from "next/navigation";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import { ActivitiesClient } from "@/components/av-erp/activities-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { activityCounts, loadActivities } from "@/lib/av-erp/ops-data";
import { createClient } from "@/lib/supabase/server";
import { canAccessVidentAv } from "@/lib/vident-av-access";

export const metadata = { title: "Activities — Vident AV" };

type Props = {
  searchParams: Promise<{ settled?: string; filter?: string }>;
};

export default async function AvActivitiesPage({ searchParams }: Props) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessVidentAv(profile)) redirect("/rentals");

  const { settled, filter: filterRaw } = await searchParams;
  const includeSettled = settled === "1";
  const initialFilter =
    filterRaw === "due_today" || filterRaw === "overdue" ? filterRaw : "all";

  const supabase = await createClient();
  let activities;
  let loadError: string | null = null;
  try {
    activities = await loadActivities(supabase, { includeSettled });
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown error";
  }

  if (loadError || !activities) {
    return (
      <AvErpPage maxWidthClassName="max-w-3xl">
        <div className="max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Activities needs a database update</p>
          <p className="mt-2">
            Run migration <code>143_av_activities.sql</code> in Supabase, then
            refresh. ({loadError ?? "Could not load activities"})
          </p>
        </div>
      </AvErpPage>
    );
  }

  const { data: opps } = await supabase
    .from("av_opportunities")
    .select("id, reference, subject")
    .in("status", ["draft", "quotation", "order"])
    .order("reference")
    .limit(200);

  const counts = activityCounts(activities);

  return (
    <ActivitiesClient
      activities={activities}
      opportunities={(opps ?? []).map((o) => ({
        id: o.id as string,
        reference: o.reference as string,
        subject: (o.subject as string) || "Untitled",
      }))}
      includeSettled={includeSettled}
      dueToday={counts.dueToday}
      overdue={counts.overdue}
      initialFilter={initialFilter}
    />
  );
}
