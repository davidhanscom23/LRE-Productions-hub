/**
 * Inquiry Forms - form definition helpers and the definition validator.
 *
 * PURE module: no server-only imports, safe in client components, route handlers and vitest.
 *
 * validateDefinition() is the single gate for anything that becomes a published definition
 * (builder publish, presets, imports). It returns a NORMALIZED copy: trimmed strings, only
 * known properties per field type, generated ids/keys where they were missing.
 */

import {
  FIELD_ROLES,
  FIELD_TYPES,
  ROLE_FIELD_TYPES,
  type BudgetConfig,
  type BudgetTier,
  type CheckKind,
  type Choice,
  type FieldDef,
  type FieldRole,
  type FieldType,
  type FormDefinition,
  type ShowIf,
  type StepDef,
} from "./types";
import { asciiFold } from "./slug";

// ===========================================================================
// Limits and naming rules
// ===========================================================================

export const MAX_STEPS = 20;
export const MAX_FIELDS = 60;
export const MAX_CHOICES = 100;
export const MAX_BUDGET_TIERS = 20;
/** Hard cap for any text answer (answers.ts truncates to this; maxLength may not exceed it). */
export const MAX_TEXT_LENGTH = 2000;
export const KEY_MAX_LENGTH = 48;
/** Field keys: lowercase letter first, then lowercase letters, digits, underscores (48 max). */
export const KEY_PATTERN = /^[a-z][a-z0-9_]{0,47}$/;
export const OTHER_SUFFIX = "__other";
export const END_SUFFIX = "__end";
/**
 * DOM name of the off-screen honeypot input on the public form's first step. Deliberately
 * meaningless: browser autofill matches field names such as "company" or "website", and an
 * autofilled trap would silently mark a real visitor as spam. The request body key stays `hp`.
 */
export const HONEYPOT_INPUT_NAME = "inqf_hp_x";

/**
 * Keys a field may not use: object built-ins, and the honeypot input name, so a real field
 * never shares a name with the spam trap.
 */
export const RESERVED_KEYS: ReadonlySet<string> = new Set(["constructor", "prototype", HONEYPOT_INPUT_NAME]);

const MAX_ERRORS = 50;
const SHOW_IF_OPS: readonly ShowIf["op"][] = ["equals", "not_equals", "includes", "not_includes", "answered"];

/** Staff-facing names of field types (builder palette, error messages). */
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Short text",
  email: "Email",
  phone: "Phone",
  date: "Date",
  time: "Time",
  address: "Address",
  textarea: "Long text",
  select: "Dropdown",
  radio: "Multiple choice",
  checkbox: "Checkboxes",
  number: "Number",
  budget: "Budget",
  contact_preference: "Contact preference",
  content: "Text block",
};

/** Staff-facing names of field roles. */
export const FIELD_ROLE_LABELS: Record<FieldRole, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  company: "Company",
  event_date: "Event date",
  event_time: "Event time",
  event_location: "Event location",
  guest_count: "Guest count",
  event_type: "Event type",
  services: "Services",
  budget: "Budget",
  contact_preference: "Contact preference",
  referral_source: "Referral source",
  notes: "Notes",
};

/**
 * The fixed options of every `contact_preference` field (values from LeadGate: email | text | phone).
 * A contact_preference field never carries its own choices; validateDefinition strips them.
 */
export const CONTACT_PREFERENCE_CHOICES: readonly Choice[] = Object.freeze([
  Object.freeze({ value: "email", label: "Email" }),
  Object.freeze({ value: "text", label: "Text message" }),
  Object.freeze({ value: "phone", label: "Phone call" }),
]);

// ===========================================================================
// Small field helpers (shared by visibility, validation, answers and the UIs)
// ===========================================================================

/** Answer key of the free-text box behind an "Other" option. */
export function otherKey(key: string): string {
  return `${key}${OTHER_SUFFIX}`;
}

/** Answer key of a time field's end time. */
export function endKey(key: string): string {
  return `${key}${END_SUFFIX}`;
}

/** "event_time__end" -> "event_time"; a plain key is returned unchanged. */
export function baseKey(answerKey: string): string {
  if (answerKey.endsWith(OTHER_SUFFIX)) return answerKey.slice(0, -OTHER_SUFFIX.length);
  if (answerKey.endsWith(END_SUFFIX)) return answerKey.slice(0, -END_SUFFIX.length);
  return answerKey;
}

/** Content blocks show text and never hold an answer. */
export function isAnswerField(field: FieldDef): boolean {
  return field.type !== "content";
}

/** A checkbox field with options is a multi-select (answer: string[]). */
export function isMultiCheckbox(field: FieldDef): boolean {
  return field.type === "checkbox" && Array.isArray(field.choices) && field.choices.length > 0;
}

/** A checkbox field without options is a single consent box (answer: true). */
export function isConsentCheckbox(field: FieldDef): boolean {
  return field.type === "checkbox" && !isMultiCheckbox(field);
}

/** The options a visitor can pick from (contact_preference uses CONTACT_PREFERENCE_CHOICES). */
export function fieldChoices(field: FieldDef): readonly Choice[] {
  if (field.type === "contact_preference") return CONTACT_PREFERENCE_CHOICES;
  if (field.type === "select" || field.type === "radio" || field.type === "checkbox") {
    return Array.isArray(field.choices) ? field.choices : [];
  }
  return [];
}

/** The field's "Other" option (select, radio or checkbox), or null. */
export function otherChoice(field: FieldDef): Choice | null {
  if (field.type !== "select" && field.type !== "radio" && field.type !== "checkbox") return null;
  return fieldChoices(field).find((c) => c.isOther === true) ?? null;
}

// ===========================================================================
// Ids, keys, lookups
// ===========================================================================

/** A random UUID v4 (crypto.randomUUID when available, also works on insecure http pages). */
export function newId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") {
    try {
      return c.randomUUID();
    } catch {
      // randomUUID throws outside secure contexts in some browsers; fall through.
    }
  }
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function trimKey(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max).replace(/_+$/g, "");
}

/**
 * A valid, unused field key from a label: "Guest count" -> "guest_count", "Photo Booth" -> "photo_booth".
 * Never contains "__", never reserved, never in `taken` (adds "_2", "_3"...). Does NOT add the result
 * to `taken`; the caller does. Also used for preset choice values, so it must stay stable.
 */
export function keyFromLabel(label: string, taken: Set<string>): string {
  let base = asciiFold(typeof label === "string" ? label : "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!base) base = "field";
  if (!/^[a-z]/.test(base)) base = `field_${base}`;
  base = trimKey(base, KEY_MAX_LENGTH);
  let key = base;
  let n = 2;
  while (taken.has(key) || RESERVED_KEYS.has(key)) {
    const suffix = `_${n}`;
    key = `${trimKey(base, KEY_MAX_LENGTH - suffix.length)}${suffix}`;
    n += 1;
  }
  return key;
}

/** Every field of every step, in form order (content blocks included). */
export function allFields(def: FormDefinition): FieldDef[] {
  const out: FieldDef[] = [];
  for (const step of def?.steps ?? []) for (const f of step?.fields ?? []) out.push(f);
  return out;
}

/** The field holding `role`, or null (roles are unique in a valid definition). */
export function findRoleField(def: FormDefinition, role: FieldRole): FieldDef | null {
  return allFields(def).find((f) => f.role === role) ?? null;
}

/** Index of the step holding `key` (companion keys resolve to their field), -1 when absent. */
export function stepIndexOfField(def: FormDefinition, key: string): number {
  if (typeof key !== "string" || !key) return -1;
  const wanted = baseKey(key);
  const steps = def?.steps ?? [];
  for (let i = 0; i < steps.length; i++) {
    if ((steps[i]?.fields ?? []).some((f) => f.key === wanted)) return i;
  }
  return -1;
}

/** Step 0 is a fields step with an Email- or Phone-role field (needed to follow up on partials). */
export function firstStepContactOk(def: FormDefinition): boolean {
  const first = def?.steps?.[0];
  if (!first || first.kind !== "fields") return false;
  return (first.fields ?? []).some((f) => f.role === "email" || f.role === "phone");
}

/**
 * A new form: one "Your details" step with name, phone and email. It already passes
 * validateDefinition, so a brand-new form can be previewed and published right away.
 */
export function emptyDefinition(): FormDefinition {
  return {
    version: 1,
    steps: [
      {
        id: newId(),
        kind: "fields",
        title: "Your details",
        fields: [
          { id: newId(), key: "name", type: "text", role: "name", label: "Full name", required: true, width: "half" },
          { id: newId(), key: "phone", type: "phone", role: "phone", label: "Phone", required: false, width: "half" },
          { id: newId(), key: "email", type: "email", role: "email", label: "Email", required: true, width: "full" },
        ],
      },
    ],
  };
}

/**
 * Makes any stored or edited definition safe to read and render: steps and fields are arrays of
 * objects, every step and field has a unique id, kinds and widths are known, step text is text.
 * It does NOT validate (validateDefinition and the builder checklist report problems) and keeps
 * everything else as it is, so a draft saved with problems loads back exactly as it was saved.
 * Only entries that hold no work at all are dropped (a step that is not an object, a field
 * without a type). Idempotent.
 */
export function coerceDefinition(raw: unknown): FormDefinition {
  const rec = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  const root = rec(raw);
  const rawSteps = root && Array.isArray(root.steps) ? root.steps : [];
  const seen = new Set<string>();
  const idOf = (v: unknown) => {
    let id = typeof v === "string" && v.trim() ? v.trim() : "";
    if (!id || seen.has(id)) id = newId();
    seen.add(id);
    return id;
  };
  const steps: StepDef[] = [];
  for (const rs of rawSteps) {
    const s = rec(rs);
    if (!s) continue;
    const kind: StepDef["kind"] = s.kind === "qualify" ? "qualify" : "fields";
    const fields: FieldDef[] = [];
    for (const rf of Array.isArray(s.fields) ? s.fields : []) {
      const f = rec(rf);
      if (!f || typeof f.type !== "string") continue;
      fields.push({
        ...(f as unknown as FieldDef),
        id: idOf(f.id),
        key: typeof f.key === "string" ? f.key : "",
        label: typeof f.label === "string" ? f.label : "",
        required: f.required === true,
        width: f.width === "half" ? "half" : "full",
      });
    }
    const step: StepDef = {
      ...(s as unknown as StepDef),
      id: idOf(s.id),
      kind,
      title: typeof s.title === "string" ? s.title : "",
      // Kept even on a (malformed) qualify step so a save never drops data; the validator flags it.
      fields,
    };
    for (const prop of ["description", "buttonText", "progressLabel"] as const) {
      if (step[prop] !== undefined && typeof step[prop] !== "string") delete step[prop];
    }
    if (kind === "qualify") {
      step.checks = Array.isArray(s.checks) ? (s.checks.filter((c) => c === "date" || c === "location") as CheckKind[]) : [];
    }
    steps.push(step);
  }
  return { version: 1, steps };
}

// ===========================================================================
// validateDefinition
// ===========================================================================

type Raw = Record<string, unknown>;
type Add = (message: string) => void;

interface Located {
  field: FieldDef;
  /** Index in the steps array as given (error messages say "Step n" = index + 1). */
  stepIndex: number;
  where: string;
  name: string;
}

function isRecord(v: unknown): v is Raw {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Single-line text: collapses whitespace, trims, caps. Non-strings become "". */
function oneLine(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

/** Multi-line text: trims and caps, keeps line breaks. */
function multiLine(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/\r\n?/g, "\n").trim().slice(0, max).trim();
}

/** undefined = absent, null = empty, number = finite value, NaN = not a number. */
function parseNumber(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "string") {
    const t = v.trim().replace(/[$,\s]/g, "");
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function withArticle(word: string): string {
  return /^[AEIOU]/i.test(word) ? `an ${word}` : `a ${word}`;
}

function isFieldType(v: unknown): v is FieldType {
  return typeof v === "string" && (FIELD_TYPES as readonly string[]).includes(v);
}

function isFieldRole(v: unknown): v is FieldRole {
  return typeof v === "string" && (FIELD_ROLES as readonly string[]).includes(v);
}

function normalizeChoices(raw: unknown, ctx: string, add: Add): Choice[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    add(`${ctx} has an options list that is not valid. Remove the options and add them again.`);
    return [];
  }
  if (raw.length > MAX_CHOICES) add(`${ctx} can have at most ${MAX_CHOICES} options (it has ${raw.length}).`);
  const out: Choice[] = [];
  const seen = new Set<string>();
  let others = 0;
  raw.slice(0, MAX_CHOICES).forEach((rc, ci) => {
    if (!isRecord(rc)) {
      add(`${ctx}: option ${ci + 1} is not valid.`);
      return;
    }
    const label = oneLine(rc.label, 200);
    const value =
      typeof rc.value === "number" && Number.isFinite(rc.value)
        ? String(rc.value)
        : typeof rc.value === "string"
          ? rc.value.trim().slice(0, 100)
          : "";
    if (!label) add(`${ctx}: option ${ci + 1} needs a label.`);
    if (!value) {
      add(`${ctx}: option ${label ? `'${label}'` : ci + 1} needs a value.`);
      return;
    }
    if (seen.has(value)) add(`${ctx}: two options use the value "${value}". Option values must be unique.`);
    seen.add(value);
    const choice: Choice = { value, label: label || value };
    if (rc.isOther === true) {
      choice.isOther = true;
      others += 1;
    }
    const description = oneLine(rc.description, 300);
    if (description) choice.description = description;
    out.push(choice);
  });
  if (others > 1) add(`${ctx} can have only one "Other" option.`);
  return out;
}

function normalizeShowIf(raw: unknown): ShowIf | null {
  if (!isRecord(raw)) return null;
  const fieldKey = typeof raw.fieldKey === "string" ? raw.fieldKey.trim() : "";
  const op = raw.op;
  if (!fieldKey || typeof op !== "string" || !(SHOW_IF_OPS as readonly string[]).includes(op)) return null;
  if (op === "answered") return { fieldKey, op: "answered" };
  const values: string[] = [];
  if (Array.isArray(raw.values)) {
    for (const v of raw.values) {
      const s =
        typeof v === "string" ? v.trim() : typeof v === "number" || typeof v === "boolean" ? String(v) : "";
      if (s && !values.includes(s)) values.push(s.slice(0, 100));
    }
  }
  return { fieldKey, op: op as ShowIf["op"], values: values.slice(0, 50) };
}

function normalizeBudget(raw: unknown, ctx: string, add: Add): BudgetConfig | undefined {
  if (!isRecord(raw)) {
    add(`${ctx} needs budget settings: options to pick from or a slider.`);
    return undefined;
  }
  const mode = raw.mode === "slider" ? "slider" : raw.mode === "tiers" || raw.mode === undefined ? "tiers" : null;
  if (!mode) {
    add(`${ctx} has an unknown budget mode "${String(raw.mode)}" (use options or a slider).`);
    return undefined;
  }
  const policy =
    raw.policy === "strict_stop" ? "strict_stop" : raw.policy === "label" || raw.policy === undefined ? "label" : null;
  if (!policy) add(`${ctx} has an unknown budget rule "${String(raw.policy)}".`);
  const cfg: BudgetConfig = { mode, policy: policy ?? "label" };
  if (raw.allowSkip === true) cfg.allowSkip = true;
  const below = multiLine(raw.belowMessage, 500);
  if (below) cfg.belowMessage = below;
  const minimum = parseNumber(raw.minimum);
  if (Number.isNaN(minimum) || (isNum(minimum) && minimum < 0)) {
    add(`${ctx}: the minimum budget must be a number of 0 or more.`);
  } else if (isNum(minimum)) {
    cfg.minimum = minimum;
  }

  if (mode === "tiers") {
    const rawTiers = Array.isArray(raw.tiers) ? raw.tiers : [];
    if (rawTiers.length === 0) add(`${ctx} needs at least one budget option.`);
    if (rawTiers.length > MAX_BUDGET_TIERS) {
      add(`${ctx} can have at most ${MAX_BUDGET_TIERS} budget options (it has ${rawTiers.length}).`);
    }
    const ids = new Set<string>();
    const tiers: BudgetTier[] = [];
    rawTiers.slice(0, MAX_BUDGET_TIERS).forEach((rt, ti) => {
      if (!isRecord(rt)) {
        add(`${ctx}: budget option ${ti + 1} is not valid.`);
        return;
      }
      const label = oneLine(rt.label, 100);
      if (!label) add(`${ctx}: budget option ${ti + 1} needs a label.`);
      let id = typeof rt.id === "string" ? rt.id.trim().slice(0, 100) : "";
      if (!id) id = keyFromLabel(label || `option ${ti + 1}`, ids);
      if (ids.has(id)) add(`${ctx}: two budget options use the id "${id}".`);
      ids.add(id);
      const min = parseNumber(rt.min);
      const max = parseNumber(rt.max);
      const tierName = label ? `'${label}'` : String(ti + 1);
      if (Number.isNaN(min) || Number.isNaN(max) || (isNum(min) && min < 0) || (isNum(max) && max < 0)) {
        add(`${ctx}: budget option ${tierName} has an amount that is not a number of 0 or more.`);
      }
      const low = isNum(min) && min >= 0 ? min : null;
      const high = isNum(max) && max >= 0 ? max : null;
      if (low !== null && high !== null && low > high) {
        add(`${ctx}: budget option ${tierName} starts above where it ends (${money(low)} > ${money(high)}).`);
      }
      const tier: BudgetTier = { id, label: label || id, min: low, max: high, acceptable: rt.acceptable !== false };
      tiers.push(tier);
    });
    cfg.tiers = tiers;
    if (cfg.policy === "strict_stop" && !cfg.allowSkip && tiers.length > 0 && !tiers.some((t) => t.acceptable)) {
      add(`${ctx} stops visitors whose budget is too low, but no budget option is acceptable and skipping is off, so nobody could continue.`);
    }
  } else {
    const s = isRecord(raw.slider) ? raw.slider : null;
    const smin = parseNumber(s?.min);
    const smax = parseNumber(s?.max);
    const sstep = parseNumber(s?.step);
    if (!isNum(smin) || !isNum(smax) || !isNum(sstep) || smin < 0 || smax <= smin || sstep <= 0 || sstep > smax - smin) {
      add(`${ctx}: the budget slider needs a lowest amount of 0 or more, a highest amount above it, and a step above 0 that fits between them.`);
    } else {
      cfg.slider = { min: smin, max: smax, step: sstep };
      if (cfg.policy === "strict_stop" && !cfg.allowSkip && isNum(cfg.minimum) && cfg.minimum > smax) {
        add(`${ctx} stops visitors below ${money(cfg.minimum)}, but the slider only goes up to ${money(smax)}, so nobody could continue.`);
      }
    }
  }
  return cfg;
}

/** Allowed condition values for a referenced field, or null when the answer is free-form. */
function conditionValues(field: FieldDef): Set<string> | null {
  if (field.type === "budget") {
    return field.budget?.mode === "tiers" ? new Set((field.budget.tiers ?? []).map((t) => t.id.toLowerCase())) : null;
  }
  const choices = fieldChoices(field);
  return choices.length > 0 ? new Set(choices.map((c) => c.value.toLowerCase())) : null;
}

function normalizeField(
  rf: unknown,
  fi: number,
  where: string,
  add: Add,
  takeId: (v: unknown) => string,
): { field: FieldDef; name: string } | null {
  if (!isRecord(rf)) {
    add(`${where}: field #${fi + 1} is not valid. Delete it and add it again.`);
    return null;
  }
  const label = oneLine(rf.label, 200);
  const type = rf.type;
  const isContent = type === "content";
  const name = label ? `${isContent ? "text block" : "field"} '${label}'` : `${isContent ? "text block" : "field"} #${fi + 1}`;
  if (!isFieldType(type)) {
    add(`${where}: ${name} has an unknown type "${String(type)}".`);
    return null;
  }
  const ctx = `${where}: ${name}`;
  if (!isContent && !label) add(`${where}: field #${fi + 1} needs a label.`);

  let role: FieldRole | null = null;
  if (rf.role !== undefined && rf.role !== null && rf.role !== "") {
    if (isFieldRole(rf.role)) role = rf.role;
    else add(`${ctx} has an unknown role "${String(rf.role)}".`);
  }

  const field: FieldDef = {
    id: takeId(rf.id),
    key: typeof rf.key === "string" ? rf.key.trim() : "",
    type,
    role,
    label,
    required: !isContent && rf.required === true,
    width: rf.width === "half" ? "half" : "full",
  };
  if (!isContent) {
    const placeholder = oneLine(rf.placeholder, 200);
    if (placeholder) field.placeholder = placeholder;
    const help = multiLine(rf.help, 500);
    if (help) field.help = help;
  }

  if (type === "select" || type === "radio" || type === "checkbox") {
    const choices = normalizeChoices(rf.choices, ctx, add);
    if (choices.length > 0) field.choices = choices;
    else if (type !== "checkbox") add(`${ctx} needs at least one option.`);
    if ((type === "radio" || type === "checkbox") && (rf.layout === "list" || rf.layout === "cards" || rf.layout === "chips")) {
      field.layout = rf.layout;
    }
  }

  if (type === "number") {
    const min = parseNumber(rf.min);
    const max = parseNumber(rf.max);
    if (Number.isNaN(min)) add(`${ctx}: the lowest allowed number must be a number.`);
    if (Number.isNaN(max)) add(`${ctx}: the highest allowed number must be a number.`);
    field.min = isNum(min) ? min : null;
    field.max = isNum(max) ? max : null;
    if (field.min !== null && field.max !== null && field.min > field.max) {
      add(`${ctx}: the lowest allowed number (${field.min}) is above the highest (${field.max}).`);
    }
  }

  if (type === "text" || type === "textarea" || type === "address") {
    const minLength = parseNumber(rf.minLength);
    const maxLength = parseNumber(rf.maxLength);
    if (Number.isNaN(minLength) || (isNum(minLength) && (minLength < 0 || !Number.isInteger(minLength)))) {
      add(`${ctx}: the minimum length must be a whole number of 0 or more.`);
    } else if (isNum(minLength) && minLength > 0) {
      field.minLength = minLength;
    }
    if (Number.isNaN(maxLength) || (isNum(maxLength) && (maxLength < 1 || !Number.isInteger(maxLength)))) {
      add(`${ctx}: the maximum length must be a whole number of 1 or more.`);
    } else if (isNum(maxLength) && maxLength > MAX_TEXT_LENGTH) {
      add(`${ctx}: the maximum length can be at most ${MAX_TEXT_LENGTH} characters.`);
    } else if (isNum(maxLength)) {
      field.maxLength = maxLength;
    }
    if (isNum(field.minLength) && isNum(field.maxLength) && field.minLength > field.maxLength) {
      add(`${ctx}: the minimum length (${field.minLength}) is above the maximum length (${field.maxLength}).`);
    }
  }

  if (type === "time" && rf.showEndTime === true) field.showEndTime = true;

  if (type === "budget") {
    const budget = normalizeBudget(rf.budget, ctx, add);
    if (budget) field.budget = budget;
  }

  if (isContent) {
    const c = isRecord(rf.content) ? rf.content : {};
    const text = multiLine(c.text, 5000);
    if (!text) add(`${ctx} needs some text.`);
    field.content = c.tone === "info" || c.tone === "muted" ? { text, tone: c.tone } : { text };
  }

  if (rf.showIf !== undefined && rf.showIf !== null) {
    const showIf = normalizeShowIf(rf.showIf);
    if (showIf) field.showIf = showIf;
    else add(`${ctx} has a show-when condition that is not valid. Remove it and set it again.`);
  }

  return { field, name };
}

/**
 * Check and normalize a form definition. Collects every problem (up to 50) as an admin-readable
 * sentence, e.g. "Step 3 'Your event': field 'Guest count' key must be unique (...)".
 * Accepts a definition object or its JSON text.
 */
export function validateDefinition(def: unknown): { ok: true; def: FormDefinition } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const add: Add = (m) => {
    if (errors.length < MAX_ERRORS && !errors.includes(m)) errors.push(m);
  };

  let input = def;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      return { ok: false, errors: ["The form definition is not valid JSON."] };
    }
  }
  if (!isRecord(input)) return { ok: false, errors: ["The form definition is empty or not an object."] };
  if (input.version !== undefined && input.version !== 1) {
    add(`This form uses definition version ${String(input.version)}, but only version 1 is supported.`);
  }
  if (!Array.isArray(input.steps)) {
    add("The form needs a list of steps.");
    return { ok: false, errors };
  }

  const rawSteps: unknown[] = input.steps;
  if (rawSteps.length === 0) add("The form needs at least one step.");
  if (rawSteps.length > MAX_STEPS) add(`A form can have at most ${MAX_STEPS} steps; this one has ${rawSteps.length}.`);

  const usedIds = new Set<string>();
  const takeId = (v: unknown): string => {
    let id = typeof v === "string" ? v.trim() : "";
    if (!id || id.length > 100 || usedIds.has(id)) {
      id = newId();
      while (usedIds.has(id)) id = newId();
    }
    usedIds.add(id);
    return id;
  };

  const steps: StepDef[] = [];
  const stepIndexes: number[] = [];
  const stepWhere: string[] = [];
  const located: Located[] = [];

  rawSteps.forEach((rs, si) => {
    const stepNo = si + 1;
    if (!isRecord(rs)) {
      add(`Step ${stepNo} is not valid. Delete it and add it again.`);
      return;
    }
    const title = oneLine(rs.title, 120);
    const where = title ? `Step ${stepNo} '${title}'` : `Step ${stepNo}`;
    if (!title) add(`Step ${stepNo} needs a title.`);
    let kind: StepDef["kind"] = "fields";
    if (rs.kind === "qualify") kind = "qualify";
    else if (rs.kind !== "fields" && rs.kind !== undefined) {
      add(`${where} has an unknown kind "${String(rs.kind)}" (use a regular step or an availability check).`);
    }

    const step: StepDef = { id: takeId(rs.id), kind, title, fields: [] };
    const description = multiLine(rs.description, 500);
    if (description) step.description = description;
    const buttonText = oneLine(rs.buttonText, 60);
    if (buttonText) step.buttonText = buttonText;
    const progressLabel = oneLine(rs.progressLabel, 40);
    if (progressLabel) step.progressLabel = progressLabel;

    if (rs.fields !== undefined && rs.fields !== null && !Array.isArray(rs.fields)) {
      add(`${where}: its field list is not valid.`);
    }
    const rawFields: unknown[] = Array.isArray(rs.fields) ? rs.fields : [];

    if (kind === "qualify") {
      if (rawFields.length > 0) {
        add(`${where}: an availability check step cannot hold fields. Move them to a regular step.`);
      }
      const checks: CheckKind[] = [];
      for (const c of Array.isArray(rs.checks) ? rs.checks : []) {
        if (c === "date" || c === "location") {
          if (!checks.includes(c)) checks.push(c);
        } else {
          add(`${where} has an unknown check "${String(c)}" (use date or location).`);
        }
      }
      step.checks = checks;
    } else {
      rawFields.forEach((rf, fi) => {
        const n = normalizeField(rf, fi, where, add, takeId);
        if (!n) return;
        step.fields.push(n.field);
        located.push({ field: n.field, stepIndex: si, where, name: n.name });
      });
      if (rawFields.length === 0) add(`${where} has no fields. Add a field or delete the step.`);
    }
    steps.push(step);
    stepIndexes.push(si);
    stepWhere.push(where);
  });

  if (located.length > MAX_FIELDS) {
    add(`A form can have at most ${MAX_FIELDS} fields; this one has ${located.length}.`);
  }

  // Keys: format, reserved names, uniqueness across the whole form; generate missing ones.
  const taken = new Set<string>();
  const keyOwner = new Map<string, Located>();
  for (const loc of located) {
    const k = loc.field.key;
    if (!k) continue;
    if (!KEY_PATTERN.test(k)) {
      add(`${loc.where}: ${loc.name} key "${k}" must start with a lowercase letter and use only lowercase letters, numbers and underscores (up to ${KEY_MAX_LENGTH} characters).`);
    } else if (k.includes("__")) {
      add(`${loc.where}: ${loc.name} key "${k}" cannot contain two underscores in a row (reserved for "Other" and end-time answers).`);
    } else if (RESERVED_KEYS.has(k)) {
      add(`${loc.where}: ${loc.name} key "${k}" is reserved. Pick another key.`);
    }
    const prev = keyOwner.get(k);
    if (prev) {
      add(`${loc.where}: ${loc.name} key must be unique ("${k}" is also used by ${prev.name} in step ${prev.stepIndex + 1}).`);
    } else {
      keyOwner.set(k, loc);
    }
    taken.add(k);
  }
  for (const loc of located) {
    if (loc.field.key) continue;
    loc.field.key = keyFromLabel(loc.field.type === "content" ? "content" : loc.field.label || loc.field.type, taken);
    taken.add(loc.field.key);
    keyOwner.set(loc.field.key, loc);
  }

  // Roles: allowed for the field type, at most once per form.
  const roleOwner = new Map<FieldRole, Located>();
  for (const loc of located) {
    const role = loc.field.role;
    if (!role) continue;
    const allowed = ROLE_FIELD_TYPES[role];
    if (!allowed.includes(loc.field.type)) {
      const types = allowed.map((t) => FIELD_TYPE_LABELS[t]);
      const list = types.length > 1 ? `${types.slice(0, -1).join(", ")} or ${types[types.length - 1]}` : types[0];
      add(`${loc.where}: ${loc.name} cannot use the ${FIELD_ROLE_LABELS[role]} role. That role needs ${withArticle(list)} field.`);
    } else if (role === "services" && loc.field.type === "checkbox" && !isMultiCheckbox(loc.field)) {
      add(`${loc.where}: ${loc.name} uses the Services role, so it needs options to pick from.`);
    }
    const prev = roleOwner.get(role);
    if (prev) {
      add(`${loc.where}: ${loc.name} uses the ${FIELD_ROLE_LABELS[role]} role, but ${prev.name} in step ${prev.stepIndex + 1} already has it. Each role can be used once.`);
    } else {
      roleOwner.set(role, loc);
    }
  }

  // Conditions: only on EARLIER answer fields, with values the referenced field can produce.
  const earlier = new Map<string, Located>();
  for (const loc of located) {
    const cond = loc.field.showIf;
    if (cond) {
      const ref = earlier.get(cond.fieldKey);
      if (cond.fieldKey === loc.field.key) {
        add(`${loc.where}: ${loc.name} cannot depend on its own answer.`);
      } else if (!ref) {
        const later = keyOwner.get(cond.fieldKey);
        if (later) {
          add(`${loc.where}: ${loc.name} depends on ${later.name}, which comes later in the form. A condition can only use an earlier field.`);
        } else {
          add(`${loc.where}: ${loc.name} depends on "${cond.fieldKey}", which is not a field in this form.`);
        }
      } else if (ref.field.type === "content") {
        add(`${loc.where}: ${loc.name} depends on a text block, which has no answer to check.`);
      } else if (cond.op !== "answered") {
        const values = cond.values ?? [];
        if (values.length === 0) {
          add(`${loc.where}: ${loc.name} has a show-when condition with no values. Pick at least one.`);
        }
        const allowed = conditionValues(ref.field);
        if (allowed) {
          for (const v of values) {
            if (!allowed.has(v.toLowerCase())) {
              add(`${loc.where}: ${loc.name} depends on the answer "${v}", which is not an option of ${ref.name}.`);
            }
          }
        }
      }
    }
    earlier.set(loc.field.key, loc);
  }

  // Availability check steps.
  const qualifyAt = steps.map((s, i) => (s.kind === "qualify" ? i : -1)).filter((i) => i >= 0);
  if (qualifyAt.length > 1) {
    add(`A form can have only one availability check step (steps ${qualifyAt.map((i) => stepIndexes[i] + 1).join(", ")} are availability checks).`);
  }
  for (const i of qualifyAt) {
    const step = steps[i];
    const where = stepWhere[i];
    const rawIndex = stepIndexes[i];
    const checks = step.checks ?? [];
    if (checks.length === 0) add(`${where} needs at least one check: the date, the location, or both.`);
    if (checks.includes("date") && !located.some((l) => l.stepIndex < rawIndex && l.field.role === "event_date")) {
      add(`${where} checks the date, so an earlier step needs a Date field with the Event date role.`);
    }
    if (checks.includes("location") && !located.some((l) => l.stepIndex < rawIndex && l.field.role === "event_location")) {
      add(`${where} checks the location, so an earlier step needs a field with the Event location role.`);
    }
  }

  // First and last step.
  if (steps.length > 0) {
    const first = steps[0];
    if (!(first.kind === "fields" && first.fields.some((f) => f.role === "email" || f.role === "phone"))) {
      add(`${stepWhere[0]}: the first step needs an Email or Phone field (with the Email or Phone role), so the team can follow up with people who do not finish.`);
    }
    const lastIndex = steps.length - 1;
    if (steps[lastIndex].kind !== "fields") {
      add(`The last step must be a regular step with fields, because it holds the submit button. ${stepWhere[lastIndex]} is an availability check: add a step after it.`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, def: { version: 1, steps } };
}
