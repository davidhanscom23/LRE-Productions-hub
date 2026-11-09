export type AvTeamShiftRow = {
  id: string;
  userId: string;
  staffName: string;
  eventName: string;
  clockedInAt: string;
  clockedOutAt: string | null;
  source: string;
};

export type AvTeamHoursRow = {
  userId: string;
  staffName: string;
  minutes: number;
  shiftCount: number;
};

/** ISO lower bound for “last 7 days” rollups (inclusive of open shifts). */
export function avRollupSinceIso(from = new Date()): string {
  return new Date(from.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

export function minutesBetween(startIso: string, endIso: string): number {
  const ms = Date.parse(endIso) - Date.parse(startIso);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 60_000);
}

export function formatHoursMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Sum closed-shift minutes per person (open shifts ignored in totals). */
export function buildAvTeamHours(
  shifts: AvTeamShiftRow[],
): AvTeamHoursRow[] {
  const map = new Map<string, AvTeamHoursRow>();
  for (const shift of shifts) {
    if (!shift.clockedOutAt) continue;
    const minutes = minutesBetween(shift.clockedInAt, shift.clockedOutAt);
    const entry = map.get(shift.userId) ?? {
      userId: shift.userId,
      staffName: shift.staffName,
      minutes: 0,
      shiftCount: 0,
    };
    entry.minutes += minutes;
    entry.shiftCount += 1;
    map.set(shift.userId, entry);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (b.minutes !== a.minutes) return b.minutes - a.minutes;
    return a.staffName.localeCompare(b.staffName);
  });
}
