/**
 * Inquiry Forms - date availability rules. PURE (dates are "YYYY-MM-DD" wall-calendar strings in
 * America/New_York; never parsed with new Date("YYYY-MM-DD")).
 *
 * The server owns the verdict. Results never reveal counts or names. Anything that cannot be
 * decided is "unknown" (we confirm by hand), never a false "available".
 */
import { addDays, isPastDate, isValidDateString } from "../dates";
import type { BusinessSettings, DateResult } from "../types";

type Availability = BusinessSettings["availability"];

/** Alternatives are searched up to this many days before and after the requested date. */
export const ALTERNATIVE_RADIUS_DAYS = 21;
export const MAX_ALTERNATIVES = 3;
/**
 * Hub bookings are mirrored from the DJ Event Planner calendar feed, which reaches about 550
 * days ahead. Past this horizon an empty calendar proves nothing, so the answer is "unknown".
 */
export const BOOKINGS_HORIZON_DAYS = 540;

export function inBlackout(date: string, blackouts: Availability["blackouts"] | null | undefined): boolean {
  if (!Array.isArray(blackouts)) return false;
  return blackouts.some((b) => {
    if (!b || !isValidDateString(b.start) || !isValidDateString(b.end)) return false;
    const from = b.start <= b.end ? b.start : b.end;
    const to = b.start <= b.end ? b.end : b.start;
    return date >= from && date <= to;
  });
}

/** First date a visitor may book given the minimum notice (today when none). */
export function earliestBookableDate(today: string, minNoticeDays: number | null | undefined): string {
  const days =
    typeof minNoticeDays === "number" && Number.isFinite(minNoticeDays) && minNoticeDays > 0
      ? Math.floor(minNoticeDays)
      : 0;
  return days > 0 ? addDays(today, days) : today;
}

/**
 * Every rule that does not need the bookings count. Returns the final result, or null when the
 * date must be compared with bookings and capacity ("bookings" mode, inside the horizon).
 */
export function screenDate(input: {
  mode: Availability["mode"];
  date: string | null | undefined;
  today: string;
  blackouts: Availability["blackouts"] | null | undefined;
  minNoticeDays: number | null | undefined;
  horizonDays?: number;
}): DateResult | null {
  if (input.mode === "off") return "skipped";
  if (!input.date) return "skipped";
  if (!isValidDateString(input.date)) return "unknown";
  if (isPastDate(input.date, input.today)) return "too_soon";
  if (input.date < earliestBookableDate(input.today, input.minNoticeDays)) return "too_soon";
  if (inBlackout(input.date, input.blackouts)) return "blackout";
  if (input.mode === "open") return "open";
  if (input.mode !== "bookings") return "unknown";
  const horizon = input.horizonDays ?? BOOKINGS_HORIZON_DAYS;
  if (input.date > addDays(input.today, horizon)) return "unknown";
  return null;
}

/**
 * Bookings vs capacity: unavailable when booked >= capacity; limited when booked >= capacity - 1
 * and capacity >= 2; available otherwise; unknown when capacity cannot be computed.
 */
export function resultFromBookings(booked: number, capacity: number | null): DateResult {
  if (capacity === null || !Number.isFinite(capacity) || capacity < 0) return "unknown";
  if (!Number.isFinite(booked) || booked < 0) return "unknown";
  if (booked >= capacity) return "unavailable";
  if (capacity >= 2 && booked >= capacity - 1) return "limited";
  return "available";
}

/** Results that offer nearby dates (when the form's onDateUnavailable includes "alternatives"). */
export function wantsAlternatives(result: DateResult): boolean {
  return result === "unavailable" || result === "blackout" || result === "too_soon";
}

/** Only a clean yes counts as an alternative. */
export function isGoodAlternative(result: DateResult): boolean {
  return result === "available" || result === "open";
}

/** Candidate dates, nearest first (the later date first at equal distance). */
export function alternativeCandidates(date: string, radiusDays: number = ALTERNATIVE_RADIUS_DAYS): string[] {
  const out: string[] = [];
  for (let k = 1; k <= radiusDays; k += 1) {
    out.push(addDays(date, k));
    out.push(addDays(date, -k));
  }
  return out;
}

export function dateMessage(result: DateResult, messages: Availability["messages"]): string {
  switch (result) {
    case "available":
      return messages.available;
    case "open":
      return messages.open;
    case "limited":
      return messages.limited;
    case "unavailable":
      return messages.unavailable;
    case "blackout":
      return messages.blackout;
    case "too_soon":
      return messages.tooSoon;
    case "unknown":
      return messages.unknown;
    case "skipped":
      return "";
  }
}
