import { describe, expect, it } from "vitest";
import {
  HOW_TO_VIDEOS,
  canWatchHowTo,
  filterHowToLessons,
  howToVideoForPath,
  howToVideoSrc,
  type HowToVideo,
} from "@/lib/how-to/videos";

const staff = { role: "staff", departments: [] } as never;
const avStaff = { role: "staff", departments: ["Audiovisual"] } as never;
const guest = { role: "guest", departments: [] } as never;
const avVideo: HowToVideo = {
  slug: "x",
  route: "/av-show",
  title: "AV",
  file: "x.mp4",
  guideSlug: "x",
  audience: "vident-av",
};

describe("how-to registry", () => {
  it("matches a module page and its sub-pages for staff", () => {
    expect(howToVideoForPath("/event-packets", staff)?.slug).toBe("event-packets");
    expect(howToVideoForPath("/event-packets/abc", staff)?.slug).toBe("event-packets");
    expect(howToVideoForPath("/event-packets-other", staff)).toBeNull();
  });
  it("never shows videos to guests", () => {
    expect(howToVideoForPath("/event-packets", guest)).toBeNull();
  });
  it("limits department pages to people who can open them", () => {
    expect(canWatchHowTo(avVideo, staff)).toBe(false);
    expect(canWatchHowTo(avVideo, avStaff)).toBe(true);
  });
  it("shows admin videos to admins only", () => {
    const admin = { role: "admin", departments: [] } as never;
    const trainer = { role: "trainer", departments: [] } as never;
    expect(howToVideoForPath("/hiring", admin)?.slug).toBe("hiring");
    expect(howToVideoForPath("/hiring", trainer)).toBeNull();
    expect(howToVideoForPath("/hiring", staff)).toBeNull();
    const adminOnly = HOW_TO_VIDEOS.filter((v) => v.audience === "admin");
    const lessons = adminOnly.map((v) => ({ resource_href: howToVideoSrc(v) }));
    expect(filterHowToLessons(lessons, staff)).toHaveLength(0);
    expect(filterHowToLessons(lessons, admin)).toHaveLength(adminOnly.length);
  });
  it("matches alsoRoutes and prefers the longest route", () => {
    expect(howToVideoForPath("/rentals/reports", avStaff)?.slug).toBe("av-costs-reports");
    expect(howToVideoForPath("/rentals/travel/x", avStaff)?.slug).toBe("av-calendar-planner-travel");
    expect(howToVideoForPath("/rentals/stock", avStaff)?.slug).toBe("vident-av");
  });
  it("every entry has a unique route and file", () => {
    const routes = new Set(HOW_TO_VIDEOS.map((v) => v.route));
    const files = new Set(HOW_TO_VIDEOS.map((v) => v.file));
    expect(routes.size).toBe(HOW_TO_VIDEOS.length);
    expect(files.size).toBe(HOW_TO_VIDEOS.length);
  });
  it("filters course lessons by registry audience", () => {
    const lessons = HOW_TO_VIDEOS.map((v) => ({ resource_href: howToVideoSrc(v) }));
    expect(filterHowToLessons(lessons, staff).length).toBeGreaterThan(0);
    expect(filterHowToLessons([{ resource_href: "https://x/y.mp4" }], staff)).toHaveLength(0);
  });
});
