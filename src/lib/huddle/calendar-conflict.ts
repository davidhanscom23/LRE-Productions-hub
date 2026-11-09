import type { CalendarEvent } from "@/lib/calendar/events";

/** Assumed length for a scheduled (not-yet-live) huddle when checking calendar overlap. */
export const SCHEDULED_HUDDLE_ASSUMED_MIN = 60;

export type HuddleCalendarConflict = {
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  source: CalendarEvent["source"];
};

export function huddleWindow(
  scheduledAtIso: string,
  durationMin: number = SCHEDULED_HUDDLE_ASSUMED_MIN,
): { start: Date; end: Date } {
  const start = new Date(scheduledAtIso);
  const end = new Date(start.getTime() + Math.max(1, durationMin) * 60_000);
  return { start, end };
}

function eventWindow(event: CalendarEvent): { start: Date; end: Date } | null {
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return null;
  if (event.end) {
    const end = new Date(event.end);
    if (!Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
      return { start, end };
    }
  }
  // Point events / missing end: treat as 30 minutes so they still collide.
  return { start, end: new Date(start.getTime() + 30 * 60_000) };
}

function rangesOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/**
 * Find calendar events that overlap a scheduled huddle window.
 * All-day CRM overlays are skipped by default (too many false positives).
 */
export function findHuddleCalendarConflicts(
  scheduledAtIso: string,
  events: CalendarEvent[],
  opts?: { durationMin?: number; includeAllDay?: boolean },
): HuddleCalendarConflict[] {
  const when = new Date(scheduledAtIso);
  if (Number.isNaN(when.getTime())) return [];

  const window = huddleWindow(scheduledAtIso, opts?.durationMin);
  const includeAllDay = opts?.includeAllDay === true;
  const out: HuddleCalendarConflict[] = [];

  for (const event of events) {
    if (event.allDay && !includeAllDay) continue;
    const ew = eventWindow(event);
    if (!ew) continue;
    if (!rangesOverlap(window, ew)) continue;
    out.push({
      title: event.title || "Untitled event",
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      source: event.source,
    });
  }

  out.sort((a, b) => a.start.localeCompare(b.start));
  return out;
}
