/** Check-in schedule for AV event portals: 30 / 14 / 7 / 3 days before the show. */

export const CHECKIN_OFFSETS = [30, 14, 7, 3] as const;
export type CheckinKind = "d30" | "d14" | "d7" | "d3";

const MS_PER_DAY = 86_400_000;

/** Today's calendar date (YYYY-MM-DD) in the LRE home time zone. */
export function todayInEastern(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whole days from `today` to `eventDate` (both YYYY-MM-DD). */
export function daysUntil(eventDate: string, today: string): number {
  const a = Date.parse(`${eventDate}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.round((a - b) / MS_PER_DAY);
}

/**
 * Which scheduled check-in (if any) is due today.
 * - Sends on the exact day (30, 14, 7, 3 days out).
 * - If a show is booked inside a window, it gets one catch-up check-in for the
 *   window it is in, so a late booking is not left waiting.
 * - Never repeats a check-in already sent; nothing on show day or after.
 */
export function pickCheckinKind(days: number, sent: ReadonlySet<string>): CheckinKind | null {
  if (days < 1) return null;
  const bucket = CHECKIN_OFFSETS.filter((o) => o >= days).sort((a, b) => a - b)[0];
  if (!bucket) return null;
  const kind = `d${bucket}` as CheckinKind;
  if (sent.has(kind)) return null;
  if (days === bucket) return kind;
  const anySent = CHECKIN_OFFSETS.some((o) => sent.has(`d${o}`));
  return anySent ? null : kind;
}
