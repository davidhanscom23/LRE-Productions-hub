import { describe, expect, it } from "vitest";
import {
  APPLY_FEATURED_TRACKS,
  APPLY_TRACKS,
  getApplyTrack,
  isApplyTrackSlug,
} from "@/lib/hiring/apply-tracks";

describe("apply tracks", () => {
  it("exposes three featured department tracks plus general", () => {
    expect(APPLY_FEATURED_TRACKS.map((t) => t.slug)).toEqual([
      "av",
      "corporate",
      "wedding",
      "golf",
    ]);
    expect(APPLY_TRACKS.general.questions).toHaveLength(0);
  });

  it("gives each featured track unique question ids and 4 options", () => {
    for (const track of APPLY_FEATURED_TRACKS) {
      expect(track.questions.length).toBeGreaterThanOrEqual(8);
      const ids = new Set(track.questions.map((q) => q.id));
      expect(ids.size).toBe(track.questions.length);
      for (const q of track.questions) {
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options.map((o) => o.id)).size).toBe(4);
      }
    }
  });

  it("resolves slugs", () => {
    expect(isApplyTrackSlug("av")).toBe(true);
    expect(isApplyTrackSlug("dj")).toBe(false);
    expect(getApplyTrack("wedding")?.roleInterest).toBe("Wedding & Social");
  });
});
