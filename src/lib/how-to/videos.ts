/**
 * How-to video registry (code-owned). One short video per staff-facing module.
 *
 * - `route`: the Hub page the video belongs to (matches the page and its sub-pages).
 * - `file`: mp4 name inside the Vident Bunny folder (see HOWTO_BUNNY_BASE).
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

export const HOWTO_BUNNY_BASE = "https://vident-productions.b-cdn.net/vident-howto";
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
    slug: "event-packets",
    route: "/event-packets",
    title: "Event Packets",
    file: "event-packets.mp4",
    guideSlug: "event-packets",
    audience: "all",
  },
  {
    slug: "end-of-event-report",
    route: "/end-of-event-report",
    title: "End of Event Report",
    file: "end-of-event-report.mp4",
    guideSlug: "end-of-event-report",
    audience: "all",
  },
  {
    slug: "submit-event-photos",
    route: "/submit-event-photos",
    title: "Submit Event Photos",
    file: "submit-event-photos.mp4",
    guideSlug: "submit-event-photos",
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
    slug: "kudos",
    route: "/kudos",
    title: "Kudos",
    file: "kudos.mp4",
    guideSlug: "kudos",
    audience: "all",
  },
  { slug: "expenses", route: "/expenses", title: "Expenses", file: "expenses.mp4", guideSlug: "expenses", audience: "all" },
  { slug: "contractor-pay", route: "/contractor-pay", title: "Contractor Pay", file: "contractor-pay.mp4", guideSlug: "contractor-pay", audience: "all" },
  { slug: "quoting", route: "/quoting", title: "Quoting", file: "quoting.mp4", guideSlug: "quoting", audience: "all" },
  { slug: "proposals", route: "/proposals", title: "Proposals", file: "proposals.mp4", guideSlug: "proposals", audience: "all" },
  { slug: "calendar", route: "/calendar", title: "Calendar", file: "calendar.mp4", guideSlug: "calendar", audience: "all" },
  { slug: "my-week", route: "/my-week", title: "My Week", file: "my-week.mp4", guideSlug: "my-week", audience: "all" },
  { slug: "for-you", route: "/for-you", title: "For You", file: "for-you.mp4", guideSlug: "for-you", audience: "all" },
  { slug: "people", route: "/people", title: "People", file: "people.mp4", guideSlug: "people", audience: "all" },
  { slug: "directory", route: "/directory", title: "Directory", file: "directory.mp4", guideSlug: "directory", audience: "all" },
  { slug: "polls", route: "/polls", title: "Polls", file: "polls.mp4", guideSlug: "polls", audience: "all" },
  { slug: "chat", route: "/chat", title: "Chat", file: "chat.mp4", guideSlug: "chat", audience: "all" },
  { slug: "resources", route: "/resources", title: "Resources", file: "resources.mp4", guideSlug: "resources", audience: "all" },
  { slug: "vendors", route: "/vendors", title: "Vendors", file: "vendors.mp4", guideSlug: "vendors", audience: "all" },
  { slug: "announcements", route: "/announcements", title: "Announcements", file: "announcements.mp4", guideSlug: "announcements", audience: "all" },
  { slug: "notification-settings", route: "/notification-settings", title: "Notification Settings", file: "notification-settings.mp4", guideSlug: "notification-preferences", audience: "all" },
  { slug: "ask-the-hub", route: "/ask", title: "Ask the Hub", file: "ask-the-hub.mp4", guideSlug: "ask-the-hub", audience: "all" },
  { slug: "reviews", route: "/reviews", title: "Performance Reviews", file: "reviews.mp4", guideSlug: "reviews", audience: "all" },
  { slug: "social-studio", route: "/social-studio", title: "Social Studio", file: "social-studio.mp4", guideSlug: "social-studio", audience: "all" },
  { slug: "documents", route: "/documents", title: "Documents", file: "documents.mp4", guideSlug: "staff-handbook", audience: "all" },
  { slug: "training-portal", route: "/training-portal", title: "Training Portal", file: "training-portal.mp4", guideSlug: "training-portal", audience: "all" },
  { slug: "teams", route: "/teams", title: "Teams", file: "teams.mp4", guideSlug: "teams", audience: "all" },
  { slug: "home", route: "/", title: "Home", file: "home.mp4", guideSlug: "home", audience: "all" },
  { slug: "vident-av", route: "/rentals", title: "Vident AV", file: "vident-av-v2.mp4", guideSlug: "vident-av", audience: "vident-av" },
  { slug: "staffing", route: "/staffing", title: "Staffing", file: "staffing.mp4", guideSlug: "staffing", audience: "lead" },
  { slug: "marketing-queue", route: "/marketing", title: "Marketing Queue", file: "marketing-queue.mp4", guideSlug: "marketing-queue", audience: "lead" },
  { slug: "content-sla", route: "/content-sla", title: "Content SLA", file: "content-sla.mp4", guideSlug: "content-sla", audience: "lead" },
  { slug: "hub-overview", route: "/support-guide", title: "Hub Overview", file: "hub-overview-v2.mp4", guideSlug: "hub-overview", audience: "all" },
  { slug: "hub-points", route: "/points", title: "Hub Points", file: "hub-points.mp4", guideSlug: "hub-points", audience: "all" },
  { slug: "winners", route: "/winners", title: "Winners", file: "winners.mp4", guideSlug: "winners", audience: "all" },
  { slug: "my-calendar", route: "/my-calendar", title: "My Calendar", file: "my-calendar.mp4", guideSlug: "my-calendar", audience: "all" },
  { slug: "forum", route: "/forum", title: "Forum", file: "forum.mp4", guideSlug: "forum", audience: "all" },
  { slug: "whats-new", route: "/changelog", title: "What's New", file: "whats-new.mp4", guideSlug: "whats-new-changelog", audience: "all" },
  { slug: "client-reviews", route: "/client-reviews", title: "Client Reviews", file: "client-reviews.mp4", guideSlug: "client-reviews", audience: "all" },
  { slug: "honeybook", route: "/honeybook", title: "HoneyBook", file: "honeybook-v9.mp4", guideSlug: "honeybook", audience: "all", v: "9" },
  { slug: "services", route: "/services", title: "Services Catalog", file: "services-v2.mp4", guideSlug: "services-catalog", audience: "all" },
  { slug: "scheduling", route: "/scheduling", title: "Scheduling", file: "scheduling.mp4", guideSlug: "scheduling", audience: "all" },
  { slug: "quickbooks-sync", route: "/quickbooks", title: "QuickBooks Sync", file: "quickbooks.mp4", guideSlug: "quickbooks-sync", audience: "admin" },
  { slug: "floor-plans", route: "/floor-plans", title: "Floor Plans", file: "floor-plans.mp4", guideSlug: "floor-plans", audience: "all" },
  { slug: "pebbles-and-rocks", route: "/pebbles-and-rocks", title: "Pebbles and Rocks", file: "pebbles-and-rocks.mp4", guideSlug: "pebbles-and-rocks", audience: "all" },
  { slug: "marketing-library", route: "/marketing-library", title: "Marketing Library", file: "marketing-library.mp4", guideSlug: "marketing-library", audience: "all" },
  { slug: "video-archives", route: "/videos", title: "Video Archives", file: "video-archives.mp4", guideSlug: "video-archives", audience: "all" },
  { slug: "tools", route: "/tools", title: "Tools", file: "tools.mp4", guideSlug: "tools-launcher", audience: "all" },
  { slug: "av-portals", route: "/av-portals", title: "AV Event Portals", file: "av-portals.mp4", guideSlug: "av-event-portals", audience: "all" },
  { slug: "av-show", route: "/av-show", title: "AV Show Control", file: "av-show.mp4", guideSlug: "av-show-control", audience: "all" },
  { slug: "av-estimates", route: "/rentals/quotes", title: "Vident AV: Estimates", file: "estimates-v2.mp4", guideSlug: "vident-av", audience: "vident-av" },
  { slug: "av-costs-reports", route: "/rentals/costs", title: "Vident AV: Costs and Reports", file: "av-costs-reports.mp4", guideSlug: "vident-av", audience: "vident-av", alsoRoutes: ["/rentals/reports"] },
  { slug: "av-calendar-planner-travel", route: "/rentals/calendar", title: "Vident AV: Calendar, Planner and Travel", file: "av-calendar-planner-travel.mp4", guideSlug: "vident-av", audience: "vident-av", alsoRoutes: ["/rentals/planner", "/rentals/travel"] },
  { slug: "av-crew-contractors-activities", route: "/rentals/crew", title: "Vident AV: Crew, Contractors and Activities", file: "av-crew-contractors-activities.mp4", guideSlug: "vident-av", audience: "vident-av", alsoRoutes: ["/rentals/contractors", "/rentals/activities"] },
  { slug: "av-catalog-customers-venues-suppliers", route: "/rentals/catalog", title: "Vident AV: Catalog, Customers, Venues and Suppliers", file: "av-catalog-customers-venues-suppliers.mp4", guideSlug: "vident-av", audience: "vident-av", alsoRoutes: ["/rentals/customers", "/rentals/venues", "/rentals/suppliers"] },
  { slug: "meetings", route: "/meetings", title: "Meetings", file: "meetings.mp4", guideSlug: "meetings", audience: "lead" },
  { slug: "google-drive", route: "/drive", title: "Google Drive", file: "google-drive.mp4", guideSlug: "google-drive", audience: "lead" },
  { slug: "onboarding", route: "/onboarding", title: "Onboarding", file: "onboarding.mp4", guideSlug: "onboarding", audience: "lead" },
  { slug: "sms-portal", route: "/sms", title: "SMS Portal", file: "sms-portal.mp4", guideSlug: "sms-portal", audience: "admin" },
  { slug: "communications", route: "/communications", title: "Communications", file: "communications.mp4", guideSlug: "communications", audience: "admin" },
  { slug: "venue-quotes", route: "/venue-quotes", title: "Venue Quotes", file: "venue-quotes.mp4", guideSlug: "venue-quotes", audience: "admin" },
  { slug: "inquiry-forms", route: "/inquiry-forms", title: "Inquiry Forms", file: "inquiry-forms.mp4", guideSlug: "inquiry-forms", audience: "admin" },
  { slug: "hiring", route: "/hiring", title: "Hiring", file: "hiring.mp4", guideSlug: "hiring", audience: "admin" },
  { slug: "image-studio", route: "/image-studio", title: "Image Studio", file: "image-studio.mp4", guideSlug: "image-studio", audience: "admin" },
  { slug: "reports", route: "/reports", title: "Reports", file: "reports.mp4", guideSlug: "reports", audience: "admin" },
  { slug: "hub-health", route: "/hub-health", title: "Hub Health", file: "hub-health.mp4", guideSlug: "hub-health", audience: "admin" },
  { slug: "page-map", route: "/page-map", title: "Page Map", file: "page-map.mp4", guideSlug: "page-map-and-view-as-staff", audience: "admin" },
  { slug: "hub-switcher", route: "/hub-switcher", title: "Hub Switcher", file: "hub-switcher.mp4", guideSlug: "hub-switcher", audience: "admin" },
  {
    slug: "event-checklist",
    route: "/event-checklist",
    title: "Event gear checklist",
    file: "event-checklist.mp4",
    guideSlug: "event-gear-checklist",
    audience: "all",
    v: "2",
  },
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
