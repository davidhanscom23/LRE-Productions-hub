/** Data for the Calendar staff-availability panel. */
export type StaffAvailabilityEntry = {
  id: string;
  name: string;
  departments: string[];
  /** Weekday keys the person is usually available, e.g. ["mon","tue"]. */
  availableDays: string[];
};

export type TeamTimeOffRow = {
  user_id: string;
  full_name: string;
  start_date: string;
  end_date: string;
  type: string;
};

export const WEEKDAY_KEYS = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** Default: available every day until someone sets a weekly pattern. */
export const DEFAULT_AVAILABLE_DAYS: WeekdayKey[] = [...WEEKDAY_KEYS];

/** Weekday key ("sun".."sat") for a local Date. */
export function weekdayKey(day: Date): string {
  return WEEKDAY_KEYS[day.getDay()];
}

/** Normalize stored days; empty/missing → all days (default available). */
export function normalizeAvailableDays(days: unknown): string[] {
  if (!Array.isArray(days) || days.length === 0) {
    return [...DEFAULT_AVAILABLE_DAYS];
  }
  const allowed = new Set<string>(WEEKDAY_KEYS);
  const out = Array.from(
    new Set(
      days
        .map((d) => String(d).trim().toLowerCase())
        .filter((d) => allowed.has(d)),
    ),
  );
  return out.length ? out : [...DEFAULT_AVAILABLE_DAYS];
}
