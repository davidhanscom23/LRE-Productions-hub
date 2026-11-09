/**
 * Who sees which Changelog video.
 *
 * The database enforces this too (row level security in migration 171); this
 * mirror keeps the page honest for admins using "View as staff" and is what
 * the tests pin down.
 *
 * Rules:
 *  - admins see everything, including superseded (hidden) videos
 *  - everyone else sees live videos only
 *  - a new team member sees live videos from the 60 days before their start
 *    date onward; no start date on file means every live video
 *  - audience "vident-av" videos need Vident AV access (admins and the
 *    Audiovisual department); audience "lead" videos are for admins and Leads
 *    (role trainer)
 */
import { canAccessVidentAv } from "@/lib/vident-av-access";
import type { Profile } from "@/lib/types/database";

export const NEW_HIRE_WINDOW_DAYS = 60;

export type ChangelogVideoAudience = "all" | "lead" | "vident-av";

export type ChangelogVideo = {
  id: string;
  title: string;
  kind: "roundup" | "feature";
  audience: ChangelogVideoAudience;
  period_start: string;
  period_end: string;
  src: string;
  topic_keys: string[];
  summary: string;
  status: "live" | "superseded";
  superseded_by: string | null;
  created_at: string;
};

export type ChangelogVideoViewer = Pick<Profile, "role" | "departments"> & {
  start_date?: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** First day (YYYY-MM-DD) a new team member can see, or null for no limit. */
export function newHireCutoff(startDate: string | null | undefined): string | null {
  if (!startDate) return null;
  const t = Date.parse(`${startDate}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return new Date(t - NEW_HIRE_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10);
}

export function canSeeChangelogVideo(
  video: Pick<ChangelogVideo, "status" | "period_end" | "audience">,
  viewer: ChangelogVideoViewer | null | undefined,
): boolean {
  if (!viewer) return false;
  if (viewer.role === "admin") return true;
  if (video.status !== "live") return false;
  if (video.audience === "vident-av" && !canAccessVidentAv(viewer)) return false;
  if (video.audience === "lead" && viewer.role !== "trainer") return false;
  const cutoff = newHireCutoff(viewer.start_date);
  return cutoff === null || video.period_end >= cutoff;
}

/** "2026-10" for an ISO date, used to sit a video above its month's entries. */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Small label shown next to videos that are not for everyone. */
export function audienceLabel(audience: ChangelogVideoAudience): string | null {
  if (audience === "vident-av") return "AV team";
  if (audience === "lead") return "Leads";
  return null;
}
