import { describe, expect, it } from "vitest";
import {
  DATE_LOADING_MESSAGES,
  DEFAULT_BUSINESS_SETTINGS,
  DEFAULT_FORM_SETTINGS,
  LOCATION_LOADING_MESSAGES,
  URGENCY_PRESETS,
  mergeBusinessSettings,
  mergeFormSettings,
} from "./defaults";

/** Em dash, en dash, narrow no-break space, double hyphen: built from code points so this file holds none of them. */
const BANNED_COPY_CHARS = [0x2014, 0x2013, 0x202f].map((cp) => String.fromCharCode(cp)).concat("-".repeat(2));

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) strings(v, out);
  return out;
}

describe("DEFAULT_FORM_SETTINGS (LeadGate tuned values)", () => {
  it("uses the tuned timings and the celebration copy", () => {
    expect(DEFAULT_FORM_SETTINGS.qualify.timings).toEqual({ messageIntervalMs: 3000, minCheckMs: 4000, preCelebrationMs: 2000, popupMs: 5500 });
    expect(DEFAULT_FORM_SETTINGS.qualify.popupTitle).toBe("YOUR SEARCH IS OVER!");
    expect(DEFAULT_FORM_SETTINGS.qualify.popupSubtitle).toBe("WE ARE AVAILABLE");
    expect(DEFAULT_FORM_SETTINGS.qualify.celebrate).toBe(true);
    expect(DEFAULT_FORM_SETTINGS.qualify.urgency).toBeNull();
  });

  it("ships 10 date and 10 location loading messages and 5 urgency presets", () => {
    expect(DATE_LOADING_MESSAGES).toHaveLength(10);
    expect(LOCATION_LOADING_MESSAGES).toHaveLength(10);
    expect(URGENCY_PRESETS).toHaveLength(5);
    expect(DATE_LOADING_MESSAGES[0]).toBe("Crossing fingers that your date is available...");
    expect(LOCATION_LOADING_MESSAGES[0]).toBe("Now checking if we can get there...");
    expect(URGENCY_PRESETS[3]).toBe("Good news: your date is open! But popular dates don't last long. Secure yours now.");
    expect(DEFAULT_FORM_SETTINGS.qualify.dateLoadingMessages).toEqual(DATE_LOADING_MESSAGES);
    expect(DEFAULT_FORM_SETTINGS.qualify.locationLoadingMessages).toEqual(LOCATION_LOADING_MESSAGES);
  });

  it("is safe by default: no confirmation email, no staff email, no host pixel, no redirect", () => {
    expect(DEFAULT_FORM_SETTINGS.confirmationEmail.enabled).toBe(false);
    expect(DEFAULT_FORM_SETTINGS.notify).toEqual({ recipients: [], inApp: true });
    expect(DEFAULT_FORM_SETTINGS.hostEvent).toBe(false);
    expect(DEFAULT_FORM_SETTINGS.redirectUrl).toBeNull();
    expect(DEFAULT_FORM_SETTINGS.referral).toBeNull();
  });

  it("never strands a visitor on a busy date and never promises dates it does not list (LeadGate bug B17)", () => {
    expect(DEFAULT_FORM_SETTINGS.onDateUnavailable.actions).toEqual(["change_date", "continue"]);
    expect(DEFAULT_FORM_SETTINGS.onDateUnavailable.message).not.toMatch(/nearby|options that are available/i);
    expect(DEFAULT_FORM_SETTINGS.onLocationFail.action).toBe("continue");
  });
});

describe("DEFAULT_BUSINESS_SETTINGS (generic and conservative)", () => {
  it("has the conservative defaults", () => {
    const b = DEFAULT_BUSINESS_SETTINGS;
    expect(b.timezone).toBe("America/New_York");
    expect(b.location.enabled).toBe(false);
    expect(b.location.zones.maxMiles).toBeNull();
    expect(b.availability.mode).toBe("open");
    expect(b.availability.capacity.source).toBe("none");
    expect(b.availability.blackouts).toEqual([]);
    expect(b.availability.minNoticeDays).toBeNull();
    expect(b.abandonment).toEqual({ alertStaff: true, delayMinutes: 10 });
    expect(b.spam).toEqual({ turnstile: false, maxCompletesPerEmailPerDay: 3, maxStartsPerIpPerHour: 20 });
    expect(b.emojiPrefix).toBeNull();
  });

  it("has an honest message for every verdict", () => {
    const m = DEFAULT_BUSINESS_SETTINGS.availability.messages;
    for (const key of ["available", "open", "limited", "unavailable", "unknown", "tooSoon", "blackout"] as const) {
      expect(m[key].length, key).toBeGreaterThan(10);
    }
    for (const key of ["pass", "risky", "talk", "fail", "unverified"] as const) {
      expect(DEFAULT_BUSINESS_SETTINGS.location.messages[key].length, key).toBeGreaterThan(10);
    }
    expect(m.open).toMatch(/confirm/i);
  });
});

describe("copy hygiene in every default string", () => {
  const all = [
    ...strings(DEFAULT_FORM_SETTINGS),
    ...strings(DEFAULT_BUSINESS_SETTINGS),
    ...URGENCY_PRESETS,
    ...DATE_LOADING_MESSAGES,
    ...LOCATION_LOADING_MESSAGES,
  ];

  it("has no em dashes, en dashes, double dashes or narrow no-break spaces", () => {
    expect(all.length).toBeGreaterThan(40);
    for (const s of all) {
      for (const b of BANNED_COPY_CHARS) expect(s.includes(b), `${s} contains a banned character`).toBe(false);
    }
  });

  it("the hygiene check can fail (planted bad strings)", () => {
    const planted = [`Booked ${String.fromCharCode(0x2014)} see you`, `9${String.fromCharCode(0x2013)}5`, `a${"-".repeat(2)}b`];
    for (const p of planted) expect(BANNED_COPY_CHARS.some((b) => p.includes(b)), p).toBe(true);
  });

  it("uses US spelling and never guarantees a booking", () => {
    for (const s of all) {
      expect(s, s).not.toMatch(/colour|favour|organis|practis|centre|licence|cancelled|guarantee/i);
    }
  });
});

describe("frozen defaults", () => {
  it("cannot be mutated by accident", () => {
    expect(Object.isFrozen(DEFAULT_FORM_SETTINGS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_FORM_SETTINGS.qualify.dateLoadingMessages)).toBe(true);
    expect(Object.isFrozen(DEFAULT_BUSINESS_SETTINGS.availability.messages)).toBe(true);
    expect(Object.isFrozen(URGENCY_PRESETS)).toBe(true);
    expect(() => {
      (DEFAULT_FORM_SETTINGS.notify.recipients as string[]).push("x@y.co");
    }).toThrow(TypeError);
  });
});

describe("mergeFormSettings", () => {
  it("returns a full, mutable copy of the defaults for empty or junk input", () => {
    for (const input of [undefined, null, {}, [], "not json", 42]) {
      const s = mergeFormSettings(input);
      expect(s).toEqual(JSON.parse(JSON.stringify(DEFAULT_FORM_SETTINGS)));
      expect(s.qualify.dateLoadingMessages).not.toBe(DEFAULT_FORM_SETTINGS.qualify.dateLoadingMessages);
      s.notify.recipients.push("ok@example.com");
      expect(DEFAULT_FORM_SETTINGS.notify.recipients).toEqual([]);
    }
  });

  it("accepts JSON text", () => {
    expect(mergeFormSettings(JSON.stringify({ submitLabel: "Get a Quote" })).submitLabel).toBe("Get a Quote");
  });

  it("deep-merges partial objects and drops unknown keys", () => {
    const s = mergeFormSettings({
      brand: "partner-brand",
      qualify: { celebrate: false, sparkle: true, timings: { popupMs: 3000 } },
      thankYou: { title: "Inquiry sent!" },
      vendor_id: "abc",
    });
    expect(s.brand).toBe("partner-brand");
    expect(s.qualify.celebrate).toBe(false);
    expect(s.qualify.timings).toEqual({ messageIntervalMs: 3000, minCheckMs: 4000, preCelebrationMs: 2000, popupMs: 3000 });
    expect(s.qualify.popupTitle).toBe("YOUR SEARCH IS OVER!");
    expect(s.thankYou).toEqual({ title: "Inquiry sent!", message: DEFAULT_FORM_SETTINGS.thankYou.message });
    expect((s as unknown as Record<string, unknown>).vendor_id).toBeUndefined();
    expect((s.qualify as unknown as Record<string, unknown>).sparkle).toBeUndefined();
  });

  it("coerces wrong types and out-of-range numbers back to safe values", () => {
    const s = mergeFormSettings({
      accentColor: "red; background: url(https://evil.example)",
      submitLabel: "   ",
      qualify: { celebrate: "yes", timings: { messageIntervalMs: "fast", minCheckMs: 999999, preCelebrationMs: -50, popupMs: "4000" } },
      hostEvent: "true",
    });
    expect(s.accentColor).toBe(DEFAULT_FORM_SETTINGS.accentColor);
    expect(s.submitLabel).toBe("Send my request");
    expect(s.qualify.celebrate).toBe(true);
    expect(s.qualify.timings).toEqual({ messageIntervalMs: 3000, minCheckMs: 20000, preCelebrationMs: 0, popupMs: 4000 });
    expect(s.hostEvent).toBe(false);
    expect(mergeFormSettings({ accentColor: "#AE4213" }).accentColor).toBe("#ae4213");
    expect(mergeFormSettings({ accentColor: "#abc" }).accentColor).toBe("#aabbcc");
  });

  it("only keeps http(s) redirect and referral URLs", () => {
    expect(mergeFormSettings({ redirectUrl: "javascript:alert(1)" }).redirectUrl).toBeNull();
    expect(mergeFormSettings({ redirectUrl: "/thanks" }).redirectUrl).toBeNull();
    expect(mergeFormSettings({ redirectUrl: "https://example.com/thank-you" }).redirectUrl).toBe("https://example.com/thank-you");
    const referral = mergeFormSettings({
      onLocationFail: { action: "referral" },
      referral: {
        title: "Friends we trust",
        links: [
          { label: "Bad", url: "javascript:alert(1)" },
          { label: "Good DJ", url: "https://example.com" },
          { label: "", url: "https://example.org" },
        ],
      },
    });
    expect(referral.onLocationFail.action).toBe("referral");
    expect(referral.referral).toEqual({
      title: "Friends we trust",
      message: "Here are a few trusted partners who may be able to help.",
      links: [{ label: "Good DJ", url: "https://example.com/" }],
    });
    expect(mergeFormSettings({ referral: { title: "Empty", links: [] } }).referral).toBeNull();
  });

  it("filters and dedupes unavailable-date actions; empty falls back to the defaults", () => {
    expect(mergeFormSettings({ onDateUnavailable: { actions: ["waitlist", "waitlist", "beg", "continue"] } }).onDateUnavailable.actions).toEqual([
      "waitlist",
      "continue",
    ]);
    expect(mergeFormSettings({ onDateUnavailable: { actions: [] } }).onDateUnavailable.actions).toEqual(["change_date", "continue"]);
    expect(mergeFormSettings({ onLocationFail: { action: "hide" } }).onLocationFail.action).toBe("continue");
  });

  it("handles urgency, recipients, hype lines, headline and blank copy", () => {
    expect(mergeFormSettings({ qualify: { urgency: URGENCY_PRESETS[3] } }).qualify.urgency).toBe(URGENCY_PRESETS[3]);
    expect(mergeFormSettings({ qualify: { urgency: "  " } }).qualify.urgency).toBeNull();
    expect(mergeFormSettings({ qualify: { urgency: 4 } }).qualify.urgency).toBeNull();
    expect(mergeFormSettings({ qualify: { popupSubtitle: "" } }).qualify.popupSubtitle).toBe("");
    expect(mergeFormSettings({ qualify: { dateLoadingMessages: ["", 5] } }).qualify.dateLoadingMessages).toEqual(DATE_LOADING_MESSAGES);
    expect(mergeFormSettings({ notify: { recipients: ["Events@example.com", "nope", "events@example.com"], inApp: false } }).notify).toEqual({
      recipients: ["events@example.com"],
      inApp: false,
    });
    expect(mergeFormSettings({ progressHype: ["Getting warmed up...", "Hype is building!"] }).progressHype).toEqual(["Getting warmed up...", "Hype is building!"]);
    expect(mergeFormSettings({ progressHype: "MAX HYPE" }).progressHype).toBeNull();
    expect(mergeFormSettings({ headline: "  Check your date  " }).headline).toBe("Check your date");
    expect("headline" in mergeFormSettings({})).toBe(false);
    expect(mergeFormSettings({ confirmationEmail: { enabled: true } }).confirmationEmail).toEqual({ ...DEFAULT_FORM_SETTINGS.confirmationEmail, enabled: true });
  });
});

describe("mergeBusinessSettings", () => {
  it("returns a mutable copy of the defaults for junk input and pins the time zone", () => {
    for (const input of [undefined, null, [], "x", { timezone: "UTC" }]) {
      const b = mergeBusinessSettings(input);
      expect(b).toEqual(JSON.parse(JSON.stringify(DEFAULT_BUSINESS_SETTINGS)));
      expect(b.timezone).toBe("America/New_York");
    }
    const b = mergeBusinessSettings({});
    b.availability.blackouts.push({ start: "2026-12-25", end: "2026-12-25" });
    expect(DEFAULT_BUSINESS_SETTINGS.availability.blackouts).toEqual([]);
  });

  it("keeps the Y? setup", () => {
    const b = mergeBusinessSettings({
      homeBase: { label: "Ponte Vedra office", address: "101 Marketside Avenue, Ponte Vedra, FL 32081", lat: 30.24, lng: "-81.3853" },
      location: { enabled: true, zones: { passMiles: 60, riskyMiles: 90, talkMiles: 150, maxMiles: null }, roadFactor: 1.2 },
      availability: { mode: "bookings", capacity: { source: "staff", departments: ["DJ", " DJ ", ""] } },
    });
    expect(b.homeBase).toEqual({ label: "Ponte Vedra office", address: "101 Marketside Avenue, Ponte Vedra, FL 32081", lat: 30.24, lng: -81.3853 });
    expect(b.location.enabled).toBe(true);
    expect(b.location.zones).toEqual({ passMiles: 60, riskyMiles: 90, talkMiles: 150, maxMiles: null });
    expect(b.availability.mode).toBe("bookings");
    expect(b.availability.capacity).toEqual({ source: "staff", departments: ["DJ"], fixed: null });
  });

  it("coerces numbers, enums and coordinates", () => {
    const b = mergeBusinessSettings({
      homeBase: { lat: 200, lng: "east" },
      location: { zones: { passMiles: "far", maxMiles: "" }, roadFactor: 9 },
      availability: { mode: "always", capacity: { source: "calendar", fixed: 3.6 }, minNoticeDays: -2 },
      abandonment: { alertStaff: "no", delayMinutes: 1 },
      spam: { maxCompletesPerEmailPerDay: 0, maxStartsPerIpPerHour: 1e9 },
    });
    expect(b.homeBase.lat).toBeNull();
    expect(b.homeBase.lng).toBeNull();
    expect(b.location.zones.passMiles).toBe(50);
    expect(b.location.zones.maxMiles).toBeNull();
    expect(b.location.roadFactor).toBe(3);
    expect(b.availability.mode).toBe("open");
    expect(b.availability.capacity.source).toBe("none");
    expect(b.availability.capacity.fixed).toBe(4);
    expect(b.availability.minNoticeDays).toBe(0);
    expect(b.abandonment).toEqual({ alertStaff: true, delayMinutes: 5 });
    expect(b.spam).toEqual({ turnstile: false, maxCompletesPerEmailPerDay: 1, maxStartsPerIpPerHour: 1000 });
    expect(mergeBusinessSettings({ availability: { minNoticeDays: null } }).availability.minNoticeDays).toBeNull();
    expect(mergeBusinessSettings({ availability: { minNoticeDays: 3.4 } }).availability.minNoticeDays).toBe(3);
    expect(mergeBusinessSettings({ location: { zones: { maxMiles: 150 } } }).location.zones.maxMiles).toBe(150);
  });

  it("keeps only real blackout ranges", () => {
    const b = mergeBusinessSettings({
      availability: {
        blackouts: [
          { start: "2026-12-25", label: "  Christmas  " },
          { start: "2027-01-05", end: "2027-01-01" },
          { start: "2026-02-30", end: "2026-03-01" },
          { start: "soon" },
          "2026-07-04",
          { start: "2026-07-04", end: "2026-07-05", label: 7 },
        ],
      },
    });
    expect(b.availability.blackouts).toEqual([
      { start: "2026-12-25", end: "2026-12-25", label: "Christmas" },
      { start: "2027-01-01", end: "2027-01-05" },
      { start: "2026-07-04", end: "2026-07-05" },
    ]);
  });

  it("keeps an emoji prefix of up to 8 symbols, blank means none", () => {
    expect(mergeBusinessSettings({ emojiPrefix: "🎵🎵🎵" }).emojiPrefix).toBe("🎵🎵🎵");
    expect(mergeBusinessSettings({ emojiPrefix: "   " }).emojiPrefix).toBeNull();
    expect(Array.from(mergeBusinessSettings({ emojiPrefix: "🎵".repeat(12) }).emojiPrefix ?? "")).toHaveLength(8);
  });

  it("keeps blank-but-required messages at their defaults", () => {
    const b = mergeBusinessSettings({ availability: { messages: { open: "", available: "We have openings!" } } });
    expect(b.availability.messages.open).toBe(DEFAULT_BUSINESS_SETTINGS.availability.messages.open);
    expect(b.availability.messages.available).toBe("We have openings!");
  });
});
