import { createClient } from "@/lib/supabase/server";
import {
  MOTIVATIONAL_QUOTES,
  quoteAt,
  type MotivationalQuote,
} from "@/lib/my-week/quotes";
import { COMPANY_TIME_ZONE } from "@/lib/calendar/format";

/** Prefer no self-repeat within this many days (~1 year). */
export const QUOTE_NO_REPEAT_DAYS = 365;

export type DailyQuote = MotivationalQuote & {
  day: string;
  quoteIndex: number;
};

/** Today's date key in America/New_York (YYYY-MM-DD). */
export function todayNyDateKey(from = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COMPANY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(from);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Date key N days before `day` (YYYY-MM-DD), calendar-arithmetic in UTC. */
export function daysBeforeDateKey(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function shuffleIndexes(seed: string, length: number): number[] {
  const indexes = Array.from({ length }, (_, i) => i);
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = indexes.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const j = Math.abs(h) % (i + 1);
    const tmp = indexes[i]!;
    indexes[i] = indexes[j]!;
    indexes[j] = tmp;
  }
  return indexes;
}

/**
 * Assign (or load) today's quote for a user.
 * - Different people get different quotes the same day (DB unique on day+quote_index)
 * - Prefer quotes the user hasn't seen in the last ~365 days
 * - Stable for the rest of the day once assigned
 */
export async function getOrAssignDailyQuote(
  userId: string,
): Promise<DailyQuote | null> {
  const supabase = await createClient();
  const day = todayNyDateKey();
  const poolSize = MOTIVATIONAL_QUOTES.length;
  if (poolSize === 0) return null;

  const { data: existing } = await supabase
    .from("daily_quote_assignments")
    .select("quote_index")
    .eq("day", day)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing && typeof existing.quote_index === "number") {
    const quote = quoteAt(existing.quote_index);
    if (quote) {
      return { ...quote, day, quoteIndex: existing.quote_index };
    }
  }

  const since = daysBeforeDateKey(day, QUOTE_NO_REPEAT_DAYS - 1);

  const [{ data: usedTodayRows }, { data: seenRecentlyRows }] =
    await Promise.all([
      supabase.rpc("daily_quote_indexes_used_on", { p_day: day }),
      supabase
        .from("daily_quote_assignments")
        .select("quote_index")
        .eq("user_id", userId)
        .gte("day", since),
    ]);

  const usedTodayRaw = (usedTodayRows ?? []) as unknown[];
  const usedTodaySet = new Set(
    usedTodayRaw.filter((n): n is number => typeof n === "number"),
  );
  const seenRecentlySet = new Set(
    (seenRecentlyRows ?? [])
      .map((row) => row.quote_index)
      .filter((n): n is number => typeof n === "number"),
  );

  const allIndexes = Array.from({ length: poolSize }, (_, i) => i);
  const unusedToday = allIndexes.filter((i) => !usedTodaySet.has(i));
  const freshInYear = unusedToday.filter((i) => !seenRecentlySet.has(i));
  const candidatePool =
    freshInYear.length > 0
      ? freshInYear
      : unusedToday.length > 0
        ? unusedToday
        : allIndexes;

  const candidates = shuffleIndexes(`${day}:${userId}`, candidatePool.length).map(
    (i) => candidatePool[i]!,
  );

  const { data: assignedIndex, error } = await supabase.rpc(
    "assign_daily_quote",
    {
      p_day: day,
      p_candidates: candidates,
    },
  );

  if (!error && typeof assignedIndex === "number") {
    const quote = quoteAt(assignedIndex);
    if (quote) return { ...quote, day, quoteIndex: assignedIndex };
  }

  // Fallback if RPC isn't migrated yet: best-effort direct insert
  for (const quoteIndex of candidates) {
    const { error: insertError } = await supabase
      .from("daily_quote_assignments")
      .insert({
        day,
        user_id: userId,
        quote_index: quoteIndex,
      });

    if (!insertError) {
      const quote = quoteAt(quoteIndex);
      if (quote) return { ...quote, day, quoteIndex };
    }

    if (insertError?.code === "23505") {
      const { data: again } = await supabase
        .from("daily_quote_assignments")
        .select("quote_index")
        .eq("day", day)
        .eq("user_id", userId)
        .maybeSingle();
      if (again && typeof again.quote_index === "number") {
        const quote = quoteAt(again.quote_index);
        if (quote) return { ...quote, day, quoteIndex: again.quote_index };
      }
    }
  }

  const fallbackIndex =
    Math.abs(
      Array.from(`${day}:${userId}`).reduce(
        (acc, ch) => Math.imul(acc ^ ch.charCodeAt(0), 16777619),
        2166136261,
      ),
    ) % poolSize;
  const quote = quoteAt(fallbackIndex);
  return quote ? { ...quote, day, quoteIndex: fallbackIndex } : null;
}
