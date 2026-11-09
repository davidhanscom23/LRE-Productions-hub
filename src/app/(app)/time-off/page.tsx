import { TimeOffClient } from "@/components/time-off/time-off-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { TeamTimeOff, TimeOffRequest } from "@/lib/types/time-off";
import { redirect } from "next/navigation";

export default async function TimeOffPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  const { data: myRows, error: myErr } = await supabase
    .from("time_off_requests")
    .select("*")
    .eq("user_id", profile.id)
    .order("start_date", { ascending: false });

  if (myErr) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Time Off needs a database update</p>
        <p className="mt-2">
          Run migration <code>051_time_off_availability.sql</code> in Supabase,
          then refresh. ({myErr.message})
        </p>
      </div>
    );
  }


  const { data: teamRows } = await supabase.rpc("list_team_time_off", {});

  const { data: availRow } = await supabase
    .from("staff_availability")
    .select("available_days, note")
    .eq("user_id", profile.id)
    .maybeSingle();
  const myAvailableDays = Array.isArray(availRow?.available_days)
    ? (availRow!.available_days as string[])
    : [];
  const myAvailabilityNote = String(availRow?.note ?? "");

  let adminRequests: TimeOffRequest[] = [];
  if (isAdmin) {
    const { data: allRows } = await supabase
      .from("time_off_requests")
      .select("*")
      .in("status", ["pending", "approved", "denied"])
      .order("created_at", { ascending: false });

    const ids = Array.from(
      new Set((allRows ?? []).map((r) => r.user_id as string)),
    );
    const { data: people } = ids.length
      ? await supabase.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as { id: string; full_name: string }[] };
    const nameById = new Map(
      (people ?? []).map((p) => [p.id as string, p.full_name as string]),
    );
    adminRequests = (allRows ?? []).map((r) => ({
      ...(r as TimeOffRequest),
      requester_name: nameById.get(r.user_id as string) ?? "Unknown",
    }));
  }

  return (
    <TimeOffClient
      isAdmin={isAdmin}
      myRequests={(myRows ?? []) as TimeOffRequest[]}
      teamTimeOff={(teamRows ?? []) as TeamTimeOff[]}
      adminRequests={adminRequests}
      myAvailableDays={myAvailableDays}
      myAvailabilityNote={myAvailabilityNote}
    />
  );
}
