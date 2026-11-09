import { type CalendarEvent } from "@/lib/calendar/events";

function eventDateFromCalendar(event: CalendarEvent): string {
  return event.start.slice(0, 10);
}

function isCancelled(event: CalendarEvent): boolean {
  const status = event.status?.toLowerCase() ?? "";
  return status.includes("cancel");
}

/**
 * Events eligible for automatic packets: from lookbackDays ago through today
 * (inclusive). Day-of and recent past become "needs completion" work items.
 */
/** Default auto-sync lookback (cron / throttled open). Manual admin sync may pass longer. */
export const DEFAULT_PACKET_LOOKBACK_DAYS = 21;
/** Manual "Sync from calendar" lookback — covers the same window as Client Reviews. */
export const MANUAL_PACKET_LOOKBACK_DAYS = 730;

export function isPacketEligible(
  event: CalendarEvent,
  today = new Date(),
  lookbackDays = DEFAULT_PACKET_LOOKBACK_DAYS,
): boolean {
  if (isCancelled(event)) return false;
  const dateStr = eventDateFromCalendar(event);
  const eventDay = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(eventDay.getTime())) return false;

  const start = new Date(today);
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - lookbackDays);

  const end = new Date(today);
  end.setHours(12, 0, 0, 0);

  return eventDay >= start && eventDay <= end;
}

/**
 * Staff can manually launch a packet for any non-cancelled event on or before
 * today (no short lookback window).
 */
export function isManualPacketEligible(
  event: CalendarEvent,
  today = new Date(),
): boolean {
  if (isCancelled(event)) return false;
  const dateStr = eventDateFromCalendar(event);
  const eventDay = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(eventDay.getTime())) return false;

  const end = new Date(today);
  end.setHours(12, 0, 0, 0);
  return eventDay <= end;
}
