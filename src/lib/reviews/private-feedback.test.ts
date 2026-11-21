import { describe, expect, it } from "vitest";
import {
  isAllowedFeedbackOrigin,
  parsePrivateFeedback,
} from "./private-feedback";

describe("parsePrivateFeedback", () => {
  it("accepts a full submission and trims it", () => {
    const result = parsePrivateFeedback({
      fullName: "  Sample Client ",
      email: " Sample@Example.com ",
      improveAreas: " Music was loud ",
      teamHandled: "",
      rating: 2,
    });
    expect(result).toEqual({
      ok: true,
      spam: false,
      value: {
        fullName: "Sample Client",
        email: "sample@example.com",
        improveAreas: "Music was loud",
        teamHandled: "",
        rating: 2,
      },
    });
  });

  it("requires a valid email, and only the email", () => {
    expect(parsePrivateFeedback({ fullName: "A" })).toEqual({
      ok: false,
      error: "Please enter your email.",
    });
    expect(parsePrivateFeedback({ email: "not-an-email" })).toEqual({
      ok: false,
      error: "Please enter a valid email address.",
    });
    expect(parsePrivateFeedback({ email: "a@b.co" }).ok).toBe(true);
  });

  it("drops a rating that is not 1 to 5", () => {
    const result = parsePrivateFeedback({ email: "a@b.co", rating: "9" });
    expect(result.ok && result.value.rating).toBe(null);
    const ok = parsePrivateFeedback({ email: "a@b.co", rating: "3" });
    expect(ok.ok && ok.value.rating).toBe(3);
  });

  it("rejects answers that are too long and non-object bodies", () => {
    expect(
      parsePrivateFeedback({ email: "a@b.co", improveAreas: "x".repeat(4001) }).ok,
    ).toBe(false);
    expect(parsePrivateFeedback(null).ok).toBe(false);
    expect(parsePrivateFeedback([]).ok).toBe(false);
  });

  it("flags the hidden field as spam", () => {
    const result = parsePrivateFeedback({ email: "a@b.co", website: "http://x" });
    expect(result.ok && result.spam).toBe(true);
  });
});

describe("isAllowedFeedbackOrigin", () => {
  it("allows the review site and its Vercel addresses only", () => {
    expect(isAllowedFeedbackOrigin("https://review.lreproductions.com")).toBe(true);
    expect(isAllowedFeedbackOrigin("https://lre-review-site.vercel.app")).toBe(true);
    expect(isAllowedFeedbackOrigin("https://lre-review-site-git-main-davidhanscom.vercel.app")).toBe(true);
    expect(isAllowedFeedbackOrigin("https://evil.example.com")).toBe(false);
    expect(isAllowedFeedbackOrigin("https://review.lreproductions.com.evil.com")).toBe(false);
    expect(isAllowedFeedbackOrigin("https://lre-review-site.vercel.app.evil.com")).toBe(false);
    expect(isAllowedFeedbackOrigin(null)).toBe(false);
  });
});
