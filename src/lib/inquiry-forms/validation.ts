/**
 * Inquiry Forms - per-field and per-step answer validation.
 *
 * PURE module: the public renderer shows these messages under each field on Next, and the server
 * re-runs the same checks on every save/complete (never trust the browser). `ctx.today` is the
 * business-time-zone date ("YYYY-MM-DD", from todayInTz()) so "past date" means past in Florida.
 *
 * Hidden fields (condition false) are never validated. Messages are short, visitor-facing and
 * actionable ("Please enter your email").
 */

import type { AnswerValue, Answers, FieldDef, StepDef } from "./types";
import { MAX_TEXT_LENGTH, endKey, fieldChoices, isMultiCheckbox } from "./definition";
import { isFieldVisible } from "./visibility";
import { isPastDate, isValidDateString, normalizeTimeString } from "./dates";
import { NUMBER_MAX, asBoolean, asNumberOrNull, asText, budgetOutcome } from "./answers";

/**
 * A dot after the @ is required ("john@gmail" fails, "john@gmail.com" passes). The domain is
 * hostname characters only, and the local part refuses the characters that would turn a mailto:
 * link built from the address into extra headers (? & = % # / \ , ; : < > ( ) [ ] and quotes),
 * so a visitor cannot plant a hidden Bcc or a prefilled body in staff's email button.
 */
export const EMAIL_PATTERN = /^[^\s@?&=%#/\\,;:<>()[\]"]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
/** 7 to 20 of digits, spaces and - + ( ) . (and at least 7 digits, see isValidPhone). */
export const PHONE_PATTERN = /^[\d\s\-+().]{7,20}$/;

export const DEFAULT_BUDGET_STOP_MESSAGE =
  "That budget is below what we can usually offer. Please choose another option.";

/** True for a usable email address (max 254 characters). */
export function isValidEmail(s: string): boolean {
  if (typeof s !== "string") return false;
  const t = s.trim();
  return t.length > 0 && t.length <= 254 && EMAIL_PATTERN.test(t);
}

/** True for a plausible phone number: PHONE_PATTERN plus at least 7 digits. */
export function isValidPhone(s: string): boolean {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (!PHONE_PATTERN.test(t)) return false;
  return t.replace(/\D/g, "").length >= 7;
}

function ownValue(answers: Answers, key: string): AnswerValue | undefined {
  if (!answers || typeof answers !== "object") return undefined;
  return Object.prototype.hasOwnProperty.call(answers, key) ? answers[key] : undefined;
}

function characters(n: number): string {
  return n === 1 ? "1 character" : `${n.toLocaleString("en-US")} characters`;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function requiredMessage(field: FieldDef): string {
  if (field.role === "name") return "Please enter your name";
  switch (field.type) {
    case "email":
      return "Please enter your email";
    case "phone":
      return "Please enter your phone number";
    case "date":
      return "Please choose a date";
    case "time":
      return "Please choose a time";
    case "number":
      return "Please enter a number";
    case "address":
      return "Please enter a location";
    case "select":
    case "radio":
      return "Please choose an option";
    case "contact_preference":
      return "Please choose how we should reach you";
    case "checkbox":
      return isMultiCheckbox(field) ? "Please choose at least one option" : "Please check this box to continue";
    case "budget": {
      const what = field.budget?.mode === "slider" ? "a budget" : "a budget range";
      return field.budget?.allowSkip ? `Please choose ${what}, or skip this question` : `Please choose ${what}`;
    }
    default:
      return "Please fill this in";
  }
}

function validateBudget(field: FieldDef, value: AnswerValue | undefined): string | null {
  const cfg = field.budget;
  const v: unknown = typeof value === "string" && value.trim() ? { type: "tier", tierId: value.trim() } : value;
  if (v === null || v === undefined || typeof v !== "object" || Array.isArray(v)) {
    return field.required ? requiredMessage(field) : null;
  }
  const answer = v as { type?: unknown; tierId?: unknown; amount?: unknown };
  if (answer.type === "skip") {
    if (cfg?.allowSkip) return null;
    return field.required ? requiredMessage(field) : null;
  }
  if (answer.type === "tier") {
    const id = asText(answer.tierId);
    if (!cfg || cfg.mode !== "tiers" || !(cfg.tiers ?? []).some((t) => t.id === id)) {
      return "Please choose one of the budget options";
    }
  } else if (answer.type === "amount") {
    const n = asNumberOrNull(answer.amount);
    if (n === null || !Number.isFinite(n) || n < 0) return "Please enter a budget amount";
    if (n > NUMBER_MAX) return "Please enter a smaller amount";
  } else {
    return field.required ? requiredMessage(field) : "Please choose one of the budget options";
  }
  if (cfg?.policy === "strict_stop") {
    const outcome = budgetOutcome(field, v as AnswerValue);
    if (outcome.passed === false) return cfg.belowMessage?.trim() || DEFAULT_BUDGET_STOP_MESSAGE;
  }
  return null;
}

/**
 * The first problem with `field`'s answer, or null when it is fine (or hidden, or a content block).
 */
export function validateField(field: FieldDef, answers: Answers, ctx: { today: string }): string | null {
  if (!field || field.type === "content" || !field.key) return null;
  if (!isFieldVisible(field, answers)) return null;
  const value = ownValue(answers, field.key);

  switch (field.type) {
    case "text":
    case "textarea":
    case "address": {
      const s = asText(value);
      if (!s) return field.required ? requiredMessage(field) : null;
      const max = Math.min(field.maxLength ?? MAX_TEXT_LENGTH, MAX_TEXT_LENGTH);
      if (field.minLength && s.length < field.minLength) return `Please enter at least ${characters(field.minLength)}`;
      if (s.length > max) return `Please keep this to ${characters(max)} or fewer`;
      return null;
    }
    case "email": {
      const s = asText(value);
      if (!s) return field.required ? requiredMessage(field) : null;
      return isValidEmail(s) ? null : "Please enter a valid email address";
    }
    case "phone": {
      const s = asText(value);
      if (!s) return field.required ? requiredMessage(field) : null;
      return isValidPhone(s) ? null : "Please enter a valid phone number";
    }
    case "date": {
      const s = asText(value);
      if (!s) return field.required ? requiredMessage(field) : null;
      if (!isValidDateString(s)) return "Please choose a valid date";
      if (isPastDate(s, ctx?.today)) return "That date has passed. Please choose an upcoming date";
      return null;
    }
    case "time": {
      const start = asText(value);
      const end = field.showEndTime ? asText(ownValue(answers, endKey(field.key))) : "";
      if (!start) {
        if (end) return "Please choose a start time";
        return field.required ? requiredMessage(field) : null;
      }
      const s = normalizeTimeString(start);
      if (!s) return "Please choose a valid time";
      if (end) {
        const e = normalizeTimeString(end);
        if (!e) return "Please choose a valid end time";
        if (e === s) return "The end time must be different from the start time";
      }
      return null;
    }
    case "number": {
      const n = asNumberOrNull(value);
      if (n === null) return field.required ? requiredMessage(field) : null;
      if (!Number.isFinite(n)) return "Please enter a number";
      if (Math.abs(n) > NUMBER_MAX) return "Please enter a smaller number";
      if (field.role === "guest_count" && !Number.isInteger(n)) return "Please enter a whole number";
      const min = typeof field.min === "number" ? field.min : field.role === "guest_count" ? 0 : null;
      if (min !== null && n < min) return `Please enter ${fmt(min)} or more`;
      if (typeof field.max === "number" && n > field.max) return `Please enter ${fmt(field.max)} or less`;
      return null;
    }
    case "select":
    case "radio":
    case "contact_preference": {
      const s = asText(value);
      if (!s) return field.required ? requiredMessage(field) : null;
      return fieldChoices(field).some((c) => c.value === s) ? null : "Please choose one of the options";
    }
    case "checkbox": {
      if (isMultiCheckbox(field)) {
        const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
        const picked = list.map((v) => asText(v)).filter((v) => v.length > 0);
        if (picked.length === 0) return field.required ? requiredMessage(field) : null;
        const allowed = new Set(fieldChoices(field).map((c) => c.value));
        return picked.every((v) => allowed.has(v)) ? null : "Please choose from the options shown";
      }
      if (!asBoolean(value)) return field.required ? requiredMessage(field) : null;
      return null;
    }
    case "budget":
      return validateBudget(field, value);
    default:
      return null;
  }
}

/**
 * Errors for every visible field of a step, keyed by field key ({} when the step is fine or is a
 * qualify step). Visibility is evaluated progressively, like visibleFields().
 */
export function validateStep(step: StepDef, answers: Answers, ctx: { today: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!step || step.kind !== "fields") return errors;
  const working: Answers = { ...(answers ?? {}) };
  for (const field of step.fields ?? []) {
    if (!isFieldVisible(field, working)) {
      delete working[field.key];
      delete working[`${field.key}__other`];
      delete working[`${field.key}__end`];
      continue;
    }
    const message = validateField(field, working, ctx);
    if (message) errors[field.key] = message;
  }
  return errors;
}
