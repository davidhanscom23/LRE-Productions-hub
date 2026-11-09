import { describe, expect, it } from "vitest";
import {
  capUserAgent,
  clientIpFrom,
  easternDayWindowStart,
  halfHourWindowStart,
  hourWindowStart,
  overLimit,
  RATE_KEYS,
  readTurnstileResult,
  sanitizeAttribution,
  startSignalsSpamReason,
  countsTowardEmailLimit,
  MAX_CONFIRMATIONS_PER_IP_PER_DAY,
  startHardCapped,
  turnstileDecision,
  turnstileEnabled,
} from "./spam-core";

describe("start spam signals", () => {
  it("flags a filled honeypot", () => {
    expect(startSignalsSpamReason({ hp: "http://spam.example", elapsedMs: 9000 })).toBe("honeypot");
    expect(startSignalsSpamReason({ hp: 1, elapsedMs: 9000 })).toBe("honeypot");
  });

  it("flags instant posts and missing timings", () => {
    expect(startSignalsSpamReason({ hp: "", elapsedMs: 2499 })).toBe("too_fast");
    expect(startSignalsSpamReason({ hp: "", elapsedMs: undefined })).toBe("too_fast");
    expect(startSignalsSpamReason({ hp: "", elapsedMs: Number.NaN })).toBe("too_fast");
  });

  it("passes a normal human", () => {
    expect(startSignalsSpamReason({ hp: "", elapsedMs: 2500 })).toBeNull();
    expect(startSignalsSpamReason({ hp: undefined, elapsedMs: 45000 })).toBeNull();
    expect(startSignalsSpamReason({ hp: "   ", elapsedMs: 45000 })).toBeNull();
  });

  it("only calls a count over the limit spam, and never when the counter failed", () => {
    expect(overLimit(20, 20)).toBe(false);
    expect(overLimit(21, 20)).toBe(true);
    expect(overLimit(null, 20)).toBe(false);
    expect(overLimit(500, 0)).toBe(false);
  });
});

describe("fixed windows", () => {
  it("floors to the hour and half hour", () => {
    const now = new Date("2026-11-04T15:47:12.345Z");
    expect(hourWindowStart(now)).toBe("2026-11-04T15:00:00.000Z");
    expect(halfHourWindowStart(now)).toBe("2026-11-04T15:30:00.000Z");
    expect(halfHourWindowStart(new Date("2026-11-04T15:29:59.999Z"))).toBe("2026-11-04T15:00:00.000Z");
  });

  it("finds New York midnight in winter (EST, UTC-5) and summer (EDT, UTC-4)", () => {
    expect(easternDayWindowStart(new Date("2026-12-10T15:00:00Z"))).toBe("2026-12-10T05:00:00.000Z");
    expect(easternDayWindowStart(new Date("2026-07-10T15:00:00Z"))).toBe("2026-07-10T04:00:00.000Z");
  });

  it("uses the New York day, not the UTC day, late in the evening", () => {
    // 11:30 PM EST on Dec 10 is already Dec 11 in UTC.
    expect(easternDayWindowStart(new Date("2026-12-11T04:30:00Z"))).toBe("2026-12-10T05:00:00.000Z");
  });

  it("handles the DST switch days", () => {
    // 2026-03-08: clocks spring forward at 2 AM; midnight was still EST.
    expect(easternDayWindowStart(new Date("2026-03-08T18:00:00Z"))).toBe("2026-03-08T05:00:00.000Z");
    // 2026-11-01: clocks fall back at 2 AM; midnight was still EDT.
    expect(easternDayWindowStart(new Date("2026-11-01T18:00:00Z"))).toBe("2026-11-01T04:00:00.000Z");
  });

  it("builds distinct rate keys per purpose", () => {
    expect(RATE_KEYS.starts("abc")).toBe("start:abc");
    expect(RATE_KEYS.starts(null)).toBe("start:no-ip");
    expect(RATE_KEYS.view("form-1", "abc")).toBe("view:form-1:abc");
    expect(RATE_KEYS.completes("e1")).toBe("complete:e1");
  });
});

describe("request metadata", () => {
  it("keeps only known attribution keys, strings only, capped at 500", () => {
    const out = sanitizeAttribution({
      utm_source: " google ",
      utm_medium: "cpc",
      gclid: "x".repeat(900),
      page_url: "https://example.com/contact?utm_source=google",
      evil: "drop me",
      referrer: 42,
      landing_url: "line1\nline2",
      utm_term: "   ",
    });
    expect(out).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      gclid: "x".repeat(500),
      page_url: "https://example.com/contact?utm_source=google",
      landing_url: "line1line2",
    });
    expect(sanitizeAttribution(null)).toEqual({});
    expect(sanitizeAttribution(["utm_source"])).toEqual({});
  });

  it("reads the first forwarded IP", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIpFrom(new Headers())).toBeNull();
  });

  it("caps the user agent at 300 characters", () => {
    expect(capUserAgent("a".repeat(400))).toHaveLength(300);
    expect(capUserAgent("")).toBeNull();
    expect(capUserAgent(null)).toBeNull();
  });
});

describe("turnstile", () => {
  const on = { spam: { turnstile: true, maxCompletesPerEmailPerDay: 3, maxStartsPerIpPerHour: 20 } };
  const off = { spam: { turnstile: false, maxCompletesPerEmailPerDay: 3, maxStartsPerIpPerHour: 20 } };

  it("is on only with both keys and the toggle", () => {
    const keys = { TURNSTILE_SECRET_KEY: "s", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k" };
    expect(turnstileEnabled(keys, on)).toBe(true);
    expect(turnstileEnabled(keys, off)).toBe(false);
    expect(turnstileEnabled({ TURNSTILE_SECRET_KEY: "s" }, on)).toBe(false);
    expect(turnstileEnabled({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k" }, on)).toBe(false);
  });

  it("reads siteverify results without blaming the visitor for our errors", () => {
    expect(readTurnstileResult({ success: true })).toBe("pass");
    expect(readTurnstileResult({ success: false, "error-codes": ["invalid-input-response"] })).toBe("fail");
    expect(readTurnstileResult({ success: false, "error-codes": ["timeout-or-duplicate"] })).toBe("fail");
    expect(readTurnstileResult({ success: false, "error-codes": ["invalid-input-secret"] })).toBe("error");
    expect(readTurnstileResult({ success: false, "error-codes": ["internal-error"] })).toBe("error");
    expect(readTurnstileResult(null)).toBe("error");
  });
});

describe("hard cap on stored starts", () => {
  it("stops inserting past 3x the per-IP limit (the limit itself only labels rows spam)", () => {
    expect(startHardCapped(60, 20)).toBe(false);
    expect(startHardCapped(61, 20)).toBe(true);
    expect(startHardCapped(null, 20)).toBe(false);
    expect(startHardCapped(5000, 0)).toBe(false);
  });
});

describe("Turnstile decision", () => {
  it("never turns a missing token into silent spam: the visitor is asked to retry", () => {
    expect(turnstileDecision("missing")).toEqual({ action: "retry" });
    expect(turnstileDecision("fail")).toEqual({ action: "spam", reason: "turnstile_failed" });
    expect(turnstileDecision("error")).toEqual({ action: "accept_logged" });
    expect(turnstileDecision("pass")).toEqual({ action: "accept" });
  });
});

describe("completes per email", () => {
  it("counts each submission once, so retries of one inquiry never reach the limit", () => {
    expect(RATE_KEYS.completeOnce("s1")).toBe("complete-once:s1");
    expect(countsTowardEmailLimit(1)).toBe(true);
    expect(countsTowardEmailLimit(2)).toBe(false);
    expect(countsTowardEmailLimit(9)).toBe(false);
    // Counter trouble: count it (the email limit itself fails open on a null count).
    expect(countsTowardEmailLimit(null)).toBe(true);
  });
});

describe("geocode budgets", () => {
  it("keys a global and a per-IP hourly budget", () => {
    expect(RATE_KEYS.geocodeAll()).toBe("geocode:all");
    expect(RATE_KEYS.geocodeIp("abc")).toBe("geocode:ip:abc");
    expect(RATE_KEYS.geocodeIp(null)).toBe("geocode:ip:no-ip");
    expect(RATE_KEYS.confirmations("abc")).toBe("confirm:abc");
    expect(MAX_CONFIRMATIONS_PER_IP_PER_DAY).toBe(5);
  });
});
