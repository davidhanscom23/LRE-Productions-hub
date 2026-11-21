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
import { canAccessAv } from "@/lib/av-access";
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
  {
    slug: "services-catalog",
    route: "/services",
    title: "Services Catalog",
    file: "services.mp4",
    guideSlug: "services-catalog",
    audience: "all",
  },
  {
    slug: "home",
    route: "/",
    title: "Home",
    file: "home.mp4",
    guideSlug: "home",
    audience: "all",
  },
  {
    slug: "for-you",
    route: "/for-you",
    title: "For You",
    file: "for-you.mp4",
    guideSlug: "for-you",
    audience: "all",
  },
  {
    slug: "hub-points",
    route: "/points",
    title: "Hub points",
    file: "hub-points.mp4",
    guideSlug: "hub-points",
    audience: "all",
  },
  {
    slug: "ask-the-hub",
    route: "/ask",
    title: "Ask the Hub",
    file: "ask-the-hub.mp4",
    guideSlug: "ask-the-hub",
    audience: "all",
  },
  {
    slug: "my-week",
    route: "/my-week",
    title: "My Week",
    file: "my-week.mp4",
    guideSlug: "my-week",
    audience: "all",
  },
  {
    slug: "my-calendar",
    route: "/my-calendar",
    title: "My Calendar",
    file: "my-calendar.mp4",
    guideSlug: "my-calendar",
    audience: "all",
  },
  {
    slug: "time-off",
    route: "/time-off",
    title: "Time Off",
    file: "time-off.mp4",
    guideSlug: "time-off",
    audience: "all",
  },
  {
    slug: "action-center",
    route: "/action-center",
    title: "Action Center",
    file: "action-center.mp4",
    guideSlug: "action-center",
    audience: "all",
  },
  {
    slug: "partner-expenses",
    route: "/partner-expenses",
    title: "Partner Expenses",
    file: "partner-expenses.mp4",
    guideSlug: "partner-expenses",
    audience: "admin",
  },
  { slug: "gear-scan", route: "/gear-scan", title: "Gear scan", file: "gear-scan.mp4", guideSlug: "gear-scan", audience: "all" },
  { slug: "chat", route: "/chat", title: "Chat", file: "chat.mp4", guideSlug: "chat", audience: "all" },
  { slug: "announcements", route: "/announcements", title: "Announcements", file: "announcements.mp4", guideSlug: "announcements", audience: "all" },
  { slug: "forum", route: "/forum", title: "Forum", file: "forum.mp4", guideSlug: "forum", audience: "all" },
  { slug: "event-packets", route: "/event-packets", title: "Event Packets", file: "event-packets.mp4", guideSlug: "event-packets", audience: "all" },
  { slug: "end-of-event-report", route: "/end-of-event-report", title: "End of Event Report", file: "end-of-event-report.mp4", guideSlug: "end-of-event-report", audience: "all" },
  { slug: "submit-event-photos", route: "/submit-event-photos", title: "Submit Event Photos", file: "submit-event-photos.mp4", guideSlug: "submit-event-photos", audience: "all" },
  { slug: "teams", route: "/teams", title: "Teams", file: "teams.mp4", guideSlug: "teams", audience: "all" },
  { slug: "directory", route: "/directory", title: "Directory", file: "directory.mp4", guideSlug: "directory", audience: "all" },
  { slug: "training-portal", route: "/training-portal", title: "Training Portal", file: "training-portal.mp4", guideSlug: "training-portal", audience: "all" },
  { slug: "resources", route: "/resources", title: "Resources", file: "resources.mp4", guideSlug: "resources", audience: "all" },
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
      return canAccessAv(profile);
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
