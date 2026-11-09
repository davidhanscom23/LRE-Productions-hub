/** Filter crew bookings to those overlapping a calendar date (YYYY-MM-DD). */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDateKey(raw: string | null | undefined): boolean {
  return Boolean(raw && ISO_DATE.test(raw.trim()));
}

/**
 * True when [startsAt, endsAt] overlaps the local calendar day `dateKey`
 * (interpreted as that date in America/New_York for display filtering).
 * Uses date portions of the ISO timestamps so overnight bookings still match
 * both days they touch.
 */
export function bookingOverlapsDateKey(
  startsAt: string,
  endsAt: string,
  dateKey: string,
): boolean {
  if (!isIsoDateKey(dateKey)) return true;
  const startDay = startsAt.slice(0, 10);
  const endDay = endsAt.slice(0, 10);
  if (!ISO_DATE.test(startDay) || !ISO_DATE.test(endDay)) return true;
  return startDay <= dateKey && endDay >= dateKey;
}
