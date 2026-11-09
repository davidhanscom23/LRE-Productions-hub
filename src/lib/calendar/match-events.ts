import type { CalendarEvent } from "@/lib/calendar/events";
import { eventDayKey, formatEventDate } from "@/lib/calendar/format";

/** Client-side filter for Calendar event lists. */
export function eventMatchesQuery(
  event: CalendarEvent,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    event.title,
    event.clientName,
    event.venue,
    event.assignedStaff,
    event.eventType,
    event.status,
    event.organization,
    event.clientContact,
    event.clientPhone,
    event.clientEmail,
    event.planningFormUrl,
    event.eventUrl,
    ...(event.relatedFiles ?? []).flatMap((f) => [f.title, f.url]),
    eventDayKey(event.start),
    formatEventDate(event.start),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase()
    .includes(q);
}
