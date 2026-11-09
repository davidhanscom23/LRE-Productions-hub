import type { CalendarEvent } from "@/lib/calendar/events";

export type { CalendarEvent };

export const COMPANY_TIME_ZONE = "America/New_York";

function nyParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COMPANY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

/** YYYY-MM-DD in America/New_York for DTSTART placement. */
export function eventDayKey(iso: string): string {
  const { year, month, day } = nyParts(new Date(iso));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** YYYY-MM-DD from a calendar-grid Date (local y/m/d components). */
export function gridDayKey(day: Date): string {
  const year = day.getFullYear();
  const month = day.getMonth() + 1;
  const date = day.getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return gridDayKey(a) === gridDayKey(b);
}

export function eventsOnDay(
  events: CalendarEvent[],
  day: Date,
): CalendarEvent[] {
  const key = gridDayKey(day);
  return events.filter((event) => {
    // Time off spans a date range — show it on every day from start to end.
    if (event.source === "timeoff" && event.end) {
      return key >= eventDayKey(event.start) && key <= eventDayKey(event.end);
    }
    return eventDayKey(event.start) === key;
  });
}

export function upcomingEvents(
  events: CalendarEvent[],
  from = new Date(),
  limit = 40,
): CalendarEvent[] {
  const todayKey = eventDayKey(from.toISOString());
  return events
    .filter((event) => eventDayKey(event.start) >= todayKey)
    .slice(0, limit);
}

/** Events from today through the next `days` calendar days (inclusive), America/New_York. */
export function eventsInNextDays(
  events: CalendarEvent[],
  days = 7,
  from = new Date(),
): CalendarEvent[] {
  const todayKey = eventDayKey(from.toISOString());
  const { year, month, day } = nyParts(from);
  const end = new Date(Date.UTC(year, month - 1, day + (days - 1)));
  const endKey = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`;

  return events.filter((event) => {
    const key = eventDayKey(event.start);
    return key >= todayKey && key <= endKey;
  });
}

export function formatDayHeading(day: Date): string {
  return day.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Date label from DTSTART in America/New_York. */
export function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: COMPANY_TIME_ZONE,
  });
}

/** Long date for the detail popup (America/New_York). */
export function formatEventDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: COMPANY_TIME_ZONE,
  });
}

/**
 * Time range for list tiles from DTSTART/DTEND in America/New_York.
 * Prefer DESCRIPTION wall times when both are present for the popup helper.
 */
export function formatDtTimeRange(
  startIso: string,
  endIso: string | null,
  allDay: boolean,
): string {
  if (allDay) return "All day";

  const start = new Date(startIso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: COMPANY_TIME_ZONE,
  });

  if (!endIso) return start;

  const end = new Date(endIso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: COMPANY_TIME_ZONE,
  });

  return `${start} – ${end}`;
}

/** Popup times: DESCRIPTION Event Start/End Time, with DT fallback. */
export function formatDescriptionTimeRange(event: CalendarEvent): string {
  if (event.descriptionStartTime && event.descriptionEndTime) {
    return `${event.descriptionStartTime} – ${event.descriptionEndTime}`;
  }
  if (event.descriptionStartTime) return event.descriptionStartTime;
  return formatDtTimeRange(event.start, event.end, event.allDay);
}

/** Google Maps search URL for a venue / address string. */
export function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`;
}

/** Plain-text summary for clipboard from an event detail popup. */
export function formatEventDetailsCopy(event: CalendarEvent): string {
  const lines: string[] = [event.title];
  lines.push(`Date: ${formatEventDateLong(event.start)}`);
  if (event.eventType) lines.push(`Event Type: ${event.eventType}`);
  if (event.assignedStaff) lines.push(`Assigned Staff: ${event.assignedStaff}`);
  lines.push(`Time: ${formatDescriptionTimeRange(event)}`);
  if (event.status) lines.push(`Status: ${event.status}`);
  if (event.venue) lines.push(`Venue: ${event.venue}`);
  if (event.clientName) lines.push(`Client Name: ${event.clientName}`);
  if (event.organization) lines.push(`Organization: ${event.organization}`);
  if (event.clientContact) lines.push(`Client Contact: ${event.clientContact}`);
  if (event.clientPhone) lines.push(`Client Phone: ${event.clientPhone}`);
  if (event.clientEmail) lines.push(`Client Email: ${event.clientEmail}`);
  if (event.planningFormUrl) {
    lines.push(`Planning Form: ${event.planningFormUrl}`);
  }
  if (event.relatedFiles?.length) {
    for (const file of event.relatedFiles) {
      lines.push(`Related File: ${file.title} — ${file.url}`);
    }
  }
  if (event.eventUrl) lines.push(`Event link: ${event.eventUrl}`);
  return lines.join("\n");
}

export type CalendarView = "day" | "week" | "month" | "year";

export function startOfLocalDay(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate());
}

export function addDays(day: Date, delta: number): Date {
  const next = startOfLocalDay(day);
  next.setDate(next.getDate() + delta);
  return next;
}

/** Sunday-start week containing `day`. */
export function startOfWeek(day: Date): Date {
  const start = startOfLocalDay(day);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function monthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function weekLabel(anchor: Date): string {
  const start = startOfWeek(anchor);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    return `${start.toLocaleDateString(undefined, { month: "long" })} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
  }

  const startText = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" as const }),
  });
  const endText = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startText} – ${endText}`;
}

export function yearLabel(year: number): string {
  return String(year);
}

/** Build a 6x7 grid of dates for a month view (Sun–Sat). */
export function monthGrid(year: number, monthIndex: number): Date[] {
  const first = new Date(year, monthIndex, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    cells.push(day);
  }
  return cells;
}

/** Seven days for the week containing `anchor` (Sun–Sat). */
export function weekGrid(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Parse `YYYY-MM-DD` from an `<input type="date">` into a local Date. */
export function parseDateInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function toDateInputValue(day: Date): string {
  return gridDayKey(day);
}

/** Soft status badge colors by common calendar statuses. */
export function statusBadgeClass(status: string | null): string {
  if (!status) return "";
  const normalized = status.toLowerCase();

  if (
    normalized.includes("paid") ||
    normalized.includes("confirmed") ||
    normalized.includes("complete")
  ) {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (
    normalized.includes("cancel") ||
    normalized.includes("declined") ||
    normalized.includes("lost")
  ) {
    return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
  }
  if (
    normalized.includes("deposit") ||
    normalized.includes("pending") ||
    normalized.includes("hold") ||
    normalized.includes("proposal")
  ) {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
  }

  return "bg-[var(--brand-soft)] text-[var(--brand)]";
}
