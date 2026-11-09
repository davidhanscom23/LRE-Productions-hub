/**
 * Inquiry Forms - submission lifecycle rules shared by the route handlers, the sweep and the
 * hub adapters. PURE (no DB, no env, no network).
 */
import { answerDisplay, budgetOutcome } from "../answers";
import { findRoleField } from "../definition";
import { formatLongDate } from "../dates";
import { safeRedirectUrl } from "../embed-protocol";
import { shouldCelebrate } from "../scoring";
import { isValidEmail, validateStep } from "../validation";
import type {
  Answers,
  CheckKind,
  CompleteResponse,
  DateResult,
  FormDefinition,
  FormSettings,
  LocationResult,
  Qualification,
  ScoreLabel,
} from "../types";
import { isCalendarDate, toDbInt } from "./schema-core";

/** A submission accepts saves for this long after it started. */
export const UPDATE_WINDOW_HOURS = 72;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function withinUpdateWindow(startedAt: string, now: Date): boolean {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return false;
  return now.getTime() - started <= UPDATE_WINDOW_HOURS * 60 * 60 * 1000;
}

/**
 * The step the visitor is on after saving `stepIndex`: never moves backwards, never past the last
 * step (only completion sets current_step = total_steps).
 */
export function nextCurrentStep(prev: number, stepIndex: number, totalSteps: number): number {
  const last = Math.max(0, totalSteps - 1);
  const p = Number.isInteger(prev) && prev >= 0 ? prev : 0;
  return Math.min(Math.max(p, stepIndex + 1), last);
}

// ---------------------------------------------------------------------------
// Contact and denormalized columns
// ---------------------------------------------------------------------------

export function normalizeEmail(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/\s+/g, "").toLowerCase().slice(0, 320);
  // The same address rule the form validates with (no mailto header characters).
  return isValidEmail(v) ? v : null;
}

function capped(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : null;
}

export interface ContactColumns {
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  event_date: string | null;
  event_location: string | null;
  guest_count: number | null;
}

/** The inquiry_submissions columns copied out of the answers (through field roles). */
export function contactColumns(def: FormDefinition, answers: Answers): ContactColumns {
  const display = (role: Parameters<typeof findRoleField>[1]) => {
    const f = findRoleField(def, role);
    return f ? answerDisplay(f, answers) : null;
  };
  const raw = (role: Parameters<typeof findRoleField>[1]) => {
    const f = findRoleField(def, role);
    return f ? answers[f.key] : undefined;
  };
  const date = raw("event_date");
  const email = raw("email");
  const phone = raw("phone");
  const guests = findRoleField(def, "guest_count");
  return {
    contact_name: capped(display("name"), 200),
    contact_email: normalizeEmail(typeof email === "string" ? email : null),
    contact_phone: capped(typeof phone === "string" ? phone : null, 40),
    event_date: isCalendarDate(date) ? date : null,
    event_location: capped(display("event_location"), 500),
    guest_count: guests?.type === "number" ? toDbInt(answers[guests.key]) : null,
  };
}

export function hasContact(c: Pick<ContactColumns, "contact_email" | "contact_phone">): boolean {
  return Boolean(c.contact_email || c.contact_phone);
}

/** Per-field message when step answers leave no way to reach the visitor. */
export function missingContactErrors(def: FormDefinition): Record<string, string> {
  const out: Record<string, string> = {};
  const email = findRoleField(def, "email");
  const phone = findRoleField(def, "phone");
  const message = "Please add an email or phone so we can reach you";
  if (email) out[email.key] = message;
  if (phone) out[phone.key] = message;
  return out;
}

// ---------------------------------------------------------------------------
// Validation across the whole form
// ---------------------------------------------------------------------------

/** First fields step with an error in its visible fields, in form order (null = all good). */
export function firstInvalidStep(
  def: FormDefinition,
  answers: Answers,
  today: string,
): { stepIndex: number; fieldErrors: Record<string, string> } | null {
  for (let i = 0; i < def.steps.length; i += 1) {
    const step = def.steps[i];
    if (step.kind !== "fields") continue;
    const errors = validateStep(step, answers, { today });
    if (Object.keys(errors).length > 0) return { stepIndex: i, fieldErrors: errors };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Qualification
// ---------------------------------------------------------------------------

/** The form's availability check step (a valid definition has at most one). */
export function qualifyStepOf(def: FormDefinition): { index: number; checks: CheckKind[] } | null {
  const index = def.steps.findIndex((s) => s.kind === "qualify");
  if (index < 0) return null;
  const checks = (def.steps[index].checks ?? []).filter((c): c is CheckKind => c === "date" || c === "location");
  return { index, checks };
}

/** The event_date answer, when it is a real calendar date. */
export function eventDateOf(def: FormDefinition, answers: Answers): string | null {
  const f = findRoleField(def, "event_date");
  const v = f ? answers[f.key] : null;
  return isCalendarDate(v) ? v : null;
}

/** Budget verdict from the budget role field (undefined when there is no budget field). */
export function budgetQualification(def: FormDefinition, answers: Answers): Qualification["budget"] | undefined {
  const field = findRoleField(def, "budget");
  if (!field) return undefined;
  const value = answers[field.key];
  if (value === undefined || value === null) return undefined;
  const outcome = budgetOutcome(field, value);
  return { passed: outcome.passed, tierId: outcome.tierId, amount: outcome.amount };
}

/** The budget label for staff copy ("$1,500 - $2,500", "Prefer not to say"). */
export function budgetLabelOf(def: FormDefinition, answers: Answers): string | null {
  const field = findRoleField(def, "budget");
  if (!field) return null;
  const value = answers[field.key];
  return value === undefined || value === null ? null : budgetOutcome(field, value).label;
}

/** The suggested date the visitor is on now, or null (they moved off it, or never picked one). */
function chosenAltDate(prev: Qualification, newDate: string | null): string | null {
  if (!newDate) return null;
  if (prev.date && newDate !== prev.date.checkedFor && (prev.date.alternatives ?? []).includes(newDate)) return newDate;
  // Credit given earlier holds only while the date stays the one it was given for (older rows
  // without altDate: the re-check after the pick stored a verdict for that very date).
  if (prev.altDateChosen && newDate === (prev.altDate ?? prev.date?.checkedFor ?? null)) return newDate;
  return null;
}

/** true when the visitor is on one of the dates we suggested (moving to another date drops it). */
export function altDateWasChosen(prev: Qualification, newDate: string | null): boolean {
  return chosenAltDate(prev, newDate) !== null;
}

/** Set or clear the suggested-date credit on `q` for the visitor's current date. */
export function applyAltDateChoice(q: Qualification, prev: Qualification, newDate: string | null): void {
  const alt = chosenAltDate(prev, newDate);
  if (alt) {
    q.altDateChosen = true;
    q.altDate = alt;
  } else {
    delete q.altDateChosen;
    delete q.altDate;
  }
}

/**
 * Checks whose input changed since they last ran (or never ran): completion re-runs exactly
 * these, so the stored verdicts always describe the final answers. `locationText` is the current
 * location answer text (LocationVerdict.query stores the text that was checked).
 */
export function staleChecks(
  q: Qualification,
  checks: CheckKind[],
  current: { date: string | null; locationText: string | null },
): CheckKind[] {
  const out: CheckKind[] = [];
  if (checks.includes("date") && (!q.date || (q.date.checkedFor ?? null) !== current.date)) out.push("date");
  if (checks.includes("location") && (!q.location || (q.location.query ?? null) !== current.locationText)) {
    out.push("location");
  }
  return out;
}

/** What the browser may see: the location verdict without staff-only miles, confidence and query. */
export function visitorQualification(q: Qualification): Qualification {
  const out: Qualification = {};
  if (q.date) out.date = { ...q.date };
  if (q.location) {
    out.location = { result: q.location.result, message: q.location.message, checkedAt: q.location.checkedAt };
  }
  if (q.altDateChosen) out.altDateChosen = true;
  return out;
}

/** The ending a finished submission already got (a second complete call returns the same one). */
export function storedEndingKind(
  stage: string,
  requested: unknown,
  settings: FormSettings,
): "completed" | "waitlisted" {
  if (stage === "waitlisted") return "waitlisted";
  if (stage === "completed") return "completed";
  return resolveEnding(requested, settings);
}

/** Celebrate only on real good news AND when the form's switch is on. */
export function celebrateFor(q: Qualification, checks: CheckKind[], settings: FormSettings): boolean {
  return Boolean(settings.qualify?.celebrate) && shouldCelebrate(q, checks);
}

/** The urgency line only under a good date answer (and never next to an out-of-area answer). */
export function urgencyFor(q: Qualification, settings: FormSettings): string | null {
  const urgency = settings.qualify?.urgency;
  if (!urgency) return null;
  const date = q.date?.result;
  if (date !== "available" && date !== "open") return null;
  if (q.location?.result === "fail") return null;
  return urgency;
}

const DATE_WORDS: Record<DateResult, string> = {
  available: "date open",
  open: "date looks open",
  limited: "date nearly full",
  unavailable: "date already booked",
  blackout: "date blocked off",
  too_soon: "date too soon",
  unknown: "date needs a manual check",
  skipped: "no date checked",
};

const LOCATION_WORDS: Record<LocationResult, string> = {
  pass: "in our home area",
  risky: "travel fee zone",
  talk: "outside our usual area",
  fail: "outside our service area",
  unverified: "location not verified",
  skipped: "location not checked",
};

/** Staff-facing words for a date verdict. */
export function dateResultWords(result: DateResult): string {
  return DATE_WORDS[result] ?? String(result);
}

/** Staff-facing words for a location verdict. */
export function locationResultWords(result: LocationResult): string {
  return LOCATION_WORDS[result] ?? String(result);
}

function sentence(words: string): string {
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
}

/** One staff line: "Fit: high (80). Date open. Travel fee zone, about 72 mi. Budget: $1,500 - $2,500." */
export function qualificationSummaryLine(input: {
  qualification: Qualification;
  score: number | null;
  scoreLabel: ScoreLabel | null;
  budgetLabel: string | null;
}): string {
  const parts: string[] = [];
  if (input.scoreLabel) {
    parts.push(`Fit: ${input.scoreLabel}${typeof input.score === "number" ? ` (${input.score})` : ""}.`);
  }
  const date = input.qualification.date;
  if (date) parts.push(sentence(dateResultWords(date.result)));
  if (input.qualification.altDateChosen) parts.push("Picked one of our suggested dates.");
  const location = input.qualification.location;
  if (location) {
    const miles = typeof location.miles === "number" ? `, about ${Math.round(location.miles)} mi` : "";
    parts.push(sentence(`${locationResultWords(location.result)}${miles}`));
  }
  if (input.budgetLabel) parts.push(`Budget: ${input.budgetLabel}.`);
  return parts.length ? parts.join(" ") : "Not qualified automatically.";
}

/** Alert headline: "Ann Lee - Wedding on Saturday, May 15, 2027 (high fit)". */
export function inquiryHeadline(input: {
  name: string | null;
  email: string | null;
  phone: string | null;
  eventType: string | null;
  eventDate: string | null;
  scoreLabel: ScoreLabel | null;
}): string {
  const who = capped(input.name, 200) ?? capped(input.email, 320) ?? capped(input.phone, 40) ?? "Someone";
  let line = who;
  if (input.eventType) line += ` - ${input.eventType}`;
  if (isCalendarDate(input.eventDate)) line += `${input.eventType ? "" : " -"} on ${formatLongDate(input.eventDate)}`;
  if (input.scoreLabel) line += ` (${input.scoreLabel} fit)`;
  return line;
}

// ---------------------------------------------------------------------------
// Endings, links, alerts
// ---------------------------------------------------------------------------

export function endingFor(settings: FormSettings, kind: "completed" | "waitlisted"): CompleteResponse["ending"] {
  const copy = kind === "waitlisted" ? settings.waitlistThankYou : settings.thankYou;
  return {
    kind,
    title: copy?.title ?? "",
    message: copy?.message ?? "",
    redirectUrl: safeRedirectUrl(settings.redirectUrl ?? null),
  };
}

/** A waitlist ending only when the form offers the waitlist; anything else is a plain completion. */
export function resolveEnding(requested: unknown, settings: FormSettings): "completed" | "waitlisted" {
  if (requested !== "waitlisted") return "completed";
  return (settings.onDateUnavailable?.actions ?? []).includes("waitlist") ? "waitlisted" : "completed";
}

/** Hub-relative link to one submission in the admin drawer. */
export function submissionHref(formId: string, submissionId: string): string {
  return `/inquiry-forms/${encodeURIComponent(formId)}?tab=submissions&s=${encodeURIComponent(submissionId)}`;
}

/** crm_ref keys written while a CRM write is half done (client made, lead not yet). */
export const CRM_PARTIAL_KEY = "partial";

/** true once the adapter returned a complete CRM reference. */
export function crmRefDone(ref: unknown): boolean {
  if (!isPlainObject(ref)) return false;
  const keys = Object.keys(ref).filter((k) => typeof ref[k] === "string" && ref[k] !== "");
  return keys.length > 0 && ref[CRM_PARTIAL_KEY] !== "true";
}

export function newInquiryNotice(input: { headline: string; ending: "completed" | "waitlisted" }): {
  title: string;
  body: string;
} {
  return {
    title: "New website inquiry",
    body: input.ending === "waitlisted" ? `${input.headline} - joined the waitlist` : input.headline,
  };
}

export function unfinishedNotice(input: {
  who: string | null;
  email: string | null;
  phone: string | null;
  formName: string;
  stepIndex: number;
  totalSteps: number;
  stepTitle: string | null;
}): { title: string; body: string } {
  const who = capped(input.who, 200) ?? capped(input.email, 320) ?? capped(input.phone, 40) ?? "A visitor";
  const stepNo = Math.min(Math.max(1, input.stepIndex + 1), Math.max(1, input.totalSteps));
  const where = input.stepTitle ? ` (${input.stepTitle})` : "";
  const reach = [input.email, input.phone].filter(Boolean).join(" or ");
  return {
    title: "Unfinished website inquiry",
    body: `${who} stopped at step ${stepNo} of ${Math.max(1, input.totalSteps)}${where} on ${input.formName}.${
      reach ? ` Reach them at ${reach}.` : ""
    }`,
  };
}

// ---------------------------------------------------------------------------
// Request bodies (shapes from types.ts, checked by hand: no zod)
// ---------------------------------------------------------------------------

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function answersOf(raw: Record<string, unknown>): Answers {
  return isPlainObject(raw.answers) ? (raw.answers as Answers) : {};
}

function tokenOf(raw: Record<string, unknown>): string | null {
  return typeof raw.token === "string" && raw.token.length > 0 && raw.token.length <= 200 ? raw.token : null;
}

function optionalString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 ? value.slice(0, max) : null;
}

export interface StartBody {
  formSlug: string;
  answers: Answers;
  attribution: unknown;
  hp: unknown;
  elapsedMs: unknown;
  turnstileToken: string | null;
}

export function parseStartBody(raw: unknown): Parsed<StartBody> {
  if (!isPlainObject(raw)) return { ok: false, error: "The request was not understood." };
  const slug = typeof raw.formSlug === "string" ? raw.formSlug.trim() : "";
  if (!slug || slug.length > 100) return { ok: false, error: "This form link is not valid." };
  return {
    ok: true,
    value: {
      formSlug: slug,
      answers: answersOf(raw),
      attribution: raw.attribution,
      hp: raw.hp,
      elapsedMs: raw.elapsedMs,
      turnstileToken: optionalString(raw.turnstileToken, 4096),
    },
  };
}

export interface SaveBody {
  token: string;
  stepIndex: number;
  answers: Answers;
}

export function parseSaveBody(raw: unknown): Parsed<SaveBody> {
  if (!isPlainObject(raw)) return { ok: false, error: "The request was not understood." };
  const token = tokenOf(raw);
  if (!token) return { ok: false, error: "Missing form session." };
  const stepIndex = raw.stepIndex;
  if (typeof stepIndex !== "number" || !Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex > 100) {
    return { ok: false, error: "The request was not understood." };
  }
  return { ok: true, value: { token, stepIndex, answers: answersOf(raw) } };
}

export function parseTokenBody(raw: unknown): Parsed<{ token: string }> {
  if (!isPlainObject(raw)) return { ok: false, error: "The request was not understood." };
  const token = tokenOf(raw);
  return token ? { ok: true, value: { token } } : { ok: false, error: "Missing form session." };
}

export interface CompleteBody {
  token: string;
  answers: Answers;
  ending: unknown;
  turnstileToken: string | null;
}

export function parseCompleteBody(raw: unknown): Parsed<CompleteBody> {
  if (!isPlainObject(raw)) return { ok: false, error: "The request was not understood." };
  const token = tokenOf(raw);
  if (!token) return { ok: false, error: "Missing form session." };
  return {
    ok: true,
    value: { token, answers: answersOf(raw), ending: raw.ending, turnstileToken: optionalString(raw.turnstileToken, 4096) },
  };
}

/**
 * View count and admin draft check bodies: the spec names the form `slug`; the public client
 * sends `formSlug` (+ `formId`). Any of them identifies the form.
 */
export function parseSlugBody(raw: unknown): Parsed<{ slug: string | null; formId: string | null; answers: Answers }> {
  if (!isPlainObject(raw)) return { ok: false, error: "The request was not understood." };
  const rawSlug = typeof raw.slug === "string" ? raw.slug : typeof raw.formSlug === "string" ? raw.formSlug : "";
  const slug = rawSlug.trim();
  const formId = isUuid(raw.formId) ? raw.formId.toLowerCase() : null;
  if ((!slug || slug.length > 100) && !formId) return { ok: false, error: "This form link is not valid." };
  return { ok: true, value: { slug: slug && slug.length <= 100 ? slug : null, formId, answers: answersOf(raw) } };
}
