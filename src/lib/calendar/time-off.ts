import type { CalendarEvent } from "@/lib/calendar/events";
import type { TeamTimeOff } from "@/lib/types/time-off";
import { timeOffTypeLabel } from "@/lib/types/time-off";

/**
 * Turn approved team time-off rows (from list_team_time_off) into all-day
 * CalendarEvents so they render alongside work events. Noon-UTC keeps the
 * America/New_York day key stable (never rolls to an adjacent date). The end
 * is included so multi-day ranges span every day in the grid.
 */
export function teamTimeOffToEvents(rows: TeamTimeOff[]): CalendarEvent[] {
  return (rows ?? []).map((r) => ({
    uid: `timeoff-${r.id}`,
    source: "timeoff" as const,
    title: `${r.full_name} — ${timeOffTypeLabel(r.type)}`,
    start: `${r.start_date}T12:00:00Z`,
    end: `${r.end_date}T12:00:00Z`,
    allDay: true,
    status: "Time off",
    eventType: null,
    assignedStaff: null,
    venue: null,
    clientName: null,
    organization: null,
    clientContact: null,
    clientPhone: null,
    clientEmail: null,
    relatedFiles: [],
    planningFormUrl: null,
    eventUrl: null,
    descriptionStartTime: null,
    descriptionEndTime: null,
  }));
}
