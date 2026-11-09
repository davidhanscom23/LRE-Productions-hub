import type { CalendarEvent } from "@/lib/calendar/events";

/** Merge Hub assignment names into a calendar event’s assignedStaff field. */
export function applyHubAssignments(
  event: CalendarEvent,
  profileIds: string[],
  nameById: Map<string, string>,
): CalendarEvent {
  const names = profileIds
    .map((id) => nameById.get(id)?.trim())
    .filter((n): n is string => Boolean(n));

  const parts = new Set<string>();
  if (event.assignedStaff) {
    for (const chunk of event.assignedStaff.split(/[,;]/)) {
      const t = chunk.trim();
      if (t) parts.add(t);
    }
  }
  for (const name of names) parts.add(name);

  return {
    ...event,
    assignedStaff: parts.size ? Array.from(parts).join(", ") : null,
    assignedProfileIds: profileIds,
  };
}

export function applyHubAssignmentsToEvents(
  events: CalendarEvent[],
  assignmentsByUid: Map<string, string[]>,
  nameById: Map<string, string>,
): CalendarEvent[] {
  return events.map((event) => {
    const ids = assignmentsByUid.get(event.uid) ?? [];
    if (!ids.length && !event.assignedStaff) {
      return { ...event, assignedProfileIds: [] };
    }
    return applyHubAssignments(event, ids, nameById);
  });
}

export type BoardAssigneeRow = { project_id: string; profile_id: string };

/**
 * Union HoneyBook board assignees (lead + support) into the per-event-uid
 * assignment map, for events backed by a CRM card. Calendar-only assignments
 * stay as they are; nothing is removed.
 */
export function mergeBoardAssignees(
  events: CalendarEvent[],
  boardRows: BoardAssigneeRow[],
  byUid: Map<string, string[]>,
): Map<string, string[]> {
  const byProject = new Map<string, string[]>();
  for (const row of boardRows) {
    const list = byProject.get(row.project_id) ?? [];
    list.push(row.profile_id);
    byProject.set(row.project_id, list);
  }
  const out = new Map<string, string[]>();
  for (const [uid, ids] of byUid) out.set(uid, [...ids]);
  for (const event of events) {
    if (!event.crmProjectId) continue;
    const board = byProject.get(event.crmProjectId);
    if (!board?.length) continue;
    const merged = new Set([...(out.get(event.uid) ?? []), ...board]);
    out.set(event.uid, Array.from(merged));
  }
  return out;
}
