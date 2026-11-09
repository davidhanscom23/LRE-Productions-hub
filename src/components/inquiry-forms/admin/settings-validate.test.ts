import { describe, expect, it } from "vitest";
import type { BusinessSettings, FormSettings } from "@/lib/inquiry-forms/types";
import { issuesByPath, validateBusinessSettings, validateFormSettings } from "./settings-validate";

const DEPARTMENTS = ["DJ", "Photobooth", "AV", "Office", "Partner Brand"] as const;

function business(): BusinessSettings {
  return {
    timezone: "America/New_York",
    homeBase: { label: " Office ", address: "101 Marketside Avenue, Ponte Vedra, FL 32081", lat: 30.24, lng: -81.3853 },
    location: {
      enabled: true,
      zones: { passMiles: 60, riskyMiles: 90, talkMiles: 250, maxMiles: null },
      roadFactor: 1.2,
      messages: {
        pass: "Great news, you are in our area.",
        risky: "You are a bit farther out; a travel fee applies.",
        talk: "That is a trip for us. Let's talk travel.",
        fail: "That is outside our travel area.",
        unverified: "We could not find that spot on the map. We will confirm by hand.",
      },
    },
    availability: {
      mode: "bookings",
      capacity: { source: "staff", departments: ["DJ"], fixed: null },
      blackouts: [{ start: "2026-12-24", end: "2026-12-26", label: "Holidays" }],
      minNoticeDays: 3,
      messages: {
        available: "Your date is open!",
        open: "Your date looks open.",
        limited: "Only a few spots left on that date.",
        unavailable: "That date is booked.",
        unknown: "We will confirm your date shortly.",
        tooSoon: "That date is too soon for us to plan well.",
        blackout: "We are closed that day.",
      },
    },
    abandonment: { alertStaff: true, delayMinutes: 10 },
    spam: { turnstile: false, maxCompletesPerEmailPerDay: 3, maxStartsPerIpPerHour: 20 },
    emojiPrefix: "",
  };
}

const opts = { departments: DEPARTMENTS, turnstileAvailable: false };

function paths(result: ReturnType<typeof validateBusinessSettings>): string[] {
  return result.ok ? [] : result.issues.map((i) => i.path);
}

describe("validateBusinessSettings", () => {
  it("accepts good settings and normalizes them", () => {
    const res = validateBusinessSettings(business(), opts);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.homeBase.label).toBe("Office");
    expect(res.value.emojiPrefix).toBeNull();
    expect(res.value.timezone).toBe("America/New_York");
    expect(res.value.availability.blackouts).toEqual([{ start: "2026-12-24", end: "2026-12-26", label: "Holidays" }]);
  });

  it("requires coordinates before the location check can run", () => {
    const s = business();
    s.homeBase.lat = null;
    s.homeBase.lng = null;
    expect(paths(validateBusinessSettings(s, opts))).toContain("homeBase.address");
    s.location.enabled = false;
    expect(validateBusinessSettings(s, opts).ok).toBe(true);
  });

  it("wants both coordinates or neither, inside the valid ranges", () => {
    const s = business();
    s.homeBase.lng = null;
    expect(paths(validateBusinessSettings(s, opts))).toContain("homeBase.lng");
    const t = business();
    t.homeBase.lat = 123;
    expect(paths(validateBusinessSettings(t, opts))).toContain("homeBase.lat");
  });

  it("keeps the travel rings in order and the hard limit beyond the last ring", () => {
    const s = business();
    s.location.zones.riskyMiles = 40;
    expect(paths(validateBusinessSettings(s, opts))).toContain("location.zones.riskyMiles");
    const t = business();
    t.location.zones.maxMiles = 100;
    expect(paths(validateBusinessSettings(t, opts))).toContain("location.zones.maxMiles");
    const u = business();
    u.location.zones.maxMiles = 250;
    expect(validateBusinessSettings(u, opts).ok).toBe(true);
    const v = business();
    v.location.zones.passMiles = Number.NaN;
    expect(paths(validateBusinessSettings(v, opts))).toContain("location.zones.passMiles");
  });

  it("checks capacity by source", () => {
    const s = business();
    s.availability.capacity.departments = [];
    expect(paths(validateBusinessSettings(s, opts))).toContain("availability.capacity.departments");
    s.availability.capacity.departments = ["Dancers"];
    expect(paths(validateBusinessSettings(s, opts))).toContain("availability.capacity.departments");
    const t = business();
    t.availability.capacity = { source: "fixed", departments: [], fixed: null };
    expect(paths(validateBusinessSettings(t, opts))).toContain("availability.capacity.fixed");
    t.availability.capacity.fixed = 2.5;
    expect(paths(validateBusinessSettings(t, opts))).toContain("availability.capacity.fixed");
    t.availability.capacity.fixed = 4;
    expect(validateBusinessSettings(t, opts).ok).toBe(true);
    const u = business();
    u.availability.mode = "open";
    u.availability.capacity.departments = [];
    expect(validateBusinessSettings(u, opts).ok).toBe(true);
  });

  it("checks blackout ranges", () => {
    const s = business();
    s.availability.blackouts = [{ start: "2026-12-26", end: "2026-12-24" }];
    expect(paths(validateBusinessSettings(s, opts))).toContain("availability.blackouts.0.end");
    s.availability.blackouts = [{ start: "", end: "" }];
    expect(paths(validateBusinessSettings(s, opts))).toContain("availability.blackouts.0.start");
    s.availability.blackouts = [{ start: "2027-02-30", end: "2027-03-01" }];
    expect(paths(validateBusinessSettings(s, opts))).toContain("availability.blackouts.0.start");
  });

  it("treats empty minimum notice as none and rejects fractions", () => {
    const s = business();
    s.availability.minNoticeDays = null;
    expect(validateBusinessSettings(s, opts).ok).toBe(true);
    s.availability.minNoticeDays = 1.5;
    expect(paths(validateBusinessSettings(s, opts))).toContain("availability.minNoticeDays");
  });

  it("refuses Turnstile without the env keys and keeps it off", () => {
    const s = business();
    s.spam.turnstile = true;
    expect(paths(validateBusinessSettings(s, opts))).toContain("spam.turnstile");
    const res = validateBusinessSettings(s, { ...opts, turnstileAvailable: true });
    expect(res.ok && res.value.spam.turnstile).toBe(true);
  });

  it("requires every visitor message", () => {
    const s = business();
    s.availability.messages.tooSoon = "   ";
    s.location.messages.unverified = "";
    const p = paths(validateBusinessSettings(s, opts));
    expect(p).toContain("availability.messages.tooSoon");
    expect(p).toContain("location.messages.unverified");
  });

  it("limits spam numbers and the alert delay to whole numbers in range", () => {
    const s = business();
    s.spam.maxStartsPerIpPerHour = 0;
    s.spam.maxCompletesPerEmailPerDay = 1000;
    s.abandonment.delayMinutes = 2;
    const p = paths(validateBusinessSettings(s, opts));
    expect(p).toEqual(
      expect.arrayContaining(["spam.maxStartsPerIpPerHour", "spam.maxCompletesPerEmailPerDay", "abandonment.delayMinutes"]),
    );
  });

  it("issuesByPath keeps the first message per field", () => {
    expect(
      issuesByPath([
        { path: "a", message: "first" },
        { path: "a", message: "second" },
        { path: "b", message: "other" },
      ]),
    ).toEqual({ a: "first", b: "other" });
  });
});

function formSettings(): FormSettings {
  return {
    brand: "vident",
    accentColor: "#AE4213",
    headline: "  ",
    submitLabel: "Send my request",
    thankYou: { title: "You're all set!", message: "Thanks for reaching out." },
    waitlistThankYou: { title: "You're on the list", message: "We will reach out if the date opens." },
    redirectUrl: "",
    qualify: {
      celebrate: true,
      popupTitle: "YOUR SEARCH IS OVER!",
      popupSubtitle: "WE ARE AVAILABLE",
      timings: { messageIntervalMs: 3000, minCheckMs: 4000, preCelebrationMs: 2000, popupMs: 5500 },
      urgency: null,
      dateLoadingMessages: ["Checking our calendar..."],
      locationLoadingMessages: ["Now checking if we can get there..."],
    },
    onDateUnavailable: { actions: ["change_date", "waitlist", "continue"], message: "That date is already busy for us." },
    onLocationFail: { action: "continue", message: "" },
    referral: null,
    confirmationEmail: { enabled: false, subject: "", intro: "" },
    notify: { recipients: [" Events@example.com "], inApp: true },
    hostEvent: false,
    progressHype: null,
    ownerByEventType: {},
    copies: { ghl: null },
  };
}

const brandKeys = ["vident", "partner-brand"];

describe("validateFormSettings", () => {
  it("accepts good settings and normalizes them", () => {
    const res = validateFormSettings(formSettings(), { brandKeys });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.accentColor).toBe("#ae4213");
    expect(res.value.notify.recipients).toEqual(["events@example.com"]);
    expect(res.value.redirectUrl).toBeNull();
    expect("headline" in res.value).toBe(false);
  });

  it("rejects unknown brands, bad colors and non-web redirects", () => {
    const s = formSettings();
    s.brand = "someone-else";
    s.accentColor = "orange";
    s.redirectUrl = "javascript:alert(1)";
    const res = validateFormSettings(s, { brandKeys });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.issues.map((i) => i.path)).toEqual(expect.arrayContaining(["brand", "accentColor", "redirectUrl"]));
  });

  it("never offers an empty referral list", () => {
    const s = formSettings();
    s.onLocationFail = { action: "referral", message: "Here are some friends." };
    const res = validateFormSettings(s, { brandKeys });
    expect(res.ok).toBe(false);
    s.referral = { title: "Friends", message: "", links: [{ label: "Another DJ", url: "https://example.com" }] };
    expect(validateFormSettings(s, { brandKeys }).ok).toBe(true);
  });

  it("needs at least one busy-date choice and real staff emails", () => {
    const s = formSettings();
    s.onDateUnavailable.actions = [];
    s.notify.recipients = ["events@example"];
    const res = validateFormSettings(s, { brandKeys });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.issues.map((i) => i.path)).toEqual(expect.arrayContaining(["onDateUnavailable.actions", "notify.recipients"]));
  });

  it("requires a subject when the confirmation email is on", () => {
    const s = formSettings();
    s.confirmationEmail = { enabled: true, subject: "", intro: "Thanks!" };
    const res = validateFormSettings(s, { brandKeys });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.issues.map((i) => i.path)).toContain("confirmationEmail.subject");
  });
});
