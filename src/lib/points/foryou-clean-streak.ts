import "server-only";

import { getForYouQueue } from "@/lib/for-you/queue";
import { awardAchievementTo } from "@/lib/points/hub-points";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types/database";
import { normalizeDepartments } from "@/lib/types/database";

export type ForYouCleanStreakResult = {
  ran: boolean;
  day: string | null;
  examined: number;
  clean: number;
  reset: number;
  awarded: number;
  error: string | null;
};

const MILESTONES: { days: number; key: string }[] = [
  { days: 3, key: "foryou_clean_3" },
  { days: 7, key: "foryou_clean_7" },
  { days: 10, key: "foryou_clean_10" },
  { days: 14, key: "foryou_clean_14" },
  { days: 30, key: "foryou_clean_30" },
];

function nyDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function formatYmd(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Add delta days to a YYYY-MM-DD (treating it as a civil date). */
function addCivilDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return formatYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** The most recently completed America/New_York calendar day. */
export function previousNyDay(now = new Date()): string {
  const today = nyDateParts(now);
  const todayStr = formatYmd(today.year, today.month, today.day);
  return addCivilDays(todayStr, -1);
}

/**
 * End-of-day For You clean streak.
 * "Clean" matches the For You empty state: totalActionable === 0 && sections.length === 0.
 */
export async function runForYouCleanStreak(): Promise<ForYouCleanStreakResult> {
  if (!isServiceRoleConfigured()) {
    return {
      ran: false,
      day: null,
      examined: 0,
      clean: 0,
      reset: 0,
      awarded: 0,
      error: "SUPABASE_SERVICE_ROLE_KEY is required for the For You streak cron.",
    };
  }

  const day = previousNyDay();
  const supabase = createServiceClient();
  const { data: rows, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, avatar_url, departments, title, phone, birthday, start_date, bio, facebook_url, instagram_url, linkedin_url, twitter_url, is_active, color, reports_to, theme_preference, created_at, updated_at",
    )
    .eq("is_active", true)
    .neq("role", "guest")
    .order("full_name", { ascending: true });

  if (error) {
    return {
      ran: false,
      day,
      examined: 0,
      clean: 0,
      reset: 0,
      awarded: 0,
      error: error.message,
    };
  }

  let clean = 0;
  let reset = 0;
  let awarded = 0;
  const yesterday = addCivilDays(day, -1);

  for (const raw of rows ?? []) {
    const profile: Profile = {
      ...(raw as Profile),
      departments: normalizeDepartments((raw as Profile).departments),
    };

    const { data: existing } = await supabase
      .from("hub_foryou_streaks")
      .select("current_streak, longest_streak, last_clean_day")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (existing?.last_clean_day === day) {
      continue;
    }

    let isClean = false;
    try {
      const queue = await getForYouQueue(profile, supabase);
      isClean = queue.totalActionable === 0;
    } catch (err) {
      console.error(
        "[foryou-clean-streak] queue failed",
        profile.id,
        err instanceof Error ? err.message : err,
      );
      continue;
    }

    let streak = 0;
    if (isClean) {
      const prev = existing?.last_clean_day
        ? String(existing.last_clean_day)
        : null;
      streak = prev === yesterday ? (existing?.current_streak ?? 0) + 1 : 1;
      clean += 1;
    } else {
      streak = 0;
      reset += 1;
    }

    const longest = Math.max(existing?.longest_streak ?? 0, streak);

    await supabase.from("hub_foryou_streaks").upsert(
      {
        user_id: profile.id,
        current_streak: streak,
        longest_streak: longest,
        last_clean_day: isClean
          ? day
          : (existing?.last_clean_day ?? null),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (isClean && streak > 0) {
      for (const m of MILESTONES) {
        if (streak < m.days) continue;
        const result = await awardAchievementTo(supabase, profile.id, m.key, {
          day,
          streak,
        });
        if (result.awarded) awarded += 1;
      }
    }
  }

  return {
    ran: true,
    day,
    examined: (rows ?? []).length,
    clean,
    reset,
    awarded,
    error: null,
  };
}
