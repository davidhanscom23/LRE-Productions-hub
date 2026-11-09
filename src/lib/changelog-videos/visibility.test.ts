import { describe, expect, it } from "vitest";
import {
  audienceLabel,
  canSeeChangelogVideo,
  monthKey,
  newHireCutoff,
} from "@/lib/changelog-videos/visibility";

const live = { status: "live", period_end: "2026-10-31", audience: "all" } as const;
const old = { status: "live", period_end: "2026-08-10", audience: "all" } as const;
const hidden = { status: "superseded", period_end: "2026-10-31", audience: "all" } as const;
const av = { status: "live", period_end: "2026-10-31", audience: "vident-av" } as const;

const lead = { status: "live", period_end: "2026-11-05", audience: "lead" } as const;

const staff = { role: "staff", departments: [] } as never;
const avStaff = { role: "staff", departments: ["Audiovisual"] } as never;
const leadStaff = { role: "trainer", departments: [] } as never;
const admin = { role: "admin", departments: [] } as never;

describe("changelog video visibility", () => {
  it("shows live videos to staff", () => {
    expect(canSeeChangelogVideo(live, staff)).toBe(true);
  });

  it("hides superseded videos from staff but not admins", () => {
    expect(canSeeChangelogVideo(hidden, staff)).toBe(false);
    expect(canSeeChangelogVideo(hidden, admin)).toBe(true);
  });

  it("limits a new hire to videos from 60 days before their start date", () => {
    expect(newHireCutoff("2026-10-15")).toBe("2026-08-16");
    const newHire = { role: "staff", departments: [], start_date: "2026-10-15" } as never;
    expect(canSeeChangelogVideo(old, newHire)).toBe(false);
    expect(canSeeChangelogVideo(live, newHire)).toBe(true);
  });

  it("shows everything live when there is no start date", () => {
    expect(canSeeChangelogVideo(old, staff)).toBe(true);
  });

  it("limits AV videos to admins and the Audiovisual department", () => {
    expect(canSeeChangelogVideo(av, staff)).toBe(false);
    expect(canSeeChangelogVideo(av, avStaff)).toBe(true);
    expect(canSeeChangelogVideo(av, admin)).toBe(true);
  });

  it("limits Lead videos to admins and Leads", () => {
    expect(canSeeChangelogVideo(lead, staff)).toBe(false);
    expect(canSeeChangelogVideo(lead, leadStaff)).toBe(true);
    expect(canSeeChangelogVideo(lead, admin)).toBe(true);
  });

  it("labels limited videos", () => {
    expect(audienceLabel("all")).toBeNull();
    expect(audienceLabel("lead")).toBe("Leads");
    expect(audienceLabel("vident-av")).toBe("AV team");
  });

  it("shows nothing when nobody is signed in", () => {
    expect(canSeeChangelogVideo(live, null)).toBe(false);
  });

  it("builds a month key", () => {
    expect(monthKey("2026-10-31")).toBe("2026-10");
  });
});
