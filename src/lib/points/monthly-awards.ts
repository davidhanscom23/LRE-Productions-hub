import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatAwardPeriod,
  type MonthlyAwardHolder,
  type MonthlyAwardType,
  type PersonAwardSummary,
} from "@/lib/points/monthly-awards-types";

export type {
  MonthlyAwardHolder,
  MonthlyAwardType,
  PersonAwardSummary,
} from "@/lib/points/monthly-awards-types";
export {
  AWARD_TYPE_LABEL,
  formatAwardPeriod,
} from "@/lib/points/monthly-awards-types";

/** Previous America/New_York calendar month as YYYY-MM. */
export function previousNyMonthPeriod(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? 0);
  const month = Number(parts.find((p) => p.type === "month")?.value ?? 1);
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  return `${prev.year}-${String(prev.month).padStart(2, "0")}`;
}

/** NY-month [start, end) as ISO strings for filtering hub_point_events. */
export function nyMonthBounds(period: string): { startIso: string; endIso: string } {
  const [y, m] = period.split("-").map(Number);
  const start = nyCivilToUtcIso(y, m, 1);
  const endMonth = m === 12 ? 1 : m + 1;
  const endYear = m === 12 ? y + 1 : y;
  const end = nyCivilToUtcIso(endYear, endMonth, 1);
  return { startIso: start, endIso: end };
}

function nyCivilToUtcIso(year: number, month: number, day: number): string {
  // Pick the UTC instant that is 00:00 on that civil day in America/New_York
  // by probing EST (-5) then verifying with Intl; adjust if DST.
  for (const offset of ["-04:00", "-05:00"]) {
    const candidate = new Date(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00${offset}`,
    );
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    });
    const parts = fmt.formatToParts(candidate);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    if (
      Number(get("year")) === year &&
      Number(get("month")) === month &&
      Number(get("day")) === day &&
      Number(get("hour")) === 0
    ) {
      return candidate.toISOString();
    }
  }
  // Fallback EST
  return new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00-05:00`,
  ).toISOString();
}

type ProfileLite = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  color: string | null;
  created_at: string;
  award_excluded?: boolean | null;
  role?: string | null;
};

type BalanceRow = {
  user_id: string;
  points: number;
  longest_streak: number;
};

function pickWinners(
  candidates: {
    userId: string;
    metric: number;
    longestStreak: number;
    createdAt: string;
    profile: ProfileLite;
  }[],
): typeof candidates {
  if (!candidates.length) return [];
  const bestMetric = Math.max(...candidates.map((c) => c.metric));
  let pool = candidates.filter((c) => c.metric === bestMetric && c.metric > 0);
  if (!pool.length) return [];
  const bestStreak = Math.max(...pool.map((c) => c.longestStreak));
  pool = pool.filter((c) => c.longestStreak === bestStreak);
  const earliest = pool
    .map((c) => c.createdAt)
    .sort()[0];
  pool = pool.filter((c) => c.createdAt === earliest);
  return pool;
}

async function loadEligibleBalances(
  supabase: SupabaseClient,
): Promise<
  {
    userId: string;
    points: number;
    longestStreak: number;
    createdAt: string;
    profile: ProfileLite;
  }[]
> {
  const { data: balances } = await supabase
    .from("hub_point_balances")
    .select("user_id, points, longest_streak")
    .gt("points", 0);

  if (!balances?.length) return [];

  const ids = balances.map((b) => String(b.user_id));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, color, created_at, award_excluded, role, is_active")
    .in("id", ids)
    .eq("is_active", true)
    .neq("role", "guest");

  const byId = new Map(
    (profiles ?? []).map((p) => [String(p.id), p as ProfileLite] as const),
  );

  const out: {
    userId: string;
    points: number;
    longestStreak: number;
    createdAt: string;
    profile: ProfileLite;
  }[] = [];

  for (const row of balances as BalanceRow[]) {
    const profile = byId.get(String(row.user_id));
    if (!profile) continue;
    if (profile.award_excluded) continue;
    if (profile.role === "guest") continue;
    out.push({
      userId: String(row.user_id),
      points: Number(row.points) || 0,
      longestStreak: Number(row.longest_streak) || 0,
      createdAt: String(profile.created_at),
      profile,
    });
  }
  return out;
}

async function monthEarnedByUser(
  supabase: SupabaseClient,
  period: string,
): Promise<Map<string, number>> {
  const { startIso, endIso } = nyMonthBounds(period);
  const { data: events } = await supabase
    .from("hub_point_events")
    .select("user_id, points")
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  const map = new Map<string, number>();
  for (const row of events ?? []) {
    const id = String(row.user_id);
    map.set(id, (map.get(id) ?? 0) + (Number(row.points) || 0));
  }
  return map;
}

/** Current holders = most recent period's awards per type. */
export async function getCurrentMonthlyAwards(
  supabase: SupabaseClient,
): Promise<MonthlyAwardHolder[]> {
  const { data: latest } = await supabase
    .from("hub_monthly_awards")
    .select("period")
    .order("period", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest?.period) return [];
  return getAwardsForPeriod(supabase, String(latest.period));
}

export async function getAwardsForPeriod(
  supabase: SupabaseClient,
  period: string,
): Promise<MonthlyAwardHolder[]> {
  const { data: rows } = await supabase
    .from("hub_monthly_awards")
    .select("id, period, award_type, user_id, metric_value")
    .eq("period", period)
    .order("award_type", { ascending: true });

  if (!rows?.length) return [];

  const ids = rows.map((r) => String(r.user_id));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, color")
    .in("id", ids);

  const byId = new Map(
    (profiles ?? []).map((p) => [String(p.id), p] as const),
  );

  return rows.map((row) => {
    const profile = byId.get(String(row.user_id));
    return {
      id: String(row.id),
      period: String(row.period),
      awardType: row.award_type as MonthlyAwardType,
      userId: String(row.user_id),
      fullName: String(profile?.full_name ?? "Teammate"),
      avatarUrl: profile?.avatar_url ? String(profile.avatar_url) : null,
      color: profile?.color ? String(profile.color) : null,
      metricValue: Number(row.metric_value) || 0,
    };
  });
}

/** All awards newest period first. */
export async function getMonthlyAwardsHistory(
  supabase: SupabaseClient,
): Promise<{ period: string; awards: MonthlyAwardHolder[] }[]> {
  const { data: rows } = await supabase
    .from("hub_monthly_awards")
    .select("id, period, award_type, user_id, metric_value")
    .order("period", { ascending: false });

  if (!rows?.length) return [];

  const ids = Array.from(new Set(rows.map((r) => String(r.user_id))));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, color")
    .in("id", ids);
  const byId = new Map(
    (profiles ?? []).map((p) => [String(p.id), p] as const),
  );

  const byPeriod = new Map<string, MonthlyAwardHolder[]>();
  for (const row of rows) {
    const period = String(row.period);
    const profile = byId.get(String(row.user_id));
    const holder: MonthlyAwardHolder = {
      id: String(row.id),
      period,
      awardType: row.award_type as MonthlyAwardType,
      userId: String(row.user_id),
      fullName: String(profile?.full_name ?? "Teammate"),
      avatarUrl: profile?.avatar_url ? String(profile.avatar_url) : null,
      color: profile?.color ? String(profile.color) : null,
      metricValue: Number(row.metric_value) || 0,
    };
    const list = byPeriod.get(period) ?? [];
    list.push(holder);
    byPeriod.set(period, list);
  }

  return Array.from(byPeriod.entries()).map(([period, awards]) => ({
    period,
    awards,
  }));
}

/** Per-user trophy summary for People cards. */
export async function getPersonAwardSummaries(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, PersonAwardSummary>> {
  const map = new Map<string, PersonAwardSummary>();
  if (!userIds.length) return map;

  const current = await getCurrentMonthlyAwards(supabase);
  const currentPeriod = current[0]?.period ?? null;
  const currentOverall = new Set(
    current.filter((a) => a.awardType === "overall_leader").map((a) => a.userId),
  );
  const currentMvp = new Set(
    current.filter((a) => a.awardType === "monthly_mvp").map((a) => a.userId),
  );

  const { data: allWins } = await supabase
    .from("hub_monthly_awards")
    .select("user_id")
    .in("user_id", userIds);

  const winCounts = new Map<string, number>();
  for (const row of allWins ?? []) {
    const id = String(row.user_id);
    winCounts.set(id, (winCounts.get(id) ?? 0) + 1);
  }

  for (const id of userIds) {
    map.set(id, {
      currentOverall: currentOverall.has(id),
      currentMvp: currentMvp.has(id),
      currentPeriod,
      totalWins: winCounts.get(id) ?? 0,
    });
  }
  return map;
}

export type MonthlyAwardsRunResult = {
  ran: boolean;
  period: string | null;
  overall: number;
  mvp: number;
  skipped: boolean;
  error: string | null;
};

/**
 * Compute and persist trophies for a completed month (recognition only).
 * Idempotent on (period, award_type, user_id).
 */
export async function runMonthlyHubAwards(
  supabase: SupabaseClient,
  period?: string,
): Promise<MonthlyAwardsRunResult> {
  const target = period ?? previousNyMonthPeriod();

  const { data: existing } = await supabase
    .from("hub_monthly_awards")
    .select("id")
    .eq("period", target)
    .limit(1);

  if (existing?.length) {
    return {
      ran: true,
      period: target,
      overall: 0,
      mvp: 0,
      skipped: true,
      error: null,
    };
  }

  const eligible = await loadEligibleBalances(supabase);
  const overallWinners = pickWinners(
    eligible.map((e) => ({
      userId: e.userId,
      metric: e.points,
      longestStreak: e.longestStreak,
      createdAt: e.createdAt,
      profile: e.profile,
    })),
  );

  const earned = await monthEarnedByUser(supabase, target);
  const mvpCandidates = eligible
    .map((e) => ({
      userId: e.userId,
      metric: earned.get(e.userId) ?? 0,
      longestStreak: e.longestStreak,
      createdAt: e.createdAt,
      profile: e.profile,
    }))
    .filter((c) => c.metric > 0);
  const mvpWinners = pickWinners(mvpCandidates);

  const inserts: {
    period: string;
    award_type: MonthlyAwardType;
    user_id: string;
    metric_value: number;
  }[] = [];

  for (const w of overallWinners) {
    inserts.push({
      period: target,
      award_type: "overall_leader",
      user_id: w.userId,
      metric_value: w.metric,
    });
  }
  for (const w of mvpWinners) {
    inserts.push({
      period: target,
      award_type: "monthly_mvp",
      user_id: w.userId,
      metric_value: w.metric,
    });
  }

  if (inserts.length) {
    const { error } = await supabase.from("hub_monthly_awards").insert(inserts);
    if (error) {
      return {
        ran: false,
        period: target,
        overall: 0,
        mvp: 0,
        skipped: false,
        error: error.message,
      };
    }

    // Congrats notifications (no points). Deduped by unique award rows already.
    const { insertNotifications } = await import("@/lib/notifications/notify");
    const monthLabel = formatAwardPeriod(target);
    const notes = inserts.map((row) => ({
      userId: row.user_id,
      kind: "info" as const,
      title:
        row.award_type === "overall_leader"
          ? `You're ${monthLabel}'s Overall Leader`
          : `You're ${monthLabel}'s Monthly MVP`,
      body:
        row.award_type === "overall_leader"
          ? `Highest Hub points total at the end of ${monthLabel}. See Winners Hall of Fame.`
          : `Most Hub points earned during ${monthLabel}. See Winners Hall of Fame.`,
      href: "/winners",
    }));
    try {
      await insertNotifications(supabase, notes);
    } catch {
      // non-critical
    }
  }

  return {
    ran: true,
    period: target,
    overall: overallWinners.length,
    mvp: mvpWinners.length,
    skipped: false,
    error: null,
  };
}
