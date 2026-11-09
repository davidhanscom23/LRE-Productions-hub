import type { CalendarEvent } from "@/lib/calendar/events";
import { matchAssignedStaffProfiles } from "@/lib/event-packets/match-staff";
import {
  formatDescriptionTimeRange,
  formatEventDate,
} from "@/lib/calendar/format";

export type AvClockInEventOption = {
  uid: string;
  /** Stored as time_entries.event_name */
  eventName: string;
  /** Select option label */
  label: string;
};

function looksLikeAvEvent(event: CalendarEvent): boolean {
  const hay = [
    event.eventType,
    event.title,
    event.organization,
    event.clientName,
  ]
    .filter(Boolean)
    .join(" ");
  return /\b(a\/?v|audio\s*visual|lighting|projection|pa\b|sound\s*system)\b/i.test(
    hay,
  );
}

function optionFromEvent(event: CalendarEvent): AvClockInEventOption {
  const when = formatEventDate(event.start);
  const time = formatDescriptionTimeRange(event);
  const place = event.venue?.trim();
  const parts = [when, time, place].filter(Boolean);
  const eventName =
    event.title?.trim() ||
    [event.clientName, event.eventType].filter(Boolean).join(" · ") ||
    "Calendar event";

  return {
    uid: event.uid,
    eventName,
    label: parts.length ? `${eventName} — ${parts.join(" · ")}` : eventName,
  };
}

/**
 * Rank upcoming calendar events for AV Time Tracker clock-in:
 * assigned to the current user first, then AV-looking types, then the rest.
 */
export function buildAvClockInOptions(options: {
  events: CalendarEvent[];
  profile: { id: string; full_name: string; email: string } | null;
  limit?: number;
}): AvClockInEventOption[] {
  const limit = options.limit ?? 40;
  const profile = options.profile;
  const assigned: CalendarEvent[] = [];
  const avish: CalendarEvent[] = [];
  const rest: CalendarEvent[] = [];

  for (const event of options.events) {
    const isMine =
      profile &&
      matchAssignedStaffProfiles(event.assignedStaff, [profile]).length > 0;
    if (isMine) {
      assigned.push(event);
    } else if (looksLikeAvEvent(event)) {
      avish.push(event);
    } else {
      rest.push(event);
    }
  }

  const ranked = [...assigned, ...avish, ...rest];
  const seen = new Set<string>();
  const out: AvClockInEventOption[] = [];

  for (const event of ranked) {
    if (seen.has(event.uid)) continue;
    seen.add(event.uid);
    out.push(optionFromEvent(event));
    if (out.length >= limit) break;
  }

  return out;
}
