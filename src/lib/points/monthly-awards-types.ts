export type MonthlyAwardType = "overall_leader" | "monthly_mvp";

export type MonthlyAwardHolder = {
  id: string;
  period: string;
  awardType: MonthlyAwardType;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  color: string | null;
  metricValue: number;
};

export type PersonAwardSummary = {
  currentOverall: boolean;
  currentMvp: boolean;
  currentPeriod: string | null;
  totalWins: number;
};

export const AWARD_TYPE_LABEL: Record<MonthlyAwardType, string> = {
  overall_leader: "Overall Leader",
  monthly_mvp: "Monthly MVP",
};

/** Left = Overall Leader, right = Monthly MVP (UI grids). */
export const AWARD_DISPLAY_ORDER: Record<MonthlyAwardType, number> = {
  overall_leader: 0,
  monthly_mvp: 1,
};

export function orderMonthlyAwards<T extends { awardType: MonthlyAwardType }>(
  awards: T[],
): T[] {
  return [...awards].sort(
    (a, b) => AWARD_DISPLAY_ORDER[a.awardType] - AWARD_DISPLAY_ORDER[b.awardType],
  );
}

/** Format period '2026-08' → 'August 2026'. */
export function formatAwardPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
