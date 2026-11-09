/**
 * Inquiry Forms admin: hand-written validators (no zod) for business settings and per-form settings.
 * PURE: the settings page runs them for inline errors, the server actions run them again before saving.
 * Each validator returns a normalized copy (trimmed strings, rounded whole numbers) or plain-language issues.
 */
import type {
  BusinessSettings,
  DateUnavailableAction,
  FormSettings,
} from "@/lib/inquiry-forms/types";
import { isValidDateString } from "@/lib/inquiry-forms/dates";
import { safeRedirectUrl } from "@/lib/inquiry-forms/embed-protocol";

export interface SettingsIssue {
  /** Dotted path of the field, e.g. "location.zones.passMiles" or "availability.blackouts.2.end". */
  path: string;
  message: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: SettingsIssue[] };

/** First message per path (for inline errors). */
export function issuesByPath(issues: SettingsIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) if (!(issue.path in out)) out[issue.path] = issue.message;
  return out;
}

/** Same caps as mergeBusinessSettings / mergeFormSettings (defaults.ts), so nothing valid is cut later. */
const MESSAGE_MAX = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function wholeInRange(v: unknown, min: number, max: number): number | null {
  const n = num(v);
  if (n === null || !Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

// Business settings

export const ABANDON_DELAY_CHOICES = [5, 10, 15, 20, 30, 60] as const;

export interface BusinessValidateOptions {
  /** Hub department names that may count as capacity (e.g. DJ, Photobooth). */
  departments: readonly string[];
  /** Both Turnstile env keys are present on the server. */
  turnstileAvailable: boolean;
}

export function validateBusinessSettings(
  input: BusinessSettings,
  opts: BusinessValidateOptions,
): ValidationResult<BusinessSettings> {
  const issues: SettingsIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  const message = (path: string, raw: unknown): string => {
    const text = str(raw);
    if (!text) add(path, "Write the message visitors see here.");
    else if (text.length > MESSAGE_MAX) add(path, `Keep this message under ${MESSAGE_MAX} characters.`);
    return text;
  };

  // Home base
  const label = str(input?.homeBase?.label);
  if (label.length > 120) add("homeBase.label", "Keep the name under 120 characters.");
  const address = str(input?.homeBase?.address);
  if (address.length > 300) add("homeBase.address", "Keep the address under 300 characters.");
  const rawLat = input?.homeBase?.lat;
  const rawLng = input?.homeBase?.lng;
  const lat = rawLat === null || rawLat === undefined || rawLat === ("" as unknown) ? null : num(rawLat);
  const lng = rawLng === null || rawLng === undefined || rawLng === ("" as unknown) ? null : num(rawLng);
  const latGiven = !(rawLat === null || rawLat === undefined || rawLat === ("" as unknown));
  const lngGiven = !(rawLng === null || rawLng === undefined || rawLng === ("" as unknown));
  if (latGiven && (lat === null || lat < -90 || lat > 90)) add("homeBase.lat", "Latitude must be a number between -90 and 90.");
  if (lngGiven && (lng === null || lng < -180 || lng > 180)) add("homeBase.lng", "Longitude must be a number between -180 and 180.");
  if (latGiven !== lngGiven) add(latGiven ? "homeBase.lng" : "homeBase.lat", "Enter both latitude and longitude, or leave both empty.");

  // Location check
  const locationEnabled = input?.location?.enabled === true;
  if (locationEnabled && (lat === null || lng === null)) {
    add(
      "homeBase.address",
      "Find the home base on the map (or type its latitude and longitude) before turning on the location check.",
    );
  }
  const zonesIn = input?.location?.zones;
  const passMiles = num(zonesIn?.passMiles);
  const riskyMiles = num(zonesIn?.riskyMiles);
  const talkMiles = num(zonesIn?.talkMiles);
  const maxRaw = zonesIn?.maxMiles;
  const maxMiles = maxRaw === null || maxRaw === undefined ? null : num(maxRaw);
  if (passMiles === null || passMiles <= 0 || passMiles > 5000) {
    add("location.zones.passMiles", "Enter the miles you cover with no travel fee (more than 0).");
  }
  if (riskyMiles === null || riskyMiles <= 0 || riskyMiles > 5000) {
    add("location.zones.riskyMiles", "Enter where the travel fee zone ends, in miles.");
  } else if (passMiles !== null && riskyMiles < passMiles) {
    add("location.zones.riskyMiles", "The travel fee zone must end at or after the no-fee zone.");
  }
  if (talkMiles === null || talkMiles <= 0 || talkMiles > 5000) {
    add("location.zones.talkMiles", "Enter where the talk-first zone ends, in miles.");
  } else if (riskyMiles !== null && talkMiles < riskyMiles) {
    add("location.zones.talkMiles", "The talk-first zone must end at or after the travel fee zone.");
  }
  if (maxRaw !== null && maxRaw !== undefined) {
    if (maxMiles === null || maxMiles <= 0 || maxMiles > 5000) {
      add("location.zones.maxMiles", "Enter the hard limit in miles, or choose Keep talking.");
    } else if (talkMiles !== null && maxMiles < talkMiles) {
      add("location.zones.maxMiles", "The hard limit must be at or beyond the end of the talk-first zone.");
    }
  }
  const roadFactor = num(input?.location?.roadFactor);
  if (roadFactor === null || roadFactor < 1 || roadFactor > 3) {
    add("location.roadFactor", "Road factor must be between 1 and 3 (1.2 is typical).");
  }
  const locMsgs = input?.location?.messages;
  const locationMessages = {
    pass: message("location.messages.pass", locMsgs?.pass),
    risky: message("location.messages.risky", locMsgs?.risky),
    talk: message("location.messages.talk", locMsgs?.talk),
    fail: message("location.messages.fail", locMsgs?.fail),
    unverified: message("location.messages.unverified", locMsgs?.unverified),
  };

  // Availability
  const mode = input?.availability?.mode;
  if (mode !== "bookings" && mode !== "open" && mode !== "off") add("availability.mode", "Pick how dates are checked.");
  const source = input?.availability?.capacity?.source;
  if (source !== "staff" && source !== "fixed" && source !== "none") add("availability.capacity.source", "Pick how capacity is counted.");
  const rawDepartments = Array.isArray(input?.availability?.capacity?.departments)
    ? (input.availability.capacity.departments as unknown[]).map((d) => str(d)).filter(Boolean)
    : [];
  const departments = Array.from(new Set(rawDepartments)).slice(0, 20);
  const unknownDept = departments.find((d) => !opts.departments.includes(d));
  if (unknownDept) add("availability.capacity.departments", `Unknown department: ${unknownDept}.`);
  if (mode === "bookings" && source === "staff" && departments.length === 0) {
    add("availability.capacity.departments", "Pick at least one department whose people count toward capacity.");
  }
  const fixedRaw = input?.availability?.capacity?.fixed;
  let fixed: number | null = null;
  if (fixedRaw !== null && fixedRaw !== undefined && fixedRaw !== ("" as unknown)) {
    fixed = wholeInRange(fixedRaw, 1, 500);
    if (fixed === null) add("availability.capacity.fixed", "Enter how many events you can take on one day (a whole number from 1 to 500).");
  }
  if (mode === "bookings" && source === "fixed" && fixed === null && !issues.some((i) => i.path === "availability.capacity.fixed")) {
    add("availability.capacity.fixed", "Enter how many events you can take on one day (a whole number from 1 to 500).");
  }

  const blackoutsIn = Array.isArray(input?.availability?.blackouts) ? input.availability.blackouts : [];
  if (blackoutsIn.length > 200) add("availability.blackouts", "Keep it to 200 blackout ranges or fewer.");
  const blackouts: BusinessSettings["availability"]["blackouts"] = [];
  blackoutsIn.slice(0, 200).forEach((b, i) => {
    const start = str(b?.start);
    const end = str(b?.end) || start;
    const bl = str(b?.label);
    let ok = true;
    if (!isValidDateString(start)) {
      add(`availability.blackouts.${i}.start`, "Pick a start date.");
      ok = false;
    }
    if (!isValidDateString(end)) {
      add(`availability.blackouts.${i}.end`, "Pick an end date.");
      ok = false;
    }
    if (ok && end < start) {
      add(`availability.blackouts.${i}.end`, "The end date must be on or after the start date.");
    }
    if (bl.length > 80) add(`availability.blackouts.${i}.label`, "Keep the label under 80 characters.");
    blackouts.push(bl ? { start, end, label: bl } : { start, end });
  });

  const noticeRaw = input?.availability?.minNoticeDays;
  let minNoticeDays: number | null = null;
  if (noticeRaw !== null && noticeRaw !== undefined && noticeRaw !== ("" as unknown)) {
    minNoticeDays = wholeInRange(noticeRaw, 0, 365);
    if (minNoticeDays === null) add("availability.minNoticeDays", "Use a whole number of days from 0 to 365, or leave it empty.");
  }
  const avMsgs = input?.availability?.messages;
  const availabilityMessages = {
    available: message("availability.messages.available", avMsgs?.available),
    open: message("availability.messages.open", avMsgs?.open),
    limited: message("availability.messages.limited", avMsgs?.limited),
    unavailable: message("availability.messages.unavailable", avMsgs?.unavailable),
    unknown: message("availability.messages.unknown", avMsgs?.unknown),
    tooSoon: message("availability.messages.tooSoon", avMsgs?.tooSoon),
    blackout: message("availability.messages.blackout", avMsgs?.blackout),
  };

  // Abandonment
  const delayMinutes = wholeInRange(input?.abandonment?.delayMinutes, 5, 1440);
  if (delayMinutes === null) add("abandonment.delayMinutes", "Pick a delay between 5 minutes and 24 hours.");

  // Spam
  const turnstile = input?.spam?.turnstile === true;
  if (turnstile && !opts.turnstileAvailable) {
    add(
      "spam.turnstile",
      "Turnstile needs TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY in Vercel before it can be turned on.",
    );
  }
  const maxCompletes = wholeInRange(input?.spam?.maxCompletesPerEmailPerDay, 1, 100);
  if (maxCompletes === null) add("spam.maxCompletesPerEmailPerDay", "Use a whole number from 1 to 100.");
  const maxStarts = wholeInRange(input?.spam?.maxStartsPerIpPerHour, 1, 1000);
  if (maxStarts === null) add("spam.maxStartsPerIpPerHour", "Use a whole number from 1 to 1,000.");

  // Emoji prefix
  const emoji = str(input?.emojiPrefix);
  if (Array.from(emoji).length > 8) add("emojiPrefix", "Keep the prefix short: a few emoji at most (8 symbols).");
  if (/[<>]/.test(emoji)) add("emojiPrefix", "The prefix cannot contain < or >.");

  if (issues.length) return { ok: false, issues };

  return {
    ok: true,
    value: {
      timezone: "America/New_York",
      homeBase: { label, address, lat, lng },
      location: {
        enabled: locationEnabled,
        zones: {
          passMiles: passMiles as number,
          riskyMiles: riskyMiles as number,
          talkMiles: talkMiles as number,
          maxMiles,
        },
        roadFactor: roadFactor as number,
        messages: locationMessages,
      },
      availability: {
        mode: mode as BusinessSettings["availability"]["mode"],
        capacity: {
          source: source as BusinessSettings["availability"]["capacity"]["source"],
          departments,
          fixed,
        },
        blackouts,
        minNoticeDays,
        messages: availabilityMessages,
      },
      abandonment: { alertStaff: input?.abandonment?.alertStaff === true, delayMinutes: delayMinutes as number },
      spam: {
        turnstile: turnstile && opts.turnstileAvailable,
        maxCompletesPerEmailPerDay: maxCompletes as number,
        maxStartsPerIpPerHour: maxStarts as number,
      },
      emojiPrefix: emoji || null,
    },
  };
}

// Per-form settings (saveDraft)

const DATE_ACTIONS: readonly DateUnavailableAction[] = ["change_date", "alternatives", "waitlist", "continue"];

export interface FormSettingsValidateOptions {
  /** Brand keys the hub adapter knows. */
  brandKeys: readonly string[];
}

/**
 * Checks a FormSettings object (already deep-merged with the defaults). Messages name the field
 * because the editor lists them together.
 */
export function validateFormSettings(
  s: FormSettings,
  opts: FormSettingsValidateOptions,
): ValidationResult<FormSettings> {
  const issues: SettingsIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  const text = (path: string, raw: unknown, name: string, max: number, required: boolean): string => {
    const v = str(raw);
    if (required && !v) add(path, `${name}: this cannot be empty.`);
    else if (v.length > max) add(path, `${name}: keep it under ${max} characters.`);
    return v;
  };

  const brand = str(s?.brand);
  if (!opts.brandKeys.includes(brand)) add("brand", "Brand: pick one of the hub's brands.");
  const accentColor = str(s?.accentColor);
  if (!HEX_RE.test(accentColor)) add("accentColor", "Accent color: use a hex color like #e00000.");

  const headline = text("headline", s?.headline, "Headline", 200, false);
  const subheadline = text("subheadline", s?.subheadline, "Subheadline", 300, false);
  const submitLabel = text("submitLabel", s?.submitLabel, "Send button label", 60, true);
  const thankYou = {
    title: text("thankYou.title", s?.thankYou?.title, "Thank-you title", 120, true),
    message: text("thankYou.message", s?.thankYou?.message, "Thank-you message", 1000, true),
  };
  const waitlistThankYou = {
    title: text("waitlistThankYou.title", s?.waitlistThankYou?.title, "Waitlist thank-you title", 120, true),
    message: text("waitlistThankYou.message", s?.waitlistThankYou?.message, "Waitlist thank-you message", 1000, true),
  };

  const redirectRaw = str(s?.redirectUrl);
  let redirectUrl: string | null = null;
  if (redirectRaw) {
    redirectUrl = safeRedirectUrl(redirectRaw);
    if (!redirectUrl) add("redirectUrl", "Redirect link: use a full web address that starts with https://.");
  }

  const q = s?.qualify;
  const celebrate = q?.celebrate === true;
  const popupTitle = text("qualify.popupTitle", q?.popupTitle, "Celebration title", 80, celebrate);
  const popupSubtitle = text("qualify.popupSubtitle", q?.popupSubtitle, "Celebration subtitle", 120, false);
  const timing = (key: keyof FormSettings["qualify"]["timings"], name: string, min: number, max: number): number => {
    const v = wholeInRange(q?.timings?.[key], min, max);
    if (v === null) add(`qualify.timings.${key}`, `${name}: use a whole number of milliseconds from ${min} to ${max}.`);
    return v ?? min;
  };
  const timings = {
    messageIntervalMs: timing("messageIntervalMs", "Message interval", 500, 15000),
    minCheckMs: timing("minCheckMs", "Minimum check time", 0, 20000),
    preCelebrationMs: timing("preCelebrationMs", "Pause before the celebration", 0, 10000),
    popupMs: timing("popupMs", "Celebration length", 0, 15000),
  };
  const urgencyRaw = str(q?.urgency);
  if (urgencyRaw.length > 300) add("qualify.urgency", "Urgency line: keep it under 300 characters.");
  const messageList = (path: string, raw: unknown, name: string): string[] => {
    const list = Array.isArray(raw) ? raw.map((m) => str(m)).filter(Boolean) : [];
    if (list.length > 20) add(path, `${name}: keep it to 20 messages or fewer.`);
    if (list.some((m) => m.length > 200)) add(path, `${name}: keep each message under 200 characters.`);
    return list.slice(0, 20);
  };
  const dateLoadingMessages = messageList("qualify.dateLoadingMessages", q?.dateLoadingMessages, "Date check messages");
  const locationLoadingMessages = messageList(
    "qualify.locationLoadingMessages",
    q?.locationLoadingMessages,
    "Location check messages",
  );

  const actionsRaw = Array.isArray(s?.onDateUnavailable?.actions) ? s.onDateUnavailable.actions : [];
  const actions = DATE_ACTIONS.filter((a) => actionsRaw.includes(a));
  if (actions.length === 0) add("onDateUnavailable.actions", "Busy date: offer the visitor at least one choice.");
  const dateMessage = text("onDateUnavailable.message", s?.onDateUnavailable?.message, "Busy date message", 1000, true);

  const locAction = s?.onLocationFail?.action === "referral" ? "referral" : "continue";
  const locMessage = text("onLocationFail.message", s?.onLocationFail?.message, "Outside the area message", 1000, false);

  let referral: FormSettings["referral"] = null;
  if (s?.referral) {
    const links = (Array.isArray(s.referral.links) ? s.referral.links : [])
      .map((l) => ({ label: str(l?.label), url: str(l?.url) }))
      .filter((l) => l.label || l.url);
    links.forEach((l, i) => {
      if (!l.label) add(`referral.links.${i}.label`, `Referral link ${i + 1}: add a name.`);
      else if (l.label.length > 80) add(`referral.links.${i}.label`, `Referral link ${i + 1}: keep the name under 80 characters.`);
      if (!safeRedirectUrl(l.url)) add(`referral.links.${i}.url`, `Referral link ${i + 1}: use a full web address that starts with https://.`);
    });
    referral = {
      title: text("referral.title", s.referral.title, "Referral title", 120, false),
      message: text("referral.message", s.referral.message, "Referral message", 1000, false),
      links: links.slice(0, 10).map((l) => ({ label: l.label, url: safeRedirectUrl(l.url) ?? l.url })),
    };
  }
  if (locAction === "referral" && (!referral || referral.links.length === 0)) {
    add("onLocationFail.action", "Outside the area: add at least one referral link, or choose to let them continue.");
  }

  const confirmationEnabled = s?.confirmationEmail?.enabled === true;
  const confirmationEmail = {
    enabled: confirmationEnabled,
    subject: text("confirmationEmail.subject", s?.confirmationEmail?.subject, "Confirmation email subject", 200, confirmationEnabled),
    intro: text("confirmationEmail.intro", s?.confirmationEmail?.intro, "Confirmation email text", 2000, false),
  };

  const recipientsRaw = Array.isArray(s?.notify?.recipients) ? s.notify.recipients : [];
  const recipients = Array.from(new Set(recipientsRaw.map((r) => str(r).toLowerCase()).filter(Boolean)));
  const badRecipient = recipients.find((r) => !EMAIL_RE.test(r));
  if (badRecipient) add("notify.recipients", `Staff email: "${badRecipient}" is not a full email address.`);
  if (recipients.length > 20) add("notify.recipients", "Staff email: 20 addresses at most.");

  // Owner by event type: every filled-in owner must be a full email address.
  const ownerByEventType: Record<string, string> = {};
  for (const [choice, raw] of Object.entries(s?.ownerByEventType ?? {})) {
    const email = str(raw).toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) add(`ownerByEventType.${choice}`, `Owner for "${choice}": "${email}" is not a full email address.`);
    ownerByEventType[choice] = email;
  }

  // Copies: a copy that is on needs the ids that tell the other system where the lead goes.
  const ghl = s?.copies?.ghl ?? null;
  if (ghl?.enabled) {
    if (!str(ghl.locationId)) add("copies.ghl.locationId", "Copy to GoHighLevel: add the location id.");
    if (!str(ghl.trackingId)) add("copies.ghl.trackingId", "Copy to GoHighLevel: add the tracking id.");
    if (!str(ghl.formId)) add("copies.ghl.formId", "Copy to GoHighLevel: add the form name GoHighLevel uses.");
  }

  const hypeRaw = s?.progressHype;
  let progressHype: string[] | null = null;
  if (Array.isArray(hypeRaw)) {
    progressHype = hypeRaw.map((h) => str(h)).filter(Boolean);
    if (progressHype.some((h) => h.length > 80)) add("progressHype", "Progress lines: keep each under 80 characters.");
    if (progressHype.length > 20) add("progressHype", "Progress lines: 20 at most.");
    if (progressHype.length === 0) progressHype = null;
  }

  if (issues.length) return { ok: false, issues };

  const value: FormSettings = {
    ...s,
    brand,
    accentColor: accentColor.toLowerCase(),
    submitLabel,
    thankYou,
    waitlistThankYou,
    redirectUrl,
    qualify: {
      ...s.qualify,
      celebrate,
      popupTitle,
      popupSubtitle,
      timings,
      urgency: urgencyRaw || null,
      dateLoadingMessages,
      locationLoadingMessages,
    },
    onDateUnavailable: { actions, message: dateMessage },
    onLocationFail: { action: locAction, message: locMessage },
    referral,
    confirmationEmail,
    notify: { recipients, inApp: s?.notify?.inApp !== false },
    ownerByEventType,
    hostEvent: s?.hostEvent === true,
    progressHype,
  };
  if (headline) value.headline = headline;
  else delete value.headline;
  if (subheadline) value.subheadline = subheadline;
  else delete value.subheadline;
  return { ok: true, value };
}
