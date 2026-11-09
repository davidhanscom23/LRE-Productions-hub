/**
 * Inquiry Forms - answer whitelisting, coercion, merging and the ONE formatter.
 *
 * PURE module: the server runs sanitizeStepAnswers -> mergeAnswers -> stripHidden on every save,
 * and every human-facing rendering of answers (CRM record, staff email, confirmation email,
 * admin detail) goes through formatAnswerLines / answerDisplay so labels and values always agree.
 *
 * Stored answer shapes (types.ts): text-like and choice answers are strings, multi-select
 * checkboxes string[], consent checkboxes true, numbers numbers, dates "YYYY-MM-DD", times "HH:MM",
 * budgets BudgetAnswer. Companions: `${key}__other` (Other detail), `${key}__end` (end time).
 */

import type {
  AnswerValue,
  Answers,
  BudgetAnswer,
  BudgetTier,
  CrmSummary,
  FieldDef,
  FieldRole,
  FormDefinition,
  Qualification,
  ScoreLabel,
} from "./types";
import {
  MAX_TEXT_LENGTH,
  allFields,
  endKey,
  fieldChoices,
  findRoleField,
  isMultiCheckbox,
  otherChoice,
  otherKey,
} from "./definition";
import { isFieldVisible } from "./visibility";
import { formatLongDate, formatTime12, isValidDateString, normalizeTimeString } from "./dates";

/** Every text answer is capped here (same as MAX_TEXT_LENGTH in definition.ts). */
export const TEXT_MAX = MAX_TEXT_LENGTH;
/** Largest absolute number or budget amount accepted (fits Postgres int4 for guest counts). */
export const NUMBER_MAX = 1e9;
/** How a skipped budget reads everywhere. */
export const BUDGET_SKIP_LABEL = "Prefer not to say";

/** Keys that must never be copied onto a plain object (prototype pollution). */
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

type Raw = Record<string, unknown>;

function isRecord(v: unknown): v is Raw {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function own(obj: unknown, key: string): unknown {
  if (!isRecord(obj)) return undefined;
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

// ===========================================================================
// Coercion helpers (also used by validation.ts so client and server agree)
// ===========================================================================

/**
 * Remove characters Postgres jsonb or a single-line input cannot hold: NUL and other control
 * characters, lone UTF-16 surrogates; CRLF/CR become LF. Single-line text turns line breaks and
 * tabs into spaces.
 */
function scrubChars(s: string, multiline: boolean): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += s[i] + s[i + 1];
        i += 1;
      }
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue;
    if (c === 0x0d) {
      if (i + 1 < s.length && s.charCodeAt(i + 1) === 0x0a) continue;
      out += multiline ? "\n" : " ";
      continue;
    }
    if (c === 0x0a || c === 0x2028 || c === 0x2029) {
      out += multiline ? "\n" : " ";
      continue;
    }
    if (c === 0x09) {
      out += multiline ? "\t" : " ";
      continue;
    }
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) continue;
    out += s[i];
  }
  return out;
}

/** Drop a dangling high surrogate left by a slice. */
function dropTrailingHighSurrogate(s: string): string {
  if (!s) return s;
  const c = s.charCodeAt(s.length - 1);
  return c >= 0xd800 && c <= 0xdbff ? s.slice(0, -1) : s;
}

/** Clean visitor text: safe characters only, trimmed, whitespace tidied, capped at `max`. */
export function cleanText(input: string, multiline: boolean, max: number = TEXT_MAX): string {
  if (typeof input !== "string") return "";
  let s = scrubChars(input.length > max * 2 + 64 ? input.slice(0, max * 2 + 64) : input, multiline);
  if (multiline) {
    s = s
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/g, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
  } else {
    s = s.replace(/ {2,}/g, " ");
  }
  s = s.trim();
  if (s.length > max) s = dropTrailingHighSurrogate(s.slice(0, max)).trimEnd();
  return s;
}

/** A trimmed string from a string or finite number; anything else is "". */
export function asText(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/**
 * A number from a number or numeric string ("1,200", "$2,500" allowed).
 * null = nothing given (null, undefined, blank); NaN = given but not a number.
 */
export function asNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "string") {
    const t = v.trim().replace(/[$,\s]/g, "");
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

/** true for true, "true", "on", "yes", "1" and 1 (how checkboxes arrive from different clients). */
export function asBoolean(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (typeof v === "string") return ["true", "on", "yes", "1"].includes(v.trim().toLowerCase());
  return false;
}

/** "$2,500" (whole dollars). */
export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function textOrNull(raw: unknown, multiline: boolean): string | null {
  const s = typeof raw === "string" ? raw : typeof raw === "number" && Number.isFinite(raw) ? String(raw) : "";
  const cleaned = cleanText(s, multiline);
  return cleaned ? cleaned : null;
}

function isChoicePicked(value: AnswerValue | undefined, choiceValue: string): boolean {
  if (typeof value === "string") return value === choiceValue;
  if (Array.isArray(value)) return value.includes(choiceValue);
  return false;
}

function coerceBudget(field: FieldDef, raw: unknown): BudgetAnswer | null {
  const cfg = field.budget;
  if (!cfg) return null;
  // Legacy LeadGate shape: a bare tier id string.
  const v: unknown = typeof raw === "string" && raw.trim() ? { type: "tier", tierId: raw } : raw;
  if (!isRecord(v)) return null;
  if (v.type === "skip") return cfg.allowSkip ? { type: "skip" } : null;
  if (v.type === "tier") {
    const id = asText(v.tierId);
    if (cfg.mode !== "tiers" || !id) return null;
    return (cfg.tiers ?? []).some((t) => t.id === id) ? { type: "tier", tierId: id } : null;
  }
  if (v.type === "amount") {
    const n = asNumberOrNull(v.amount);
    if (n === null || !Number.isFinite(n) || n < 0 || n > NUMBER_MAX) return null;
    return { type: "amount", amount: Math.round(n) };
  }
  return null;
}

/** Coerce one raw answer to the stored shape for `field`; null when empty or not acceptable. */
function coerceAnswer(field: FieldDef, raw: unknown): AnswerValue {
  switch (field.type) {
    case "text":
    case "address":
    case "phone":
      return textOrNull(raw, false);
    case "textarea":
      return textOrNull(raw, true);
    case "email": {
      const s = textOrNull(raw, false);
      return s ? s.toLowerCase() : null;
    }
    case "date": {
      const s = asText(raw);
      return isValidDateString(s) ? s : null;
    }
    case "time":
      return normalizeTimeString(asText(raw));
    case "number": {
      const n = asNumberOrNull(raw);
      if (n === null || !Number.isFinite(n) || Math.abs(n) > NUMBER_MAX) return null;
      return field.role === "guest_count" ? Math.round(n) : Math.round(n * 100) / 100;
    }
    case "select":
    case "radio":
    case "contact_preference": {
      const s = asText(raw);
      return s && fieldChoices(field).some((c) => c.value === s) ? s : null;
    }
    case "checkbox": {
      if (!isMultiCheckbox(field)) return asBoolean(raw) ? true : null;
      const list = Array.isArray(raw) ? raw : raw === null || raw === undefined ? [] : [raw];
      const picked = new Set(list.map((v) => asText(v)).filter((v) => v.length > 0));
      const ordered = fieldChoices(field)
        .map((c) => c.value)
        .filter((v) => picked.has(v));
      return ordered.length > 0 ? ordered : null;
    }
    case "budget":
      return coerceBudget(field, raw);
    default:
      return null;
  }
}

// ===========================================================================
// Whitelist, merge, strip
// ===========================================================================

/** Every answer key the definition can produce: answer-field keys plus their companions. */
export function allowedKeys(def: FormDefinition): Set<string> {
  const keys = new Set<string>();
  for (const f of allFields(def)) {
    if (f.type === "content" || !f.key) continue;
    keys.add(f.key);
    if (otherChoice(f)) keys.add(otherKey(f.key));
    if (f.type === "time" && f.showEndTime) keys.add(endKey(f.key));
  }
  return keys;
}

/**
 * Whitelist + coerce + trim + cap the answers of ONE step (index `stepIndex`).
 * Returns an entry for EVERY answer key of that step (plus its companions): the coerced value, or
 * null when the visitor left it empty or sent something unusable. Keys of other steps, unknown
 * keys and internal keys (tokens, honeypot, timings) are dropped. Merge the result with
 * mergeAnswers (null deletes), so re-saving a step replaces that step's answers as a whole.
 * A qualify step or an out-of-range index gives {}.
 */
export function sanitizeStepAnswers(def: FormDefinition, stepIndex: number, incoming: Answers): Answers {
  const out: Answers = {};
  if (!Number.isInteger(stepIndex) || stepIndex < 0) return out;
  const step = def?.steps?.[stepIndex];
  if (!step || step.kind !== "fields") return out;
  const src: unknown = incoming;
  for (const field of step.fields ?? []) {
    if (field.type === "content" || !field.key) continue;
    const value = coerceAnswer(field, own(src, field.key));
    out[field.key] = value;
    const other = otherChoice(field);
    if (other) {
      const picked = value !== null && isChoicePicked(value, other.value);
      out[otherKey(field.key)] = picked ? textOrNull(own(src, otherKey(field.key)), false) : null;
    }
    if (field.type === "time" && field.showEndTime) {
      out[endKey(field.key)] = value === null ? null : normalizeTimeString(asText(own(src, endKey(field.key))));
    }
  }
  return out;
}

/** prev + patch. A null/undefined value in the patch deletes the key; nulls in prev are dropped. */
export function mergeAnswers(prev: Answers, patch: Answers): Answers {
  const out: Answers = {};
  if (isRecord(prev)) {
    for (const k of Object.keys(prev)) {
      if (UNSAFE_KEYS.has(k)) continue;
      const v = prev[k];
      if (v !== null && v !== undefined) out[k] = v;
    }
  }
  if (isRecord(patch)) {
    for (const k of Object.keys(patch)) {
      if (UNSAFE_KEYS.has(k)) continue;
      const v = patch[k];
      if (v === null || v === undefined) delete out[k];
      else out[k] = v;
    }
  }
  return out;
}

/**
 * Remove answers the visitor cannot see or that do not belong: unknown keys (not in
 * allowedKeys), answers of fields hidden by their condition (evaluated in form order, so chains
 * resolve), an Other detail whose Other option is not picked, and an end time without a start.
 */
export function stripHidden(def: FormDefinition, answers: Answers): Answers {
  const allowed = allowedKeys(def);
  const working: Answers = {};
  if (isRecord(answers)) {
    for (const k of Object.keys(answers)) {
      if (!allowed.has(k) || UNSAFE_KEYS.has(k)) continue;
      const v = answers[k];
      if (v !== null && v !== undefined) working[k] = v;
    }
  }
  for (const field of allFields(def)) {
    if (field.type === "content" || !field.key) continue;
    if (!isFieldVisible(field, working)) {
      delete working[field.key];
      delete working[otherKey(field.key)];
      delete working[endKey(field.key)];
      continue;
    }
    const other = otherChoice(field);
    if (other && !isChoicePicked(working[field.key], other.value)) delete working[otherKey(field.key)];
    if (field.type === "time" && working[field.key] === undefined) delete working[endKey(field.key)];
  }
  return working;
}

// ===========================================================================
// Display
// ===========================================================================

function tierForAmount(tiers: BudgetTier[], amount: number): BudgetTier | null {
  return (
    tiers.find(
      (t) => (t.min === null || t.min === undefined || amount >= t.min) && (t.max === null || t.max === undefined || amount <= t.max),
    ) ?? null
  );
}

function finiteOrNull(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * What a budget answer means. passed: true (acceptable), false (below what the business usually
 * does), null (skipped or no answer). label: tier label, "$2,500", or "Prefer not to say".
 * low: tier low bound or the amount (for CRM budget columns).
 */
export function budgetOutcome(
  field: FieldDef,
  value: AnswerValue,
): { passed: boolean | null; tierId: string | null; amount: number | null; label: string | null; low: number | null } {
  const none = { passed: null, tierId: null, amount: null, label: null, low: null };
  const cfg = field?.type === "budget" ? field.budget : undefined;
  if (!cfg) return none;
  const v: unknown = typeof value === "string" && value.trim() ? { type: "tier", tierId: value.trim() } : value;
  if (!isRecord(v)) return none;
  if (v.type === "skip") return { passed: null, tierId: null, amount: null, label: BUDGET_SKIP_LABEL, low: null };
  if (v.type === "tier") {
    const id = asText(v.tierId);
    const tier = (cfg.tiers ?? []).find((t) => t.id === id);
    if (!tier) return none;
    return { passed: tier.acceptable !== false, tierId: tier.id, amount: null, label: tier.label, low: finiteOrNull(tier.min) };
  }
  if (v.type === "amount") {
    const n = asNumberOrNull(v.amount);
    if (n === null || !Number.isFinite(n) || n < 0) return none;
    const amount = Math.round(n);
    let passed = true;
    if (typeof cfg.minimum === "number" && Number.isFinite(cfg.minimum)) {
      passed = amount >= cfg.minimum;
    } else if (cfg.mode === "tiers") {
      const tier = tierForAmount(cfg.tiers ?? [], amount);
      passed = tier ? tier.acceptable !== false : true;
    }
    return { passed, tierId: null, amount, label: formatMoney(amount), low: amount };
  }
  return none;
}

function choiceDisplay(field: FieldDef, value: string, answers: Answers): string {
  const choice = fieldChoices(field).find((c) => c.value === value);
  if (!choice) return value;
  if (choice.isOther) {
    const detail = asText(own(answers, otherKey(field.key)));
    if (detail) return `Other: ${detail}`;
  }
  return choice.label || value;
}

/**
 * One field's answer as people read it, or null when there is nothing to show:
 * option labels (Other detail as "Other: <text>"), multi values joined with ", ", long dates,
 * 12 h times ("6:00 PM - 11:00 PM"), budget tier label / "$2,500" / "Prefer not to say",
 * consent "Yes". Content blocks give null.
 */
export function answerDisplay(field: FieldDef, answers: Answers): string | null {
  if (!field || field.type === "content" || !field.key) return null;
  const v = own(answers, field.key) as AnswerValue | undefined;
  switch (field.type) {
    case "text":
    case "textarea":
    case "address":
    case "email":
    case "phone": {
      const s = asText(v);
      return s || null;
    }
    case "number": {
      const n = asNumberOrNull(v);
      return n === null || !Number.isFinite(n) ? null : formatNumber(n);
    }
    case "date": {
      const s = asText(v);
      if (!s) return null;
      return isValidDateString(s) ? formatLongDate(s) : s;
    }
    case "time": {
      const start = normalizeTimeString(asText(v));
      if (!start) return null;
      const end = field.showEndTime ? normalizeTimeString(asText(own(answers, endKey(field.key)))) : null;
      return end ? `${formatTime12(start)} - ${formatTime12(end)}` : formatTime12(start);
    }
    case "select":
    case "radio":
    case "contact_preference": {
      const s = asText(v);
      return s ? choiceDisplay(field, s, answers) : null;
    }
    case "checkbox": {
      if (!isMultiCheckbox(field)) return v === true || asBoolean(v) ? "Yes" : null;
      const list = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
      const shown = list
        .map((x) => asText(x))
        .filter((x) => x.length > 0)
        .map((x) => choiceDisplay(field, x, answers));
      return shown.length > 0 ? shown.join(", ") : null;
    }
    case "budget":
      return budgetOutcome(field, (v ?? null) as AnswerValue).label;
    default:
      return null;
  }
}

function lineLabel(field: FieldDef): string {
  const label = (field.label ?? "").replace(/\s+/g, " ").trim().replace(/[\s:]+$/g, "");
  return label || field.key;
}

/** "Label: value" lines in form order, hidden and empty answers skipped. The ONE formatter. */
export function formatAnswerLines(def: FormDefinition, answers: Answers): string[] {
  const visible = stripHidden(def, answers);
  const lines: string[] = [];
  for (const field of allFields(def)) {
    if (field.type === "content") continue;
    const shown = answerDisplay(field, visible);
    if (shown === null || shown === "") continue;
    lines.push(`${lineLabel(field)}: ${shown}`);
  }
  return lines;
}

/**
 * Everything the hub CRM adapter needs, read through field ROLES (never magic keys).
 * name falls back to company, email, phone, then "Website inquiry" so a CRM row always has one.
 * Dates stay "YYYY-MM-DD", times "HH:MM" (24 h); guestCount only for a Number field.
 * `q` is accepted for the adapter's convenience; verdicts are not part of CrmSummary.
 */
export function buildCrmSummary(
  def: FormDefinition,
  answers: Answers,
  q: Qualification,
  ending: CrmSummary["ending"],
  scoreLabel: ScoreLabel | null,
): CrmSummary {
  void q;
  const a = stripHidden(def, answers);
  const fieldOf = (role: FieldRole): FieldDef | null => findRoleField(def, role);
  const displayOf = (role: FieldRole): string | null => {
    const f = fieldOf(role);
    return f ? answerDisplay(f, a) : null;
  };
  const rawOf = (role: FieldRole): unknown => {
    const f = fieldOf(role);
    return f ? own(a, f.key) : undefined;
  };

  const emailRaw = asText(rawOf("email"));
  const email = emailRaw ? emailRaw.toLowerCase() : null;
  const phone = asText(rawOf("phone")) || null;
  const company = displayOf("company");

  const dateRaw = asText(rawOf("event_date"));
  const eventDate = isValidDateString(dateRaw) ? dateRaw : null;

  const timeField = fieldOf("event_time");
  const eventTimeStart = timeField ? normalizeTimeString(asText(own(a, timeField.key))) : null;
  const eventTimeEnd =
    timeField && eventTimeStart && timeField.showEndTime
      ? normalizeTimeString(asText(own(a, endKey(timeField.key))))
      : null;

  const guestField = fieldOf("guest_count");
  let guestCount: number | null = null;
  if (guestField?.type === "number") {
    const n = asNumberOrNull(own(a, guestField.key));
    if (n !== null && Number.isFinite(n) && n >= 0 && n <= NUMBER_MAX) guestCount = Math.round(n);
  }

  const servicesField = fieldOf("services");
  let services: string[] = [];
  if (servicesField) {
    const raw = own(a, servicesField.key);
    const values = Array.isArray(raw) ? raw : typeof raw === "string" && raw.trim() ? [raw] : [];
    services = values
      .map((x) => asText(x))
      .filter((x) => x.length > 0)
      .map((x) => choiceDisplay(servicesField, x, a));
  }

  const budgetField = fieldOf("budget");
  const budget = budgetField ? budgetOutcome(budgetField, (own(a, budgetField.key) ?? null) as AnswerValue) : null;

  const name = displayOf("name") || company || email || phone || "Website inquiry";

  return {
    name,
    email,
    phone,
    company,
    eventType: displayOf("event_type"),
    eventDate,
    eventTimeStart,
    eventTimeEnd,
    eventLocation: displayOf("event_location"),
    guestCount,
    guestLabel: displayOf("guest_count"),
    services,
    budgetLabel: budget?.label ?? null,
    budgetLow: budget?.low ?? null,
    referral: displayOf("referral_source"),
    contactPreference: displayOf("contact_preference"),
    notes: displayOf("notes"),
    scoreLabel,
    ending,
  };
}
