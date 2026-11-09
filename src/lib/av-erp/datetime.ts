/** Quote gear/charge windows are edited in America/New_York wall time. */

export const AV_ERP_TIME_ZONE = "America/New_York";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function partsInZone(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const bits = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(bits.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** ISO timestamptz → `YYYY-MM-DDTHH:MM` for datetime-local, in Eastern. */
export function isoToDatetimeLocalEastern(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = partsInZone(d, AV_ERP_TIME_ZONE);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * `datetime-local` value treated as Eastern wall time → ISO UTC.
 * Avoids Vercel/server UTC misreading `new Date("2026-05-01T08:00")`.
 */
export function datetimeLocalEasternToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const m = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/,
  );
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const desired = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;

  // Start from the same wall clock as if it were UTC, then correct for Eastern.
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 4; i++) {
    const shown = isoToDatetimeLocalEastern(new Date(guess).toISOString());
    if (shown === desired) {
      return new Date(guess).toISOString();
    }
    const sm = shown.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!sm) break;
    const shownUtc = Date.UTC(
      Number(sm[1]),
      Number(sm[2]) - 1,
      Number(sm[3]),
      Number(sm[4]),
      Number(sm[5]),
      0,
      0,
    );
    const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    guess += desiredUtc - shownUtc;
  }
  return new Date(guess).toISOString();
}
