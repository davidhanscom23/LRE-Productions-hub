import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { awardAchievement, type AwardResult } from "@/lib/points/hub-points";
import {
  HOW_TO_COURSE_SLUG,
  filterHowToLessons,
} from "@/lib/how-to/videos";
import type { Profile } from "@/lib/types/database";

/** America/New_York calendar day as YYYY-MM-DD. */
export function nyDayString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** ISO week key Mon–Sun in America/New_York, e.g. 2026-W32. */
export function nyWeekKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "01";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const weekday = get("weekday");
  // Build UTC noon for that NY calendar date, then ISO week.
  const utc = new Date(Date.UTC(year, month - 1, day, 12));
  const dayNum =
    weekday === "Sun"
      ? 7
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday) + 1;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * After a real (non-empty) chat message is sent, award sliding-scale chat points.
 * Caps at 20 pts/day via the three tier achievements. Weekly bonus at 5 active days.
 */
export async function awardChatActivity(
  supabase: SupabaseClient,
  userId: string,
  opts: { channelId: string; body: string; messageId: string },
): Promise<AwardResult[]> {
  const body = opts.body.trim();
  if (!body) return [];

  // Ignore rapid duplicate of the previous message in this channel.
  const { data: recent } = await supabase
    .from("messages")
    .select("id, body, created_at")
    .eq("channel_id", opts.channelId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(2);

  const prior = (recent ?? []).find((m) => m.id !== opts.messageId);
  if (prior && String(prior.body).trim() === body) {
    const priorAt = new Date(String(prior.created_at)).getTime();
    if (Number.isFinite(priorAt) && Date.now() - priorAt < 30_000) {
      return [];
    }
  }

  const day = nyDayString();
  // Count today's messages in NY (approx via created_at window ±1 day, filter in JS)
  const startUtc = new Date(`${day}T00:00:00-05:00`); // EST bound; EDT still overlaps
  const endUtc = new Date(startUtc.getTime() + 48 * 3600 * 1000);
  const { data: todays } = await supabase
    .from("messages")
    .select("id, body, created_at")
    .eq("user_id", userId)
    .gte("created_at", startUtc.toISOString())
    .lt("created_at", endUtc.toISOString());

  const dayFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const count = (todays ?? []).filter((m) => {
    const text = String(m.body ?? "").trim();
    if (!text) return false;
    return dayFmt.format(new Date(String(m.created_at))) === day;
  }).length;

  const awarded: AwardResult[] = [];
  const metaDay = { day, message_id: opts.messageId };

  if (count >= 1) {
    const r = await awardAchievement(supabase, "chat_active_daily", metaDay);
    if (r.awarded) awarded.push(r);
  }
  if (count >= 5) {
    const r = await awardAchievement(supabase, "chat_active_5", metaDay);
    if (r.awarded) awarded.push(r);
  }
  if (count >= 15) {
    const r = await awardAchievement(supabase, "chat_active_15", metaDay);
    if (r.awarded) awarded.push(r);
  }

  // Weekly consistency: 5 distinct days with chat_active_daily this Mon–Sun week
  const week = nyWeekKey();
  const { data: achievement } = await supabase
    .from("hub_achievements")
    .select("id")
    .eq("key", "chat_active_daily")
    .maybeSingle();

  const days = new Set<string>();
  if (achievement?.id) {
    const { data: weekEvents } = await supabase
      .from("hub_point_events")
      .select("meta")
      .eq("user_id", userId)
      .eq("achievement_id", achievement.id);

    for (const row of weekEvents ?? []) {
      const meta = (row.meta ?? {}) as Record<string, unknown>;
      const d = typeof meta.day === "string" ? meta.day : null;
      if (!d) continue;
      try {
        const [y, m, dd] = d.split("-").map(Number);
        const probe = new Date(Date.UTC(y, m - 1, dd, 17));
        if (nyWeekKey(probe) === week) days.add(d);
      } catch {
        // skip
      }
    }
  }
  if (days.size >= 5) {
    const r = await awardAchievement(supabase, "chat_active_week", {
      week,
      days: Array.from(days),
    });
    if (r.awarded) awarded.push(r);
  }

  return awarded;
}

/** Award course_completed if the user has finished every lesson in the course. */
export async function maybeAwardCourseCompleted(
  supabase: SupabaseClient,
  userId: string,
  courseSlug: string,
): Promise<AwardResult | null> {
  const slug = courseSlug.trim();
  if (!slug) return null;
  // How-to videos have their own points (5 per video + 100 bonus).
  if (slug === HOW_TO_COURSE_SLUG) return null;

  const { data: course } = await supabase
    .from("training_courses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!course?.id) return null;

  const { data: lessons } = await supabase
    .from("training_lessons")
    .select("id")
    .eq("course_id", course.id);
  const lessonIds = (lessons ?? []).map((l) => String(l.id));
  if (lessonIds.length === 0) return null;

  const { data: completions } = await supabase
    .from("training_lesson_completions")
    .select("lesson_id")
    .eq("user_id", userId)
    .in("lesson_id", lessonIds);

  const done = new Set((completions ?? []).map((c) => String(c.lesson_id)));
  if (lessonIds.some((id) => !done.has(id))) return null;

  return awardAchievement(supabase, "course_completed", {
    course_id: course.id,
    course_slug: slug,
  });
}

/**
 * How-to course: 5 points once per video (lesson), plus a 100-point bonus once
 * every video this person can open has been watched.
 */
export async function awardHowToVideoWatched(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role" | "departments">,
  lessonId: string,
): Promise<AwardResult[]> {
  const awarded: AwardResult[] = [];
  const perVideo = await awardAchievement(supabase, "howto_video_watched", {
    lesson_id: lessonId,
  });
  if (perVideo.awarded) awarded.push(perVideo);

  const { data: course } = await supabase
    .from("training_courses")
    .select("id")
    .eq("slug", HOW_TO_COURSE_SLUG)
    .maybeSingle();
  if (!course?.id) return awarded;

  const { data: lessons } = await supabase
    .from("training_lessons")
    .select("id, resource_href")
    .eq("course_id", course.id);
  const visible = filterHowToLessons(
    (lessons ?? []) as { id: string; resource_href: string }[],
    profile,
  );
  if (visible.length === 0) return awarded;

  const { data: completions } = await supabase
    .from("training_lesson_completions")
    .select("lesson_id")
    .eq("user_id", profile.id)
    .in(
      "lesson_id",
      visible.map((l) => l.id),
    );
  const done = new Set((completions ?? []).map((c) => String(c.lesson_id)));
  if (visible.some((l) => !done.has(l.id))) return awarded;

  const bonus = await awardAchievement(supabase, "howto_all_watched", {
    course_id: String(course.id),
  });
  if (bonus.awarded) awarded.push(bonus);
  return awarded;
}
