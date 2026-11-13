import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type HubPointsDifficulty = "easy" | "medium" | "hard" | "legendary";

export type HubLeaderboardEntry = {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  color: string | null;
  points: number;
  currentStreak: number;
};

export type HubMyPoints = {
  points: number;
  currentStreak: number;
  longestStreak: number;
  lastCheckinDay: string | null;
};

export type AwardResult = {
  awarded: boolean;
  points: number;
  key?: string;
  title?: string;
  difficulty?: string;
  message?: string;
};

export type CheckinResult = {
  ok: boolean;
  already?: boolean;
  streak: number;
  points: number;
  awarded: AwardResult[];
  message?: string;
};

function asAward(raw: unknown): AwardResult {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    awarded: Boolean(row.awarded),
    points: Number(row.points) || 0,
    key: typeof row.key === "string" ? row.key : undefined,
    title: typeof row.title === "string" ? row.title : undefined,
    difficulty: typeof row.difficulty === "string" ? row.difficulty : undefined,
    message: typeof row.message === "string" ? row.message : undefined,
  };
}

/** Claim today's check-in + streak milestones (America/New_York day). */
export async function runDailyCheckin(
  supabase: SupabaseClient,
): Promise<CheckinResult> {
  const { data, error } = await supabase.rpc("hub_daily_checkin");
  if (error) {
    console.error("[hub-points] checkin failed", error.message);
    return {
      ok: false,
      streak: 0,
      points: 0,
      awarded: [],
      message: error.message,
    };
  }
  const row = (data && typeof data === "object" ? data : {}) as Record<
    string,
    unknown
  >;
  const awardedRaw = Array.isArray(row.awarded) ? row.awarded : [];
  return {
    ok: Boolean(row.ok),
    already: Boolean(row.already),
    streak: Number(row.streak) || 0,
    points: Number(row.points) || 0,
    awarded: awardedRaw.map(asAward),
    message: typeof row.message === "string" ? row.message : undefined,
  };
}

/** Award discovery points for visiting a Hub path (once per achievement). */
export async function discoverPath(
  supabase: SupabaseClient,
  path: string,
): Promise<AwardResult> {
  const { data, error } = await supabase.rpc("hub_discover_path", {
    p_path: path,
  });
  if (error) {
    console.error("[hub-points] discover failed", error.message);
    return { awarded: false, points: 0, message: error.message };
  }
  return asAward(data);
}

export async function awardAchievement(
  supabase: SupabaseClient,
  key: string,
  meta: Record<string, unknown> = {},
): Promise<AwardResult> {
  const { data, error } = await supabase.rpc("award_hub_achievement", {
    p_key: key,
    p_meta: meta,
  });
  if (error) {
    console.error("[hub-points] award failed", error.message);
    return { awarded: false, points: 0, message: error.message };
  }
  return asAward(data);
}

/** Award to a specific user (self, admin, or service role). */
export async function awardAchievementTo(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  meta: Record<string, unknown> = {},
): Promise<AwardResult> {
  const { data, error } = await supabase.rpc("award_hub_achievement_to", {
    p_user_id: userId,
    p_key: key,
    p_meta: meta,
  });
  if (error) {
    console.error("[hub-points] award-to failed", error.message);
    return { awarded: false, points: 0, message: error.message };
  }
  return asAward(data);
}

export async function adminGrantPoints(
  supabase: SupabaseClient,
  userId: string,
  points: number,
  reason: string,
): Promise<{
  ok: boolean;
  points?: number;
  total?: number;
  userName?: string;
  message?: string;
}> {
  const { data, error } = await supabase.rpc("admin_grant_hub_points", {
    p_user_id: userId,
    p_points: points,
    p_reason: reason,
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  const row = (data && typeof data === "object" ? data : {}) as Record<
    string,
    unknown
  >;
  return {
    ok: Boolean(row.ok),
    points: Number(row.points) || 0,
    total: Number(row.total) || 0,
    userName: typeof row.user_name === "string" ? row.user_name : undefined,
    message: typeof row.message === "string" ? row.message : undefined,
  };
}

export async function getMyPoints(
  supabase: SupabaseClient,
  userId: string,
): Promise<HubMyPoints> {
  const { data, error } = await supabase
    .from("hub_point_balances")
    .select("points, current_streak, longest_streak, last_checkin_day")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      points: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastCheckinDay: null,
    };
  }

  return {
    points: Number(data.points) || 0,
    currentStreak: Number(data.current_streak) || 0,
    longestStreak: Number(data.longest_streak) || 0,
    lastCheckinDay: data.last_checkin_day
      ? String(data.last_checkin_day)
      : null,
  };
}

/** Top N point holders for the Home leaderboard. */
export async function getPointsLeaderboard(
  supabase: SupabaseClient,
  limit = 3,
  opts: { excludeAwardExcluded?: boolean } = {},
): Promise<HubLeaderboardEntry[]> {
  const excludedIds = opts.excludeAwardExcluded
    ? await getAwardExcludedUserIds(supabase)
    : [];
  const excluded = new Set(excludedIds);

  // Fetch extra rows when filtering out excluded profiles so the limit still fills.
  const fetchLimit = Math.min(
    200,
    Math.max(limit, limit + excludedIds.length),
  );

  let query = supabase
    .from("hub_point_balances")
    .select("user_id, points, current_streak")
    .gt("points", 0)
    .order("points", { ascending: false })
    .limit(fetchLimit);

  if (excludedIds.length === 1) {
    query = query.neq("user_id", excludedIds[0]!);
  } else if (excludedIds.length > 1) {
    query = query.not("user_id", "in", `(${excludedIds.join(",")})`);
  }

  const { data: balances, error } = await query;

  if (error || !balances?.length) {
    if (error && !/hub_point_balances|relation|does not exist/i.test(error.message)) {
      console.error("[hub-points] leaderboard failed", error.message);
    }
    return [];
  }

  const ids = balances.map((b) => String(b.user_id));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, color, is_active")
    .in("id", ids);

  const byId = new Map(
    (profiles ?? []).map((p) => [String(p.id), p] as const),
  );

  const out: HubLeaderboardEntry[] = [];
  for (const row of balances) {
    const userId = String(row.user_id);
    if (excluded.has(userId)) continue;
    const profile = byId.get(userId);
    if (!profile || profile.is_active === false) continue;
    out.push({
      userId,
      fullName: String(profile.full_name ?? "Teammate"),
      avatarUrl: profile.avatar_url ? String(profile.avatar_url) : null,
      color: profile.color ? String(profile.color) : null,
      points: Number(row.points) || 0,
      currentStreak: Number(row.current_streak) || 0,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Top award-excluded score (David) — shown as the mark to beat on Standings.
 * Not eligible for monthly trophies; still public so the team can chase it.
 */
export async function getPointsTargetToBeat(
  supabase: SupabaseClient,
): Promise<HubLeaderboardEntry | null> {
  const excludedIds = await getAwardExcludedUserIds(supabase);
  if (!excludedIds.length) return null;

  let query = supabase
    .from("hub_point_balances")
    .select("user_id, points, current_streak")
    .gt("points", 0)
    .order("points", { ascending: false })
    .limit(1);

  if (excludedIds.length === 1) {
    query = query.eq("user_id", excludedIds[0]!);
  } else {
    query = query.in("user_id", excludedIds);
  }

  const { data: balances, error } = await query;
  if (error || !balances?.length) return null;

  const row = balances[0]!;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, color, is_active")
    .eq("id", row.user_id)
    .maybeSingle();

  if (!profile || profile.is_active === false) return null;

  return {
    userId: String(row.user_id),
    fullName: String(profile.full_name ?? "Teammate"),
    avatarUrl: profile.avatar_url ? String(profile.avatar_url) : null,
    color: profile.color ? String(profile.color) : null,
    points: Number(row.points) || 0,
    currentStreak: Number(row.current_streak) || 0,
  };
}

export type HubPointEventRow = {
  id: string;
  userId: string;
  userName: string;
  points: number;
  reason: string;
  awardedById: string | null;
  awardedByName: string | null;
  createdAt: string;
};

const ACTIVITY_PAGE_SIZE = 50;

/** Profiles excluded from monthly awards / competitive standings (e.g. David). */
async function getAwardExcludedUserIds(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("award_excluded", true);
  if (!error && data?.length) {
    return data.map((row) => String(row.id));
  }

  // Fallback when award_excluded column is missing: match known owner emails.
  const { data: byEmail } = await supabase
    .from("profiles")
    .select("id")
    .or(
      "email.ilike.david@yentertainmentdjs.com,email.ilike.luke@lukesent.com",
    );
  return (byEmail ?? []).map((row) => String(row.id));
}

/** Profiles whose Hub points Activity is admin-only (e.g. David). */
async function getActivityHiddenUserIds(
  supabase: SupabaseClient,
): Promise<string[]> {
  return getAwardExcludedUserIds(supabase);
}

/** Newest-first points ledger for the Activity tab (RLS-gated). */
export async function getPointsActivityLog(
  supabase: SupabaseClient,
  opts: {
    page?: number;
    personId?: string | null;
    /**
     * When set, only this user’s events are returned (staff “my activity”).
     * Takes precedence over personId.
     */
    onlyUserId?: string | null;
    /** When false, hide award_excluded people (David) from trainers. */
    includeHidden?: boolean;
  } = {},
): Promise<{
  rows: HubPointEventRow[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const page = Math.max(1, Math.trunc(opts.page ?? 1));
  const from = (page - 1) * ACTIVITY_PAGE_SIZE;
  const to = from + ACTIVITY_PAGE_SIZE; // fetch one extra to detect hasMore

  const onlyUserId = opts.onlyUserId?.trim() || "";
  const hiddenIds =
    onlyUserId || opts.includeHidden === true
      ? []
      : await getActivityHiddenUserIds(supabase);

  const personId = onlyUserId || opts.personId?.trim() || "";
  if (personId && hiddenIds.includes(personId)) {
    return { rows: [], page, pageSize: ACTIVITY_PAGE_SIZE, hasMore: false };
  }

  let query = supabase
    .from("hub_point_events")
    .select("id, user_id, points, reason, awarded_by, created_at")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (personId) {
    query = query.eq("user_id", personId);
  } else if (hiddenIds.length === 1) {
    query = query.neq("user_id", hiddenIds[0]!);
  } else if (hiddenIds.length > 1) {
    query = query.not("user_id", "in", `(${hiddenIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error || !data?.length) {
    if (error && !/hub_point_events|relation|does not exist|points_log_public/i.test(error.message)) {
      console.error("[hub-points] activity log failed", error.message);
    }
    return { rows: [], page, pageSize: ACTIVITY_PAGE_SIZE, hasMore: false };
  }

  const hasMore = data.length > ACTIVITY_PAGE_SIZE;
  const slice = hasMore ? data.slice(0, ACTIVITY_PAGE_SIZE) : data;

  const ids = new Set<string>();
  for (const row of slice) {
    ids.add(String(row.user_id));
    if (row.awarded_by) ids.add(String(row.awarded_by));
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", Array.from(ids));

  const nameById = new Map(
    (profiles ?? []).map(
      (p) => [String(p.id), String(p.full_name ?? "Teammate")] as const,
    ),
  );

  const rows: HubPointEventRow[] = slice.map((row) => {
    const awardedById = row.awarded_by ? String(row.awarded_by) : null;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      userName: nameById.get(String(row.user_id)) ?? "Teammate",
      points: Number(row.points) || 0,
      reason: String(row.reason ?? "").trim() || "Points award",
      awardedById,
      awardedByName: awardedById
        ? (nameById.get(awardedById) ?? "Admin")
        : null,
      createdAt: String(row.created_at),
    };
  });

  return { rows, page, pageSize: ACTIVITY_PAGE_SIZE, hasMore };
}

/** Active staff with points, for the Activity person filter. */
export async function getPointsPeopleOptions(
  supabase: SupabaseClient,
  opts: { includeHidden?: boolean } = {},
): Promise<{ id: string; name: string }[]> {
  const { data: balances } = await supabase
    .from("hub_point_balances")
    .select("user_id")
    .gt("points", 0);
  const ids = (balances ?? []).map((b) => String(b.user_id));
  if (!ids.length) return [];

  const hiddenIds =
    opts.includeHidden === true
      ? []
      : await getActivityHiddenUserIds(supabase);
  const hidden = new Set(hiddenIds);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, is_active")
    .in("id", ids)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  return (profiles ?? [])
    .filter((p) => !hidden.has(String(p.id)))
    .map((p) => ({
      id: String(p.id),
      name: String(p.full_name ?? "Teammate"),
    }));
}
