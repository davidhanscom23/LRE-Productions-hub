/**
 * Booking-slot math. No date library: time zones go through Intl.
 * All "local" times are wall-clock times in the meeting type's time zone.
 */

export const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAYS)[number];
export type Window = [string, string]; // ["09:00", "17:00"]
export type Weekly = Partial<Record<DayKey, Window[]>>;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isDateStr = (s: string) => DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Offset (ms) of `tz` from UTC at the instant `utcMs`. */
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wall-clock `date` + `time` in `tz` -> UTC milliseconds. */
export function zonedToUtcMs(date: string, time: string, tz: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let utc = guess - tzOffsetMs(guess, tz);
  // Re-check once so times near a DST change land on the right side.
  utc = guess - tzOffsetMs(utc, tz);
  return utc;
}

/** YYYY-MM-DD of an instant as seen in `tz`. */
export function dateInTz(utcMs: number, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(utcMs));
}

export function dayKeyOf(date: string): DayKey {
  return DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Clean user-entered hours: keeps valid, ordered, non-overlapping windows. */
export function sanitizeWeekly(raw: unknown): Weekly {
  const out: Weekly = {};
  if (!raw || typeof raw !== "object") return out;
  for (const day of DAYS) {
    const list = (raw as Record<string, unknown>)[day];
    if (!Array.isArray(list)) continue;
    const wins: Window[] = [];
    for (const w of list.slice(0, 6)) {
      if (!Array.isArray(w) || w.length !== 2) continue;
      const [a, b] = w.map(String);
      if (TIME_RE.test(a) && TIME_RE.test(b) && a < b) wins.push([a, b]);
    }
    wins.sort((x, y) => x[0].localeCompare(y[0]));
    const merged: Window[] = [];
    for (const w of wins) {
      const last = merged[merged.length - 1];
      if (last && w[0] <= last[1]) last[1] = w[1] > last[1] ? w[1] : last[1];
      else merged.push([...w]);
    }
    if (merged.length) out[day] = merged;
  }
  return out;
}

/** "9:00-12:00, 13:00-17:00" -> windows. Returns null when something doesn't parse. */
export function parseWindowsText(text: string): Window[] | null {
  const t = text.trim();
  if (!t) return [];
  const out: Window[] = [];
  for (const part of t.split(",")) {
    const m = part.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const a = `${m[1].padStart(2, "0")}:${m[2]}`;
    const b = `${m[3].padStart(2, "0")}:${m[4]}`;
    if (!TIME_RE.test(a) || !TIME_RE.test(b) || a >= b) return null;
    out.push([a, b]);
  }
  return out;
}

export const windowsToText = (w: Window[] | undefined) => (w ?? []).map(([a, b]) => `${a}-${b}`).join(", ");

export type SlotInput = {
  date: string; // YYYY-MM-DD in `tz`
  weekly: Weekly;
  tz: string;
  durationMin: number;
  bufferMin: number;
  stepMin?: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  nowMs: number;
  /** Existing bookings (UTC ms) for the host. */
  busy: { startMs: number; endMs: number }[];
};

/** Open start times (UTC ISO strings) for one day. */
export function generateSlots(i: SlotInput): string[] {
  if (!isDateStr(i.date)) return [];
  const today = dateInTz(i.nowMs, i.tz);
  if (i.date < today || i.date > addDays(today, i.maxDaysAhead)) return [];
  const windows = i.weekly[dayKeyOf(i.date)] ?? [];
  const step = i.stepMin ?? 30;
  const earliest = i.nowMs + i.minNoticeHours * 3_600_000;
  const dur = i.durationMin * 60_000;
  const buf = i.bufferMin * 60_000;
  const out: string[] = [];
  for (const [from, to] of windows) {
    const start = zonedToUtcMs(i.date, from, i.tz);
    const end = zonedToUtcMs(i.date, to, i.tz);
    for (let t = start; t + dur <= end; t += step * 60_000) {
      if (t < earliest) continue;
      const clash = i.busy.some((b) => t < b.endMs + buf && t + dur + buf > b.startMs);
      if (!clash) out.push(new Date(t).toISOString());
    }
  }
  return out;
}
