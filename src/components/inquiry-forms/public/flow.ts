/**
 * Inquiry Forms public renderer - pure step-flow helpers (no React, no DOM).
 *
 * Everything the FormRenderer decides that is not rendering lives here so it can be tested:
 * which answers a step sends, button and progress labels, the qualify cache key, result tones,
 * the "date unavailable" action list, client validation filtering and server error routing.
 */
import type {
  Answers,
  AnswerValue,
  CompleteResponse,
  DateResult,
  DateUnavailableAction,
  DateVerdict,
  FieldDef,
  FormDefinition,
  LocationResult,
  PublicFormSettings,
  Qualification,
  StepDef,
} from "@/lib/inquiry-forms/types";
import { findRoleField, stepIndexOfField } from "@/lib/inquiry-forms/definition";
import { isFieldVisible, visibleFields } from "@/lib/inquiry-forms/visibility";
import { validateField, validateStep } from "@/lib/inquiry-forms/validation";
import { budgetOutcome } from "@/lib/inquiry-forms/answers";

export const OTHER_SUFFIX = "__other";
export const END_SUFFIX = "__end";

export type Ending = CompleteResponse["ending"];

/** The part of a QualifyResponse the renderer keeps (and caches per qualify step). */
export interface QualifyResult {
  qualification: Qualification;
  celebrate: boolean;
  urgency: string | null;
}

export function hasOtherChoice(field: FieldDef): boolean {
  return (field.choices ?? []).some((c) => c.isOther === true);
}

/** True when the current answer of a choice field selects (one of) its "Other" choices. */
export function otherSelected(field: FieldDef, answers: Answers): boolean {
  const others = new Set((field.choices ?? []).filter((c) => c.isOther).map((c) => c.value));
  if (others.size === 0) return false;
  const v = answers[field.key];
  if (Array.isArray(v)) return v.some((x) => others.has(x));
  return typeof v === "string" && others.has(v);
}

function isEmptyValue(v: AnswerValue | undefined): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/**
 * Answers one step sends to the server: every VISIBLE answerable field of the step (null when empty, so a
 * cleared answer is cleared server-side too) plus its companions (`__other` only while an Other choice is
 * selected, `__end` for time fields that collect an end time). Hidden fields are never sent.
 */
export function stepPayload(step: StepDef, answers: Answers): Answers {
  const out: Answers = {};
  if (step.kind !== "fields") return out;
  for (const f of visibleFields(step, answers)) {
    if (f.type === "content") continue;
    const v = answers[f.key];
    out[f.key] = isEmptyValue(v) ? null : (v as AnswerValue);
    if (hasOtherChoice(f)) {
      const ok = `${f.key}${OTHER_SUFFIX}`;
      const other = answers[ok];
      out[ok] = otherSelected(f, answers) && typeof other === "string" && other.trim() ? other : null;
    }
    if (f.type === "time" && f.showEndTime) {
      const ek = `${f.key}${END_SUFFIX}`;
      const end = answers[ek];
      out[ek] = typeof end === "string" && end ? end : null;
    }
  }
  return out;
}

/** Field keys (plus companions) that are visible on a step right now. */
export function visibleKeys(step: StepDef, answers: Answers): Set<string> {
  const keys = new Set<string>();
  if (step.kind !== "fields") return keys;
  for (const f of visibleFields(step, answers)) {
    keys.add(f.key);
    keys.add(`${f.key}${OTHER_SUFFIX}`);
    keys.add(`${f.key}${END_SUFFIX}`);
  }
  return keys;
}

/**
 * Client validation for one step: the shared validator (same module the server runs), limited to visible
 * fields, plus the strict_stop budget block with the field's below-minimum message.
 */
export function stepErrors(step: StepDef, answers: Answers, today: string): Record<string, string> {
  if (step.kind !== "fields") return {};
  const allowed = visibleKeys(step, answers);
  const raw = validateStep(step, answers, { today });
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(raw)) {
    if (allowed.has(key) && message) out[key] = message;
  }
  for (const f of visibleFields(step, answers)) {
    if (out[f.key]) continue;
    const stop = strictStopError(f, answers);
    if (stop) out[f.key] = stop;
  }
  return out;
}

const STRICT_STOP_FALLBACK = "This budget is below our minimum for this service.";

/** strict_stop budget block: the field's below-minimum message when the answer is under the minimum. */
function strictStopError(field: FieldDef, answers: Answers): string | null {
  if (field.type !== "budget" || !field.budget || field.budget.policy !== "strict_stop") return null;
  const v = answers[field.key];
  if (v === undefined || v === null) return null;
  return budgetOutcome(field, v).passed === false ? field.budget.belowMessage?.trim() || STRICT_STOP_FALLBACK : null;
}

/** One field's client error (validate on blur / on commit), same rules as stepErrors. Hidden = valid. */
export function fieldErrorFor(field: FieldDef, answers: Answers, today: string): string | null {
  if (field.type === "content" || !isFieldVisible(field, answers)) return null;
  return validateField(field, answers, { today }) || strictStopError(field, answers);
}

/** The step a set of server field errors belongs to (the earliest), or the server's hint when valid. */
export function stepForFieldErrors(
  def: FormDefinition,
  fieldErrors: Record<string, string>,
  hint?: number | null,
): number | null {
  if (typeof hint === "number" && Number.isInteger(hint) && hint >= 0 && hint < def.steps.length) return hint;
  let best: number | null = null;
  for (const key of Object.keys(fieldErrors)) {
    const base = key.endsWith(OTHER_SUFFIX)
      ? key.slice(0, -OTHER_SUFFIX.length)
      : key.endsWith(END_SUFFIX)
        ? key.slice(0, -END_SUFFIX.length)
        : key;
    const idx = stepIndexOfField(def, base);
    if (idx >= 0 && (best === null || idx < best)) best = idx;
  }
  return best;
}

/** Primary button label: step override, else the check action or the next step's title, last step = submit label (or waitlist). */
export function nextLabel(
  def: FormDefinition,
  settings: Pick<PublicFormSettings, "submitLabel">,
  index: number,
  waitlist: boolean,
): string {
  const step = def.steps[index];
  const isLast = index >= def.steps.length - 1;
  if (isLast && waitlist) return "Join the waitlist";
  const override = step?.buttonText?.trim();
  if (override) return override;
  if (isLast) return settings.submitLabel?.trim() || "Send my request";
  const next = def.steps[index + 1];
  // A check step's title is a progress state ("Checking our calendar"); the button names the action.
  if (next?.kind === "qualify") return (next.checks ?? []).includes("date") ? "Check availability" : "Check my location";
  return next?.title?.trim() || "Continue";
}

export interface ProgressItem {
  index: number;
  label: string;
}

export function progressItems(def: FormDefinition): ProgressItem[] {
  return def.steps.map((s, i) => ({
    index: i,
    label: s.progressLabel?.trim() || s.title?.trim() || `Step ${i + 1}`,
  }));
}

/** Fun per-step progress caption (playful style) or null. */
export function hypeFor(settings: Pick<PublicFormSettings, "progressHype">, index: number): string | null {
  const list = settings.progressHype;
  if (!Array.isArray(list)) return null;
  const h = list[index];
  return typeof h === "string" && h.trim() ? h.trim() : null;
}

/** Cache key for a qualify result: the date and location answers it was computed for. */
export function qualifyKey(def: FormDefinition, answers: Answers): string {
  const d = findRoleField(def, "event_date");
  const l = findRoleField(def, "event_location");
  return JSON.stringify([d ? (answers[d.key] ?? null) : null, l ? (answers[l.key] ?? null) : null]);
}

export type Tone = "good" | "caution" | "bad" | "unknown";

export function dateTone(r: DateResult | null | undefined): Tone {
  switch (r) {
    case "available":
    case "open":
      return "good";
    case "limited":
      return "caution";
    case "unavailable":
    case "blackout":
    case "too_soon":
      return "bad";
    default:
      return "unknown";
  }
}

export function locationTone(r: LocationResult | null | undefined): Tone {
  switch (r) {
    case "pass":
      return "good";
    case "risky":
    case "talk":
      return "caution";
    case "fail":
      return "bad";
    default:
      return "unknown";
  }
}

/** Date results that mean "we cannot take this date as asked" (opens the unavailable dialog). */
export function isDateBlocked(r: DateResult | null | undefined): boolean {
  return r === "unavailable" || r === "blackout" || r === "too_soon";
}

const KNOWN_ACTIONS: readonly DateUnavailableAction[] = ["change_date", "alternatives", "waitlist", "continue"];

/**
 * Unavailable-date actions in settings order, de-duplicated; "alternatives" only when the server sent
 * dates to offer (never an empty list), "change_date" only when the form has a date field.
 */
export function unavailableActions(
  def: FormDefinition,
  settings: Pick<PublicFormSettings, "onDateUnavailable">,
  verdict: DateVerdict | null | undefined,
): DateUnavailableAction[] {
  const out: DateUnavailableAction[] = [];
  const hasDateField = findRoleField(def, "event_date") !== null;
  for (const a of settings.onDateUnavailable?.actions ?? []) {
    if (!KNOWN_ACTIONS.includes(a) || out.includes(a)) continue;
    if (a === "alternatives" && !(verdict?.alternatives && verdict.alternatives.length > 0)) continue;
    if (a === "change_date" && !hasDateField) continue;
    out.push(a);
  }
  return out;
}

/**
 * The text of the "date not available" dialog. The form's own message is written for a TAKEN date
 * (form Settings, "When the date is taken"); a blackout day or a date inside the minimum notice gets
 * the business message for that verdict instead (the same words the check box shows), so the dialog
 * never calls a vacation day or a too-soon date "already busy". Each falls back to the other.
 */
export function unavailableDialogMessage(
  result: DateResult,
  formMessage: string | null | undefined,
  verdictMessage: string | null | undefined,
): string {
  const form = formMessage?.trim() || "";
  const verdict = verdictMessage?.trim() || "";
  return result === "blackout" || result === "too_soon" ? verdict || form : form || verdict;
}

/** Whether Next may move past a blocked date without choosing an action. */
export function canContinuePastBlockedDate(actions: DateUnavailableAction[]): boolean {
  return actions.length === 0 || actions.includes("continue");
}

/** Local ending for preview mode (nothing is saved, so the server never answers complete). */
export function previewEnding(
  settings: Pick<PublicFormSettings, "thankYou" | "waitlistThankYou" | "redirectUrl">,
  kind: Ending["kind"],
): Ending {
  const copy = kind === "waitlisted" ? settings.waitlistThankYou : settings.thankYou;
  return {
    kind,
    title: copy?.title?.trim() || (kind === "waitlisted" ? "You're on the waitlist" : "Request received"),
    message: copy?.message?.trim() || "",
    redirectUrl: settings.redirectUrl ?? null,
  };
}

/** "$1,500" style amount (whole dollars). */
export function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

/** Host name of an absolute URL for "Taking you to ..." copy; null when unparsable. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}
