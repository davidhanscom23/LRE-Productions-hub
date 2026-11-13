/**
 * Inquiry Forms - wall-calendar dates, times and Eastern-time helpers.
 *
 * PURE module: no server-only imports, safe in client components, route handlers and vitest.
 *
 * Rules (spec non-negotiable 7):
 * - An event date is a wall-calendar "YYYY-MM-DD" string. Never parse one with
 *   `new Date("YYYY-MM-DD")`: that is UTC midnight, which is the PREVIOUS evening in US time zones.
 * - Day arithmetic runs on UTC calendar math (Date.UTC), so a DST change can never shift a day.
 * - "Today", the day of a timestamp and email timestamps use the business time zone
 *   (America/New_York), never the visitor's or the server's zone.
 */

export const BUSINESS_TZ = "America/New_York";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?$/;
const DAY_MS = 86400000;

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, month: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

/** Cached Intl formatters (constructing them is the slow part). */
const dayPartsFormatters = new Map<string, Intl.DateTimeFormat>();

function dayPartsFormatter(tz: string): Intl.DateTimeFormat {
  let f = dayPartsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    dayPartsFormatters.set(tz, f);
  }
  return f;
}

/** The wall date ("YYYY-MM-DD") of an instant in a time zone. Throws RangeError on an invalid Date. */
function wallDateIn(d: Date, tz: string): string {
  let y = "";
  let m = "";
  let day = "";
  for (const p of dayPartsFormatter(tz).formatToParts(d)) {
    if (p.type === "year") y = p.value;
    else if (p.type === "month") m = p.value;
    else if (p.type === "day") day = p.value;
  }
  return `${y.padStart(4, "0")}-${m}-${day}`;
}

/** UTC midnight (ms) of a valid wall date. Throws RangeError when the string is not a real date. */
function utcMsOf(date: string): number {
  if (!isValidDateString(date)) throw new RangeError(`Invalid date "${String(date)}" (expected YYYY-MM-DD)`);
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function wallDateFromUtcMs(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getUTCFullYear()).padStart(4, "0")}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Today's wall date in `tz` (default America/New_York), e.g. "2026-11-04". */
export function todayInTz(now: Date = new Date(), tz: string = BUSINESS_TZ): string {
  return wallDateIn(now, tz);
}

/** True for a real calendar date written exactly as "YYYY-MM-DD" (years 1000..9999, leap years honored). */
export function isValidDateString(s: string): boolean {
  if (typeof s !== "string") return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (y < 1000 || month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(y, month);
}

/** True when `date` is strictly before `today` (both "YYYY-MM-DD"). Today itself is not past. Invalid input: false. */
export function isPastDate(date: string, today: string): boolean {
  if (!isValidDateString(date) || !isValidDateString(today)) return false;
  return date < today;
}

/** `date` plus `days` calendar days (negative goes back). Throws RangeError on an invalid date. */
export function addDays(date: string, days: number): string {
  if (typeof days !== "number" || !Number.isFinite(days)) throw new RangeError(`Invalid day count "${String(days)}"`);
  return wallDateFromUtcMs(utcMsOf(date) + Math.trunc(days) * DAY_MS);
}

/** Whole days from `a` to `b` (b - a): positive when b is later. Throws RangeError on an invalid date. */
export function daysBetween(a: string, b: string): number {
  return Math.round((utcMsOf(b) - utcMsOf(a)) / DAY_MS);
}

const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** "2027-05-15" -> "Saturday, May 15, 2027". Returns the input unchanged when it is not a valid date. */
export function formatLongDate(date: string): string {
  if (!isValidDateString(date)) return typeof date === "string" ? date : "";
  let weekday = "";
  let month = "";
  let day = "";
  let year = "";
  for (const p of longDateFormatter.formatToParts(new Date(utcMsOf(date)))) {
    if (p.type === "weekday") weekday = p.value;
    else if (p.type === "month") month = p.value;
    else if (p.type === "day") day = p.value;
    else if (p.type === "year") year = p.value;
  }
  return `${weekday}, ${month} ${day}, ${year}`;
}

/** Postgres-style "2026-11-04 15:05:00+00" -> a string `new Date()` parses everywhere. */
function normalizeTimestamp(s: string): string {
  let t = s.trim();
  if (/^\d{4}-\d{2}-\d{2} \d/.test(t)) t = t.replace(" ", "T");
  if (/[+-]\d{2}$/.test(t)) t = `${t}:00`;
  return t;
}

function toInstant(input: string | Date): Date | null {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input !== "string" || !input.trim()) return null;
  const d = new Date(normalizeTimestamp(input));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The America/New_York wall date of a timestamp: "2026-11-05T03:30:00Z" -> "2026-11-04".
 * A bare "YYYY-MM-DD" is already a wall date and is returned as is (never shifted a day).
 * Returns "" for anything that is not a valid timestamp or date.
 */
export function easternDayKey(iso: string | Date): string {
  if (typeof iso === "string" && DATE_RE.test(iso.trim())) {
    const d = iso.trim();
    return isValidDateString(d) ? d : "";
  }
  const d = toInstant(iso);
  return d ? wallDateIn(d, BUSINESS_TZ) : "";
}

const easternStampFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TZ,
  month: "numeric",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/**
 * "2026-11-04T20:05:00Z" -> "Nov 4, 2026, 3:05 PM ET" (built from parts, so a browser's narrow
 * no-break space before AM/PM never leaks into emails). Returns the input when it is not a timestamp.
 */
export function formatEasternTimestamp(iso: string): string {
  const d = toInstant(iso);
  if (!d) return typeof iso === "string" ? iso : "";
  let month = 0;
  let day = "";
  let year = "";
  let hour = "";
  let minute = "";
  let period = "";
  for (const p of easternStampFormatter.formatToParts(d)) {
    if (p.type === "month") month = Number(p.value);
    else if (p.type === "day") day = p.value;
    else if (p.type === "year") year = p.value;
    else if (p.type === "hour") hour = p.value;
    else if (p.type === "minute") minute = p.value;
    else if (p.type === "dayPeriod") period = p.value.toUpperCase().replace(/\./g, "");
  }
  return `${MONTH_SHORT[month - 1] ?? ""} ${day}, ${year}, ${hour}:${minute} ${period} ET`;
}

/**
 * Normalize a time to "HH:MM" (24 h). Accepts "9:05", "09:05", "09:05:30" and "09:05:30.000"
 * (native time inputs can add seconds). Returns null for anything else.
 */
export function normalizeTimeString(s: string): string | null {
  if (typeof s !== "string") return null;
  const m = TIME_RE.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] === undefined ? 0 : Number(m[3]);
  if (h > 23 || min > 59 || sec > 59) return null;
  return `${pad2(h)}:${pad2(min)}`;
}

/** True for an exact 24 h "HH:MM" time. */
export function isValidTimeString(s: string): boolean {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** "18:00" -> "6:00 PM", "00:30" -> "12:30 AM". Returns the input when it is not a time. */
export function formatTime12(hhmm: string): string {
  const t = normalizeTimeString(hhmm);
  if (!t) return typeof hhmm === "string" ? hhmm : "";
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(m)} ${period}`;
}

/** "18:00", "23:00" -> "6:00 PM - 11:00 PM"; a missing end shows the start only. */
export function formatTimeRange(start: string, end?: string | null): string {
  const s = formatTime12(start);
  const e = end ? normalizeTimeString(end) : null;
  return e ? `${s} - ${formatTime12(e)}` : s;
}
