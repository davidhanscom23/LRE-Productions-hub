import { TeamsPageClient } from "@/components/teams/teams-page-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCachedGenericIcalEvents } from "@/lib/calendar/events";
import { eventsInNextDays } from "@/lib/calendar/format";
import { getSharedWorkIcalUrl } from "@/lib/calendar/settings";
import { createClient } from "@/lib/supabase/server";
import { buildAvClockInOptions } from "@/lib/teams/av-clock-in-events";
import {
  avRollupSinceIso,
  buildAvTeamHours,
  type AvTeamShiftRow,
} from "@/lib/teams/av-time-rollup";
import {
  TEAM_DEPARTMENTS,
  type DepartmentLink,
  type DepartmentVideo,
  type TeamDepartment,
} from "@/lib/types/teams";
import type { TimeEntry } from "@/lib/types/time-tracker";

export default async function TeamsPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const canManage =
    profile?.role === "admin" || profile?.role === "trainer";

  const [linksRes, videosRes, openEntryRes, recentEntriesRes, teamEntriesRes] =
    await Promise.all([
      supabase
        .from("department_links")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("department_videos")
        .select("*")
        .order("created_at", { ascending: false }),
      profile
        ? supabase
            .from("time_entries")
            .select("*")
            .eq("user_id", profile.id)
            .is("clocked_out_at", null)
            .order("clocked_in_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      profile
        ? supabase
            .from("time_entries")
            .select("*")
            .eq("user_id", profile.id)
            .eq("department", "Audiovisual")
            .order("clocked_in_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [], error: null }),
      canManage
        ? supabase
            .from("time_entries")
            .select("*")
            .eq("department", "Audiovisual")
            .gte("clocked_in_at", avRollupSinceIso())
            .order("clocked_in_at", { ascending: false })
            .limit(80)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (linksRes.error || videosRes.error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
        Couldn’t load Teams content:{" "}
        {linksRes.error?.message || videosRes.error?.message}
      </div>
    );
  }

  const visibleDepartments: TeamDepartment[] = canManage
    ? [...TEAM_DEPARTMENTS]
    : TEAM_DEPARTMENTS.filter((dept) =>
        (profile?.departments ?? []).includes(dept),
      );

  // time_entries may not exist until migration 008 is applied — fail soft
  const openTimeEntry = openEntryRes.error
    ? null
    : ((openEntryRes.data as TimeEntry | null) ?? null);
  const recentTimeEntries = recentEntriesRes.error
    ? []
    : ((recentEntriesRes.data ?? []) as TimeEntry[]);

  let teamShifts: AvTeamShiftRow[] = [];
  let teamHours = buildAvTeamHours([]);

  if (canManage && !teamEntriesRes.error) {
    const entries = (teamEntriesRes.data ?? []) as TimeEntry[];
    const userIds = Array.from(new Set(entries.map((row) => row.user_id)));
    const nameById = new Map<string, string>();

    if (userIds.length) {
      const { data: people } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      for (const person of people ?? []) {
        const name =
          (person.full_name as string | null)?.trim() ||
          (person.email as string) ||
          "Staff";
        nameById.set(person.id as string, name);
      }
    }

    teamShifts = entries.map((entry) => ({
      id: entry.id,
      userId: entry.user_id,
      staffName: nameById.get(entry.user_id) ?? "Staff",
      eventName: entry.event_name,
      clockedInAt: entry.clocked_in_at,
      clockedOutAt: entry.clocked_out_at,
      source: entry.source,
    }));
    teamHours = buildAvTeamHours(teamShifts);
  }

  const icalUrl = await getSharedWorkIcalUrl();

  let calendarEvents: Awaited<
    ReturnType<typeof getCachedGenericIcalEvents>
  > = [];
  let calendarError: string | null = null;
  if (icalUrl) {
    try {
      const all = await getCachedGenericIcalEvents(icalUrl, "work");
      calendarEvents = eventsInNextDays(all, 14);
    } catch (error) {
      calendarError =
        error instanceof Error
          ? error.message
          : "Unknown error loading the calendar feed.";
    }
  }

  const clockInEvents = buildAvClockInOptions({
    events: calendarEvents,
    profile: profile
      ? {
          id: profile.id,
          full_name: profile.full_name ?? "",
          email: profile.email,
        }
      : null,
  });

  return (
    <TeamsPageClient
      links={(linksRes.data ?? []) as DepartmentLink[]}
      videos={(videosRes.data ?? []) as DepartmentVideo[]}
      canManage={Boolean(canManage)}
      visibleDepartments={visibleDepartments}
      openTimeEntry={openTimeEntry}
      recentTimeEntries={recentTimeEntries}
      clockInEvents={clockInEvents}
      hasCalendarFeed={Boolean(icalUrl)}
      isAdmin={Boolean(isAdmin)}
      calendarError={calendarError}
      teamHours={teamHours}
      teamShifts={teamShifts.slice(0, 12)}
    />
  );
}
