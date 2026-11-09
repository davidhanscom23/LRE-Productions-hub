/** Pure helpers for gear calendar / planner / travel views. */

export type GearJobWindow = {
  id: string;
  reference: string;
  subject: string;
  status: string;
  gearStartsAt: string;
  gearEndsAt: string;
  customerName: string | null;
  venueName: string | null;
  hasHolds: boolean;
  stillOut: boolean;
};

export function startOfMonthUtc(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
}

export function endOfMonthUtc(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
}

/** Inclusive calendar-day overlap in America/New_York wall dates. */
export function windowsOverlapRange(
  startsAt: string,
  endsAt: string,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  const a = new Date(startsAt).getTime();
  const b = new Date(endsAt).getTime();
  if (![a, b].every(Number.isFinite)) return false;
  return a <= rangeEnd.getTime() && b >= rangeStart.getTime();
}

export function jobsInRange(
  jobs: GearJobWindow[],
  rangeStart: Date,
  rangeEnd: Date,
): GearJobWindow[] {
  return jobs.filter((j) =>
    windowsOverlapRange(j.gearStartsAt, j.gearEndsAt, rangeStart, rangeEnd),
  );
}

export type TravelBucket = "leave" | "return";

export function travelEventsForDay(
  jobs: GearJobWindow[],
  dayYmd: string,
  timeZone = "America/New_York",
): Array<GearJobWindow & { bucket: TravelBucket; sortAt: string }> {
  const out: Array<GearJobWindow & { bucket: TravelBucket; sortAt: string }> =
    [];
  for (const job of jobs) {
    // Travel MVP: confirmed/out (order) or still out, plus quotation with holds
    const eligible =
      job.status === "order" ||
      job.stillOut ||
      (job.status === "quotation" && job.hasHolds);
    if (!eligible) continue;
    const leaveYmd = ymdInZone(job.gearStartsAt, timeZone);
    const returnYmd = ymdInZone(job.gearEndsAt, timeZone);
    if (leaveYmd === dayYmd) {
      out.push({ ...job, bucket: "leave", sortAt: job.gearStartsAt });
    }
    if (returnYmd === dayYmd) {
      out.push({ ...job, bucket: "return", sortAt: job.gearEndsAt });
    }
  }
  out.sort((a, b) => a.sortAt.localeCompare(b.sortAt));
  return out;
}

export function ymdInZone(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const bits = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    bits.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Days of month (1..N) that a job covers in a given Eastern month. */
export function coveredDaysInMonth(
  startsAt: string,
  endsAt: string,
  year: number,
  monthIndex: number,
  timeZone = "America/New_York",
): number[] {
  const monthStart = startOfMonthUtc(year, monthIndex);
  const monthEnd = endOfMonthUtc(year, monthIndex);
  if (!windowsOverlapRange(startsAt, endsAt, monthStart, monthEnd)) return [];

  const days: number[] = [];
  const cursor = new Date(monthStart);
  while (cursor.getTime() <= monthEnd.getTime()) {
    const ymd = ymdInZone(cursor.toISOString(), timeZone);
    const dayNum = Number(ymd.slice(8, 10));
    const dayStartIso = `${ymd}T00:00:00`;
    // Approximate: treat Eastern midnight boundaries via wall YMD compare
    const startYmd = ymdInZone(startsAt, timeZone);
    const endYmd = ymdInZone(endsAt, timeZone);
    if (ymd >= startYmd && ymd <= endYmd) {
      days.push(dayNum);
    }
    void dayStartIso;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return [...new Set(days)].sort((a, b) => a - b);
}

export function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
