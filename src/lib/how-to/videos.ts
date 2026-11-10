/**
 * How-to video registry (code-owned). One short video per staff-facing module.
 *
 * - `route`: the Hub page the video belongs to (matches the page and its sub-pages).
 * - `file`: mp4 name inside the LRE Bunny folder (see HOWTO_BUNNY_BASE).
 * - `guideSlug`: the Ask the Hub guide article the script was written from
 *   (src/lib/kb/hub-feature-articles.ts).
 * - `audience`: who can open the page. Pages limited to a department or role
 *   MUST NOT show their video to anyone else (link, popup, or course lesson).
 *   "admin" videos belong to admin-only modules and are shown to admins only.
 * - `alsoRoutes`: extra pages that open the same video (e.g. grouped modules).
 *
 * Adding a video: record it, upload it (scripts/upload-howto.sh), add an entry
 * here, run `python3 scripts/gen-howto-course.py`, and run the SQL it writes.
 * Course lessons and points are generated from this list.
 */
import { canAccessVidentAv } from "@/lib/vident-av-access";
import { isGuestRole } from "@/lib/auth/guest";
import type { Profile } from "@/lib/types/database";

export const HOWTO_BUNNY_BASE = "https://lre-productions.b-cdn.net/lre-howto";
export const HOW_TO_COURSE_SLUG = "how-to-videos";

export type HowToAudience = "all" | "vident-av" | "lead" | "admin";

export type HowToVideo = {
  slug: string;
  route: string;
  title: string;
  file: string;
  guideSlug: string;
  audience: HowToAudience;
  /** Extra pages that show this same video (same audience rules). */
  alsoRoutes?: string[];
  /** Bump when the mp4 is re-recorded under the same file name: the player adds ?v=<this> so browsers skip their 30-day cached copy. */
  v?: string;
};

export const HOW_TO_VIDEOS: HowToVideo[] = [
];

type AccessProfile = Pick<Profile, "role" | "departments">;

export function howToVideoSrc(video: HowToVideo): string {
  return `${HOWTO_BUNNY_BASE}/${video.file}`;
}

/** Can this person open the module the video belongs to? */
export function canWatchHowTo(
  video: HowToVideo,
  profile: AccessProfile | null | undefined,
): boolean {
  if (!profile || isGuestRole(profile.role)) return false;
  switch (video.audience) {
    case "all":
      return true;
    case "vident-av":
      return canAccessVidentAv(profile);
    case "lead":
      return profile.role === "admin" || profile.role === "trainer";
    case "admin":
      return profile.role === "admin";
    default:
      return false;
  }
}

/** Longest matching route wins; sub-pages (/route/...) match their module. */
export function howToVideoForPath(
  pathname: string | null | undefined,
  profile: AccessProfile | null | undefined,
): HowToVideo | null {
  if (!pathname) return null;
  let best: HowToVideo | null = null;
  let bestLen = -1;
  for (const video of HOW_TO_VIDEOS) {
    for (const route of [video.route, ...(video.alsoRoutes ?? [])]) {
      const hit = pathname === route || pathname.startsWith(`${route}/`);
      if (hit && route.length > bestLen) {
        best = video;
        bestLen = route.length;
      }
    }
  }
  return best && canWatchHowTo(best, profile) ? best : null;
}

/** Registry entry for a course lesson (matched by its video URL). */
export function howToVideoForSrc(src: string): HowToVideo | null {
  return HOW_TO_VIDEOS.find((v) => howToVideoSrc(v) === src) ?? null;
}

/** How-to course lessons this person is allowed to see. */
export function filterHowToLessons<T extends { resource_href: string }>(
  lessons: T[],
  profile: AccessProfile | null | undefined,
): T[] {
  return lessons.filter((lesson) => {
    const video = howToVideoForSrc(lesson.resource_href);
    return video ? canWatchHowTo(video, profile) : false;
  });
}

export function isHowToLesson(
  courseSlug: string,
  lesson: { resource_href: string },
): boolean {
  return (
    courseSlug === HOW_TO_COURSE_SLUG && /\.mp4(\?|$)/i.test(lesson.resource_href)
  );
}
