/**
 * Inquiry Forms - default form settings, default business settings, and their merges.
 *
 * PURE module. Timings and the celebration copy are LeadGate's tuned production values
 * (message interval 3000 ms, minimum check 4000 ms, suspense 2000 ms, popup 5500 ms,
 * "YOUR SEARCH IS OVER!" / "WE ARE AVAILABLE"). Business defaults are generic and conservative:
 * no location check, availability "open", no capacity source, no blackouts.
 *
 * Copy rules: never promise availability or a booking, US English, no em dashes or double dashes.
 *
 * The exported defaults are deep-frozen. Use mergeFormSettings / mergeBusinessSettings (they return
 * fresh, mutable copies) whenever you need a settings object to change.
 */

import type { BusinessSettings, DateUnavailableAction, FormCopies, FormSettings } from "./types";
import { isValidDateString } from "./dates";
import { safeRedirectUrl } from "./embed-protocol";
import { isValidEmail } from "./validation";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

/** LeadGate's five urgency lines (shown under good news when a form picks one). */
export const URGENCY_PRESETS: string[] = deepFreeze([
  "We'd hate for you to miss out! Our calendar books up fast, so lock in your date while it's still open.",
  "Heads up: dates like yours go quickly. The sooner you finalize, the sooner you're locked in!",
  "Just so you know, we book on a first come, first served basis. Grab your spot before it's gone!",
  "Good news: your date is open! But popular dates don't last long. Secure yours now.",
  "Quick tip from us: don't wait too long! Our schedule fills up, and we'd love to have you on it.",
]);

/** Rotating lines while the date check runs (LeadGate defaults). */
export const DATE_LOADING_MESSAGES: string[] = deepFreeze([
  "Crossing fingers that your date is available...",
  "Checking our calendar, this is exciting!",
  "Let me peek at the schedule real quick...",
  "Consulting the booking gods...",
  "Almost there, just need to double-check...",
  "Looking good so far, just confirming...",
  "Searching for your perfect date...",
  "Running the numbers on availability...",
  "Fingers crossed, checking now...",
  "Hold tight, verifying the date...",
]);

/** Rotating lines while the location check runs (LeadGate defaults). */
export const LOCATION_LOADING_MESSAGES: string[] = deepFreeze([
  "Now checking if we can get there...",
  "Calculating the journey to your venue...",
  "Hope it's not too far, checking now...",
  "Mapping out the route...",
  "Almost done, just checking the distance...",
  "Making sure we are in range...",
  "Pulling up the map, one moment...",
  "Checking if your location is in our sweet spot...",
  "Running the location check...",
  "Measuring the miles, hang tight...",
]);

const DATE_UNAVAILABLE_ACTIONS: readonly DateUnavailableAction[] = ["change_date", "alternatives", "waitlist", "continue"];

const DEFAULT_REFERRAL_TITLE = "Other great options";
const DEFAULT_REFERRAL_MESSAGE = "Here are a few trusted partners who may be able to help.";

export const DEFAULT_FORM_SETTINGS: FormSettings = deepFreeze<FormSettings>({
  brand: "",
  accentColor: "#1d4ed8",
  submitLabel: "Send my request",
  thankYou: {
    title: "Thank you!",
    message: "We received your request and will be in touch soon.",
  },
  waitlistThankYou: {
    title: "You're on the waitlist!",
    message: "Thanks for your interest. We'll reach out if this date opens up.",
  },
  redirectUrl: null,
  qualify: {
    celebrate: true,
    popupTitle: "YOUR SEARCH IS OVER!",
    popupSubtitle: "WE ARE AVAILABLE",
    timings: { messageIntervalMs: 3000, minCheckMs: 4000, preCelebrationMs: 2000, popupMs: 5500 },
    urgency: null,
    dateLoadingMessages: [...DATE_LOADING_MESSAGES],
    locationLoadingMessages: [...LOCATION_LOADING_MESSAGES],
  },
  onDateUnavailable: {
    actions: ["change_date", "continue"],
    message:
      "That date is already busy for us. You can pick another date, or send your request anyway and we'll check with the team.",
  },
  onLocationFail: {
    action: "continue",
    message:
      "This location is outside our usual service area. You can still send your request and we'll let you know what we can do.",
  },
  referral: null,
  confirmationEmail: {
    enabled: false,
    subject: "We received your request",
    intro:
      "Thanks for reaching out! We received your request and someone from our team will be in touch soon. Here is a copy of what you sent us.",
  },
  notify: { recipients: [], inApp: true },
  ownerByEventType: {},
  copies: { ghl: null },
  hostEvent: false,
  progressHype: null,
});

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = deepFreeze<BusinessSettings>({
  timezone: "America/New_York",
  homeBase: { label: "", address: "", lat: null, lng: null },
  location: {
    enabled: false,
    zones: { passMiles: 50, riskyMiles: 75, talkMiles: 100, maxMiles: null },
    roadFactor: 1.2,
    messages: {
      pass: "Great news! Your event location is within our service area.",
      risky: "Your event is a bit farther than usual, but we can still make it work. A travel fee may apply.",
      talk: "Your event is outside our usual area. Send your request and we'll talk through the travel details.",
      fail: "This location is outside our service area. You can still send your request and we'll let you know our options.",
      unverified: "We couldn't verify the exact address just yet. We'll review it and follow up shortly.",
    },
  },
  availability: {
    mode: "open",
    capacity: { source: "none", departments: [], fixed: null },
    blackouts: [],
    minNoticeDays: null,
    messages: {
      available: "Good news: your date is open on our calendar. Finish your request and we'll confirm the details.",
      open: "Your date looks open. Send your request and we'll confirm availability with you.",
      limited: "Your date is filling up, but we still have openings. Send your request soon and we'll confirm.",
      unavailable: "It looks like we're already booked on this date.",
      unknown: "We couldn't check this date automatically. We'll confirm it with you shortly.",
      tooSoon: "That date is a little too soon to book online. Send your request and we'll see what we can do.",
      blackout: "We're not taking bookings on that date. Please choose another date, or send your request and we'll be in touch.",
    },
  },
  abandonment: { alertStaff: true, delayMinutes: 10 },
  spam: { turnstile: false, maxCompletesPerEmailPerDay: 3, maxStartsPerIpPerHour: 20 },
  emojiPrefix: null,
});

// ===========================================================================
// Coercion helpers
// ===========================================================================

type Raw = Record<string, unknown>;

function isRecord(v: unknown): v is Raw {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function rec(v: unknown): Raw {
  return isRecord(v) ? v : {};
}

function parseMaybeJson(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return undefined;
  }
}

/** Required copy: a non-blank string (trimmed, capped), else the default. */
function text(v: unknown, fallback: string, max: number): string {
  if (typeof v !== "string") return fallback;
  const t = v.replace(/\r\n?/g, "\n").trim().slice(0, max).trim();
  return t || fallback;
}

/** Copy that may be blank on purpose (e.g. no popup subtitle). */
function textAllowEmpty(v: unknown, fallback: string, max: number): string {
  if (typeof v !== "string") return fallback;
  return v.replace(/\r\n?/g, "\n").trim().slice(0, max).trim();
}

/** Optional copy: trimmed non-blank string, or undefined. */
function optionalText(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max).trim();
  return t || undefined;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** A number clamped to [min, max]; wrong types give the default. */
function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = toNumber(v);
  return n === null ? fallback : Math.min(max, Math.max(min, n));
}

function int(v: unknown, fallback: number, min: number, max: number): number {
  return Math.round(num(v, fallback, min, max));
}

/** null stays null; a number is clamped; anything else gives the default. */
function nullableInt(v: unknown, fallback: number | null, min: number, max: number): number | null {
  if (v === null) return null;
  const n = toNumber(v);
  return n === null ? fallback : Math.round(Math.min(max, Math.max(min, n)));
}

function nullableNum(v: unknown, fallback: number | null, min: number, max: number): number | null {
  if (v === null) return null;
  const n = toNumber(v);
  return n === null ? fallback : Math.min(max, Math.max(min, n));
}

/** A coordinate inside [min, max], else null (out-of-range numbers are junk, not clamped). */
function coordinate(v: unknown, min: number, max: number): number | null {
  const n = toNumber(v);
  return n !== null && n >= min && n <= max ? n : null;
}

/** Non-blank trimmed strings (deduped); an empty result gives a copy of the default. */
function list(v: unknown, fallback: readonly string[], maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [...fallback];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const t = item.trim().slice(0, maxLen).trim();
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= maxItems) break;
  }
  return out.length > 0 ? out : [...fallback];
}

/** "#e00000" (or "#abc" expanded); anything else gives the default. */
function hexColor(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const t = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  if (/^#[0-9a-f]{3}$/.test(t)) return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  return fallback;
}

function mergeReferral(v: unknown): FormSettings["referral"] {
  if (!isRecord(v)) return null;
  const links: { label: string; url: string }[] = [];
  if (Array.isArray(v.links)) {
    for (const l of v.links) {
      if (!isRecord(l)) continue;
      const label = typeof l.label === "string" ? l.label.replace(/\s+/g, " ").trim().slice(0, 80) : "";
      const url = safeRedirectUrl(l.url);
      if (label && url) links.push({ label, url });
      if (links.length >= 10) break;
    }
  }
  // Never offer an empty referral list: no usable link means no referral panel.
  if (links.length === 0) return null;
  return {
    title: text(v.title, DEFAULT_REFERRAL_TITLE, 120),
    message: text(v.message, DEFAULT_REFERRAL_MESSAGE, 1000),
    links,
  };
}

function mergeProgressHype(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.slice(0, 20).map((s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, 80) : ""));
  return out.some((s) => s.length > 0) ? out : null;
}

function mergeRecipients(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const e = item.trim().toLowerCase();
    if (isValidEmail(e) && !out.includes(e)) out.push(e);
    if (out.length >= 20) break;
  }
  return out;
}

/** Choice value -> owner email. Keeps valid keys and emails only (at most 100 entries). */
function mergeOwners(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isRecord(v)) return out;
  let n = 0;
  for (const [key, raw] of Object.entries(v)) {
    if (n >= 100) break;
    const k = key.trim().slice(0, 120);
    if (!k || k === "__proto__" || k === "constructor" || k === "prototype") continue;
    if (typeof raw !== "string") continue;
    const e = raw.trim().toLowerCase();
    if (!isValidEmail(e)) continue;
    out[k] = e;
    n += 1;
  }
  return out;
}

/** One line of setting text (ids, keys, labels): trimmed, no line breaks, capped. */
function token(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** http(s) URL or "". */
function httpUrl(v: unknown): string {
  const s = token(v, 500);
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : "";
}

function mergeCopies(v: unknown): FormCopies {
  const p = rec(v);
  const out: FormCopies = { ghl: null };
  if (isRecord(p.ghl)) {
    const g = p.ghl;
    const locationId = token(g.locationId, 80);
    const trackingId = token(g.trackingId, 80);
    const formId = token(g.formId, 120);
    const ready = Boolean(locationId && trackingId && formId);
    out.ghl = {
      enabled: bool(g.enabled, false) && ready,
      locationId,
      trackingId,
      formId,
      siteUrl: httpUrl(g.siteUrl),
      notesKey: token(g.notesKey, 80) || "contact.event_details",
      notesLabel: token(g.notesLabel, 80) || "Event Details",
      eventTypeKey: token(g.eventTypeKey, 80) || null,
      servicesKey: token(g.servicesKey, 80) || null,
    };
  }
  return out;
}

// ===========================================================================
// Merges
// ===========================================================================

/**
 * Stored (partial, possibly stale or hand-edited) form settings -> complete FormSettings.
 * Deep-merges onto DEFAULT_FORM_SETTINGS, keeps only known keys, and coerces wrong types and
 * out-of-range numbers back to the defaults. Accepts an object or its JSON text.
 */
export function mergeFormSettings(partial: unknown): FormSettings {
  const p = rec(parseMaybeJson(partial));
  const d = DEFAULT_FORM_SETTINGS;
  const qualify = rec(p.qualify);
  const timings = rec(qualify.timings);
  const thankYou = rec(p.thankYou);
  const waitlist = rec(p.waitlistThankYou);
  const dateUnavailable = rec(p.onDateUnavailable);
  const locationFail = rec(p.onLocationFail);
  const confirmation = rec(p.confirmationEmail);
  const notify = rec(p.notify);

  const actions: DateUnavailableAction[] = [];
  if (Array.isArray(dateUnavailable.actions)) {
    for (const a of dateUnavailable.actions) {
      if ((DATE_UNAVAILABLE_ACTIONS as readonly unknown[]).includes(a) && !actions.includes(a as DateUnavailableAction)) {
        actions.push(a as DateUnavailableAction);
      }
    }
  }

  const out: FormSettings = {
    brand: typeof p.brand === "string" ? p.brand.trim().slice(0, 60) : d.brand,
    accentColor: hexColor(p.accentColor, d.accentColor),
    submitLabel: text(p.submitLabel, d.submitLabel, 60).replace(/\s+/g, " "),
    thankYou: {
      title: text(thankYou.title, d.thankYou.title, 120),
      message: text(thankYou.message, d.thankYou.message, 1000),
    },
    waitlistThankYou: {
      title: text(waitlist.title, d.waitlistThankYou.title, 120),
      message: text(waitlist.message, d.waitlistThankYou.message, 1000),
    },
    redirectUrl: safeRedirectUrl(p.redirectUrl),
    qualify: {
      celebrate: bool(qualify.celebrate, d.qualify.celebrate),
      popupTitle: text(qualify.popupTitle, d.qualify.popupTitle, 80),
      popupSubtitle: textAllowEmpty(qualify.popupSubtitle, d.qualify.popupSubtitle, 120),
      timings: {
        messageIntervalMs: int(timings.messageIntervalMs, d.qualify.timings.messageIntervalMs, 500, 15000),
        minCheckMs: int(timings.minCheckMs, d.qualify.timings.minCheckMs, 0, 20000),
        preCelebrationMs: int(timings.preCelebrationMs, d.qualify.timings.preCelebrationMs, 0, 10000),
        popupMs: int(timings.popupMs, d.qualify.timings.popupMs, 0, 15000),
      },
      urgency:
        qualify.urgency === undefined
          ? d.qualify.urgency
          : typeof qualify.urgency === "string" && qualify.urgency.trim()
            ? qualify.urgency.trim().slice(0, 300)
            : null,
      dateLoadingMessages: list(qualify.dateLoadingMessages, d.qualify.dateLoadingMessages, 20, 200),
      locationLoadingMessages: list(qualify.locationLoadingMessages, d.qualify.locationLoadingMessages, 20, 200),
    },
    onDateUnavailable: {
      actions: actions.length > 0 ? actions : [...d.onDateUnavailable.actions],
      message: text(dateUnavailable.message, d.onDateUnavailable.message, 1000),
    },
    onLocationFail: {
      action:
        locationFail.action === "continue" || locationFail.action === "referral"
          ? locationFail.action
          : d.onLocationFail.action,
      message: text(locationFail.message, d.onLocationFail.message, 1000),
    },
    referral: mergeReferral(p.referral),
    confirmationEmail: {
      enabled: bool(confirmation.enabled, d.confirmationEmail.enabled),
      subject: text(confirmation.subject, d.confirmationEmail.subject, 200).replace(/\s+/g, " "),
      intro: text(confirmation.intro, d.confirmationEmail.intro, 2000),
    },
    notify: {
      recipients: mergeRecipients(notify.recipients),
      inApp: bool(notify.inApp, d.notify.inApp),
    },
    ownerByEventType: mergeOwners(p.ownerByEventType),
    copies: mergeCopies(p.copies),
    hostEvent: bool(p.hostEvent, d.hostEvent),
    progressHype: mergeProgressHype(p.progressHype),
  };
  const headline = optionalText(p.headline, 200);
  if (headline !== undefined) out.headline = headline;
  const subheadline = optionalText(p.subheadline, 300);
  if (subheadline !== undefined) out.subheadline = subheadline;
  return out;
}

/**
 * Stored (partial) business settings -> complete BusinessSettings, same rules as mergeFormSettings.
 * Blackouts keep only real "YYYY-MM-DD" ranges (a missing end means one day; reversed ranges are
 * swapped). The time zone is always America/New_York.
 */
export function mergeBusinessSettings(partial: unknown): BusinessSettings {
  const p = rec(parseMaybeJson(partial));
  const d = DEFAULT_BUSINESS_SETTINGS;
  const home = rec(p.homeBase);
  const location = rec(p.location);
  const zones = rec(location.zones);
  const locMessages = rec(location.messages);
  const availability = rec(p.availability);
  const capacity = rec(availability.capacity);
  const availMessages = rec(availability.messages);
  const abandonment = rec(p.abandonment);
  const spam = rec(p.spam);

  const blackouts: BusinessSettings["availability"]["blackouts"] = [];
  if (Array.isArray(availability.blackouts)) {
    for (const b of availability.blackouts) {
      if (!isRecord(b)) continue;
      const start = typeof b.start === "string" ? b.start.trim() : "";
      const endRaw = typeof b.end === "string" && b.end.trim() ? b.end.trim() : start;
      if (!isValidDateString(start) || !isValidDateString(endRaw)) continue;
      const [from, to] = start <= endRaw ? [start, endRaw] : [endRaw, start];
      const label = typeof b.label === "string" ? b.label.replace(/\s+/g, " ").trim().slice(0, 80) : "";
      blackouts.push(label ? { start: from, end: to, label } : { start: from, end: to });
      if (blackouts.length >= 500) break;
    }
  }

  const source =
    capacity.source === "staff" || capacity.source === "fixed" || capacity.source === "none"
      ? capacity.source
      : d.availability.capacity.source;
  const mode =
    availability.mode === "bookings" || availability.mode === "open" || availability.mode === "off"
      ? availability.mode
      : d.availability.mode;

  const emoji = typeof p.emojiPrefix === "string" ? Array.from(p.emojiPrefix.trim()).slice(0, 8).join("") : "";

  return {
    timezone: "America/New_York",
    homeBase: {
      label: textAllowEmpty(home.label, d.homeBase.label, 120),
      address: textAllowEmpty(home.address, d.homeBase.address, 300),
      lat: coordinate(home.lat, -90, 90),
      lng: coordinate(home.lng, -180, 180),
    },
    location: {
      enabled: bool(location.enabled, d.location.enabled),
      zones: {
        passMiles: num(zones.passMiles, d.location.zones.passMiles, 0, 5000),
        riskyMiles: num(zones.riskyMiles, d.location.zones.riskyMiles, 0, 5000),
        talkMiles: num(zones.talkMiles, d.location.zones.talkMiles, 0, 5000),
        maxMiles: nullableNum(zones.maxMiles, d.location.zones.maxMiles, 0, 5000),
      },
      roadFactor: num(location.roadFactor, d.location.roadFactor, 1, 3),
      messages: {
        pass: text(locMessages.pass, d.location.messages.pass, 500),
        risky: text(locMessages.risky, d.location.messages.risky, 500),
        talk: text(locMessages.talk, d.location.messages.talk, 500),
        fail: text(locMessages.fail, d.location.messages.fail, 500),
        unverified: text(locMessages.unverified, d.location.messages.unverified, 500),
      },
    },
    availability: {
      mode,
      capacity: {
        source,
        departments: list(capacity.departments, d.availability.capacity.departments ?? [], 20, 80),
        fixed: nullableInt(capacity.fixed, d.availability.capacity.fixed ?? null, 0, 10000),
      },
      blackouts,
      minNoticeDays: nullableInt(availability.minNoticeDays, d.availability.minNoticeDays, 0, 365),
      messages: {
        available: text(availMessages.available, d.availability.messages.available, 500),
        open: text(availMessages.open, d.availability.messages.open, 500),
        limited: text(availMessages.limited, d.availability.messages.limited, 500),
        unavailable: text(availMessages.unavailable, d.availability.messages.unavailable, 500),
        unknown: text(availMessages.unknown, d.availability.messages.unknown, 500),
        tooSoon: text(availMessages.tooSoon, d.availability.messages.tooSoon, 500),
        blackout: text(availMessages.blackout, d.availability.messages.blackout, 500),
      },
    },
    abandonment: {
      alertStaff: bool(abandonment.alertStaff, d.abandonment.alertStaff),
      delayMinutes: int(abandonment.delayMinutes, d.abandonment.delayMinutes, 5, 1440),
    },
    spam: {
      turnstile: bool(spam.turnstile, d.spam.turnstile),
      maxCompletesPerEmailPerDay: int(spam.maxCompletesPerEmailPerDay, d.spam.maxCompletesPerEmailPerDay, 1, 100),
      maxStartsPerIpPerHour: int(spam.maxStartsPerIpPerHour, d.spam.maxStartsPerIpPerHour, 1, 1000),
    },
    emojiPrefix: emoji || null,
  };
}
