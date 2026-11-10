/**
 * Holiday hub themes — full-shell skins for the LRE Hub.
 * Dates are resolved in America/New_York so the whole company shares one day.
 *
 * Guests never get a holiday skin; admins can preview any holiday from Hub health.
 */

import { COMPANY_TIME_ZONE } from "@/lib/calendar/format";

/** All holiday dates resolve in the company time zone (America/New_York). */
export const HOLIDAY_TIME_ZONE = COMPANY_TIME_ZONE;

export const HOLIDAY_IDS = [
  "new-years-day",
  "mlk-day",
  "valentines-day",
  "st-patricks-day",
  "easter-sunday",
  "cinco-de-mayo",
  "mothers-day",
  "memorial-day",
  "fathers-day",
  "independence-day",
  "halloween",
  "veterans-day",
  "thanksgiving",
  "christmas-eve",
  "christmas-day",
  "new-years-eve",
] as const;

export type HolidayId = (typeof HOLIDAY_IDS)[number];

export type HolidayTheme = {
  id: HolidayId;
  name: string;
  /** Big greeting on the home hero + popup. */
  greeting: string;
  /** Motto-bar line (rendered uppercase by the bar). */
  tagline: string;
  /** Small line under the greeting in the popup. */
  subline: string;
  /** "light" skins flip the chrome to dark text on pale glass. */
  mode: "dark" | "light";
  /** Human-readable date rule for the admin picker. */
  rule: string;
  /** YYYY-MM-DD for a given year. */
  dateFor: (year: number) => string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const key = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** nth (1-based) given weekday (0=Sun) of a month (1-12). */
function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  return key(year, month, day);
}

/** Last given weekday of a month. */
function lastWeekday(year: number, month: number, weekday: number) {
  const last = new Date(Date.UTC(year, month, 0));
  const diff = (last.getUTCDay() - weekday + 7) % 7;
  return key(year, month, last.getUTCDate() - diff);
}

/** Western Easter Sunday (anonymous Gregorian algorithm). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return key(year, month, day);
}

export const HOLIDAY_THEMES: Record<HolidayId, HolidayTheme> = {
  "new-years-day": {
    id: "new-years-day",
    name: "New Year's Day",
    greeting: "Happy New Year",
    tagline: "Happy New Year — fresh start, fresh stages. Cheers to the year ahead.",
    subline: "A brand-new year of unforgettable celebrations begins today.",
    mode: "dark",
    rule: "January 1",
    dateFor: (y) => key(y, 1, 1),
  },
  "mlk-day": {
    id: "mlk-day",
    name: "Martin Luther King Jr. Day",
    greeting: "Martin Luther King Jr. Day",
    tagline: "Martin Luther King Jr. Day — a day on, not a day off. Serve. Lift. Unite.",
    subline: "Honoring a legacy of courage, service, and community.",
    mode: "dark",
    rule: "Third Monday of January",
    dateFor: (y) => nthWeekday(y, 1, 1, 3),
  },
  "valentines-day": {
    id: "valentines-day",
    name: "Valentine's Day",
    greeting: "Happy Valentine's Day",
    tagline: "Happy Valentine's Day — spread the love, one event at a time.",
    subline: "Love is the reason we do what we do.",
    mode: "dark",
    rule: "February 14",
    dateFor: (y) => key(y, 2, 14),
  },
  "st-patricks-day": {
    id: "st-patricks-day",
    name: "St. Patrick's Day",
    greeting: "Happy St. Patrick's Day",
    tagline: "Happy St. Patrick's Day — the luck of the Irish on every show.",
    subline: "May your run of show be golden and your load-ins be lucky.",
    mode: "dark",
    rule: "March 17",
    dateFor: (y) => key(y, 3, 17),
  },
  "easter-sunday": {
    id: "easter-sunday",
    name: "Easter Sunday",
    greeting: "Happy Easter",
    tagline: "Happy Easter — new beginnings, fresh blooms, and joy in the air.",
    subline: "Wishing you and your family a beautiful spring day.",
    mode: "light",
    rule: "Easter Sunday (varies)",
    dateFor: easterSunday,
  },
  "cinco-de-mayo": {
    id: "cinco-de-mayo",
    name: "Cinco de Mayo",
    greeting: "¡Feliz Cinco de Mayo!",
    tagline: "¡Feliz Cinco de Mayo! — color, flavor, and fiesta energy.",
    subline: "Let the celebration begin.",
    mode: "dark",
    rule: "May 5",
    dateFor: (y) => key(y, 5, 5),
  },
  "mothers-day": {
    id: "mothers-day",
    name: "Mother's Day",
    greeting: "Happy Mother's Day",
    tagline: "Happy Mother's Day — thank you for everything you do.",
    subline: "To every mom on this team and in our community: you are loved.",
    mode: "dark",
    rule: "Second Sunday of May",
    dateFor: (y) => nthWeekday(y, 5, 0, 2),
  },
  "memorial-day": {
    id: "memorial-day",
    name: "Memorial Day",
    greeting: "Memorial Day",
    tagline: "Memorial Day — we remember. We honor. We never forget.",
    subline: "In grateful memory of those who gave everything.",
    mode: "dark",
    rule: "Last Monday of May",
    dateFor: (y) => lastWeekday(y, 5, 1),
  },
  "fathers-day": {
    id: "fathers-day",
    name: "Father's Day",
    greeting: "Happy Father's Day",
    tagline: "Happy Father's Day — thank you for leading by example.",
    subline: "To every dad who shows up: this one is for you.",
    mode: "dark",
    rule: "Third Sunday of June",
    dateFor: (y) => nthWeekday(y, 6, 0, 3),
  },
  "independence-day": {
    id: "independence-day",
    name: "Independence Day",
    greeting: "Happy 4th of July",
    tagline: "Happy 4th of July — red, white, and boom. Enjoy the fireworks.",
    subline: "Celebrating freedom, family, and the best night of the summer.",
    mode: "dark",
    rule: "July 4",
    dateFor: (y) => key(y, 7, 4),
  },
  halloween: {
    id: "halloween",
    name: "Halloween",
    greeting: "Happy Halloween",
    tagline: "Happy Halloween — the stage is set for a spooky good time. Lights, camera, fright.",
    subline: "Tricks, treats, and a spooky good time.",
    mode: "dark",
    rule: "October 31",
    dateFor: (y) => key(y, 10, 31),
  },
  "veterans-day": {
    id: "veterans-day",
    name: "Veterans Day",
    greeting: "Veterans Day",
    tagline: "Veterans Day — thank you for your service and your sacrifice.",
    subline: "Honoring all who served.",
    mode: "dark",
    rule: "November 11",
    dateFor: (y) => key(y, 11, 11),
  },
  thanksgiving: {
    id: "thanksgiving",
    name: "Thanksgiving Day",
    greeting: "Happy Thanksgiving",
    tagline: "Happy Thanksgiving — grateful for this team and every celebration we share.",
    subline: "Wishing you a table full of love.",
    mode: "dark",
    rule: "Fourth Thursday of November",
    dateFor: (y) => nthWeekday(y, 11, 4, 4),
  },
  "christmas-eve": {
    id: "christmas-eve",
    name: "Christmas Eve",
    greeting: "Merry Christmas Eve",
    tagline: "Merry Christmas Eve — cozy lights, quiet snow, and warm wishes.",
    subline: "Peace and joy to you and yours tonight.",
    mode: "dark",
    rule: "December 24",
    dateFor: (y) => key(y, 12, 24),
  },
  "christmas-day": {
    id: "christmas-day",
    name: "Christmas Day",
    greeting: "Merry Christmas",
    tagline: "Merry Christmas — joy to the world from all of us at LRE Productions.",
    subline: "Thank you for making every season bright.",
    mode: "dark",
    rule: "December 25",
    dateFor: (y) => key(y, 12, 25),
  },
  "new-years-eve": {
    id: "new-years-eve",
    name: "New Year's Eve",
    greeting: "Happy New Year's Eve",
    tagline: "Happy New Year's Eve — ten, nine, eight… make it a night to remember.",
    subline: "The biggest night of the year is a go. Showtime.",
    mode: "dark",
    rule: "December 31",
    dateFor: (y) => key(y, 12, 31),
  },
};

/** Today's YYYY-MM-DD in America/New_York. */
export function holidayDateKeyNy(from = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: HOLIDAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(from);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The holiday active on a NY date key (or today), else null. */
export function activeHolidayId(dateKey = holidayDateKeyNy()): HolidayId | null {
  const year = Number(dateKey.slice(0, 4));
  for (const id of HOLIDAY_IDS) {
    if (HOLIDAY_THEMES[id].dateFor(year) === dateKey) return id;
  }
  return null;
}

export function isHolidayId(value: string | null | undefined): value is HolidayId {
  return Boolean(value) && (HOLIDAY_IDS as readonly string[]).includes(value as string);
}
