import "server-only";

import { applyHubAssignmentsToEvents } from "@/lib/calendar/assignments";
import type { CalendarEvent } from "@/lib/calendar/events";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Load Hub calendar_event_assignments keyed by event uid. */
export async function loadHubAssignmentsByUid(
  supabase: SupabaseClient,
): Promise<{
  byUid: Map<string, string[]>;
  nameById: Map<string, string>;
}> {
  const empty = {
    byUid: new Map<string, string[]>(),
    nameById: new Map<string, string>(),
  };

  const { data: rows, error } = await supabase
    .from("calendar_event_assignments")
    .select("event_uid, profile_id");
  if (error || !rows?.length) return empty;

  const byUid = new Map<string, string[]>();
  const profileIds = new Set<string>();
  for (const row of rows) {
    const uid = String(row.event_uid ?? "");
    const pid = String(row.profile_id ?? "");
    if (!uid || !pid) continue;
    profileIds.add(pid);
    const list = byUid.get(uid) ?? [];
    list.push(pid);
    byUid.set(uid, list);
  }

  const { data: people } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", Array.from(profileIds));

  const nameById = new Map(
    (people ?? []).map((p) => [
      String(p.id),
      String(p.full_name ?? "").trim(),
    ]),
  );

  return { byUid, nameById };
}

/** Merge Hub assignee profile ids/names onto calendar events before packet sync. */
export async function withHubAssignments(
  supabase: SupabaseClient,
  events: CalendarEvent[],
): Promise<CalendarEvent[]> {
  const { byUid, nameById } = await loadHubAssignmentsByUid(supabase);
  return applyHubAssignmentsToEvents(events, byUid, nameById);
}
