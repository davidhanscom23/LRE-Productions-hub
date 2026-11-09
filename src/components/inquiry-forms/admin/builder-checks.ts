/**
 * Inquiry Forms builder - live setup checklist.
 *
 * Every issue says what is wrong in the owner's words and WHERE (a step, a field or a
 * settings section), so the issues list can jump straight to it. The authoritative publish
 * gate is still validateDefinition (same pure module the server runs); its messages are
 * located and merged in by `mergeValidationErrors` without repeating what is already listed.
 */
import { MAX_TEXT_LENGTH, RESERVED_KEYS, firstStepContactOk } from "@/lib/inquiry-forms/definition";
import { isValidSlug } from "@/lib/inquiry-forms/slug";
import type { BrandProfile, BusinessSettings, FieldDef, FormDefinition, StepDef } from "@/lib/inquiry-forms/types";
import { isValidEmail } from "@/lib/inquiry-forms/validation";
import { ROLE_LABELS, fieldTypeLabel, isAnswerable, rolesForType, usesChoices } from "./builder-catalog";
import {
  KEY_PATTERN,
  locateFieldByKey,
  opNeedsValues,
  orderedFields,
  showIfChoicesFor,
  type EditorDraft,
  type FieldLocation,
} from "./builder-ops";
import { MIN_TEXT_CONTRAST, whiteTextContrast } from "./form-settings-contrast";
import { checkFormName } from "./list-helpers";
import { validateFormSettings } from "./settings-validate";

export type SettingsSection =
  | "basics"
  | "brand"
  | "copy"
  | "thanks"
  | "qualify"
  | "date"
  | "location"
  | "emails"
  | "owners"
  | "copies"
  | "embed"
  | "progress";

export type IssueTarget =
  | { tab: "build"; stepId: string | null; fieldId: string | null }
  | { tab: "settings"; section: SettingsSection };

export interface EditorIssue {
  id: string;
  severity: "error" | "warning";
  message: string;
  target: IssueTarget | null;
}

export interface CheckContext {
  business: BusinessSettings | null;
  brands: BrandProfile[];
  /** Slug currently saved on the server (visitors use it). */
  savedSlug: string;
  /** The form has a published version, so saveDraft refuses a new slug. */
  slugLocked: boolean;
}

/** Same email rule the form and the server use. */
export function isEmailAddress(value: string): boolean {
  return isValidEmail(value.trim());
}

function stepName(step: StepDef, index: number): string {
  const title = step.title.trim();
  return title ? `Step ${index + 1} "${title}"` : `Step ${index + 1}`;
}

function fieldName(field: FieldDef): string {
  const label = field.label.trim();
  return label ? `"${label}"` : `The ${fieldTypeLabel(field).toLowerCase()} question`;
}

function buildTarget(step: StepDef | null, field: FieldDef | null): IssueTarget {
  return { tab: "build", stepId: step?.id ?? null, fieldId: field?.id ?? null };
}

type AddIssue = (id: string, severity: EditorIssue["severity"], message: string, target: IssueTarget | null) => void;

// Definition checks

export function checkDefinition(def: FormDefinition, ctx: CheckContext): EditorIssue[] {
  const issues: EditorIssue[] = [];
  const add: AddIssue = (id, severity, message, target) => issues.push({ id, severity, message, target });

  if (def.steps.length === 0) {
    add("form:no-steps", "error", "Add at least one step with questions.", { tab: "build", stepId: null, fieldId: null });
    return issues;
  }

  const all = orderedFields(def);
  if (!all.some((l) => isAnswerable(l.field))) {
    add("form:no-questions", "error", "Add at least one question.", buildTarget(def.steps[0], null));
  }

  const first = def.steps[0];
  if (first.kind === "qualify") {
    add(
      "form:qualify-first",
      "error",
      "The availability check cannot be the first step: visitors have not given a date or place yet.",
      buildTarget(first, null),
    );
  } else if (!firstStepContactOk(def)) {
    add(
      "form:first-contact",
      "error",
      `${stepName(first, 0)} needs an email or phone question (with the Email or Phone role), so the team can reach people who stop partway.`,
      buildTarget(first, null),
    );
  }

  const qualifyIndexes = def.steps.map((s, i) => (s.kind === "qualify" ? i : -1)).filter((i) => i >= 0);
  def.steps.forEach((step, stepIndex) => {
    if (!step.title.trim()) {
      add(`step:${step.id}:title`, "error", `Step ${stepIndex + 1} needs a title.`, buildTarget(step, null));
    }
    if (step.kind === "fields") {
      if (step.fields.length === 0) {
        add(
          `step:${step.id}:empty`,
          "error",
          `${stepName(step, stepIndex)} has no questions yet. Add one or delete the step.`,
          buildTarget(step, null),
        );
      } else if (!step.fields.some(isAnswerable)) {
        add(
          `step:${step.id}:only-text`,
          "warning",
          `${stepName(step, stepIndex)} only has text blocks, so visitors just click Next.`,
          buildTarget(step, null),
        );
      }
      return;
    }
    if (qualifyIndexes.length > 1 && stepIndex !== qualifyIndexes[0]) {
      add(
        `step:${step.id}:second-check`,
        "error",
        `${stepName(step, stepIndex)} repeats the availability check from step ${qualifyIndexes[0] + 1}. A form can have only one.`,
        buildTarget(step, null),
      );
    }
    checkQualifyStep(def, step, stepIndex, ctx, all, add);
  });

  checkFields(def, all, add);
  return issues;
}

function checkQualifyStep(
  def: FormDefinition,
  step: StepDef,
  stepIndex: number,
  ctx: CheckContext,
  all: FieldLocation[],
  add: AddIssue,
) {
  const checks = step.checks ?? [];
  const target = buildTarget(step, null);
  if (checks.length === 0) {
    add(
      `step:${step.id}:no-checks`,
      "error",
      `${stepName(step, stepIndex)} checks nothing. Turn on the date check, the location check, or both.`,
      target,
    );
  }
  if (stepIndex === def.steps.length - 1) {
    add(
      `step:${step.id}:last`,
      "error",
      `${stepName(step, stepIndex)} is the last step, so visitors would have no button to send the form. Add or move a questions step after it.`,
      target,
    );
  }
  const before = all.filter((l) => l.stepIndex < stepIndex);
  if (checks.includes("date")) {
    const dateField = before.find((l) => l.field.role === "event_date");
    if (!dateField) {
      const later = all.find((l) => l.field.role === "event_date");
      add(
        `step:${step.id}:no-date`,
        "error",
        later
          ? `${stepName(step, stepIndex)} checks the date, but the event date question comes after it. Move ${fieldName(later.field)} to an earlier step.`
          : `${stepName(step, stepIndex)} checks the date, but no earlier step asks for the event date. Add an Event date question before it.`,
        target,
      );
    } else if (!dateField.field.required) {
      add(
        `step:${step.id}:date-optional`,
        "warning",
        "The event date question is optional, so visitors who skip it skip the date check too.",
        buildTarget(dateField.step, dateField.field),
      );
    }
    if (ctx.business && ctx.business.availability.mode === "off") {
      add(
        `step:${step.id}:date-off`,
        "warning",
        "Date checks are turned off in Inquiry Forms settings, so this step skips the date.",
        target,
      );
    }
  }
  if (checks.includes("location")) {
    const placeField = before.find((l) => l.field.role === "event_location");
    if (!placeField) {
      const later = all.find((l) => l.field.role === "event_location");
      add(
        `step:${step.id}:no-place`,
        "error",
        later
          ? `${stepName(step, stepIndex)} checks the location, but the location question comes after it. Move ${fieldName(later.field)} to an earlier step.`
          : `${stepName(step, stepIndex)} checks the location, but no earlier step asks where the event is. Add a Venue or location question before it.`,
        target,
      );
    } else if (placeField.field.type === "select" || placeField.field.type === "radio") {
      add(
        `step:${step.id}:place-choice`,
        "warning",
        `The location check needs a typed address, but ${fieldName(placeField.field)} is a choice list, so it cannot be measured.`,
        buildTarget(placeField.step, placeField.field),
      );
    }
    if (ctx.business && !ctx.business.location.enabled) {
      add(
        `step:${step.id}:place-off`,
        "warning",
        "Location checks are turned off in Inquiry Forms settings, so this step skips the location.",
        target,
      );
    }
  }
}

function checkFields(def: FormDefinition, all: FieldLocation[], add: AddIssue) {
  const firstByKey = new Map<string, FieldLocation>();
  const firstByRole = new Map<string, FieldLocation>();

  for (const loc of all) {
    const { field, step } = loc;
    const target = buildTarget(step, field);
    const name = fieldName(field);
    const id = (suffix: string) => `field:${field.id}:${suffix}`;

    if (isAnswerable(field) && !field.label.trim()) {
      add(id("label"), "error", `Step ${loc.stepIndex + 1}: a ${fieldTypeLabel(field).toLowerCase()} question has no label.`, target);
    }
    if (field.type === "content" && !(field.content?.text ?? "").trim()) {
      add(id("content"), "error", `${name} is an empty text block. Write its text or delete it.`, target);
    }

    // Keys (same rules as validateDefinition; an empty key is filled in from the label)
    if (field.key && (!KEY_PATTERN.test(field.key) || field.key.includes("__") || RESERVED_KEYS.has(field.key))) {
      add(id("key"), "error", `${name} has a key that is not allowed ("${field.key}").`, target);
    }
    const sameKey = field.key ? firstByKey.get(field.key) : undefined;
    if (sameKey) {
      add(id("key-dup"), "error", `${name} and ${fieldName(sameKey.field)} use the same key "${field.key}".`, target);
    } else {
      firstByKey.set(field.key, loc);
    }

    // Roles
    if (field.role) {
      if (!rolesForType(field.type).includes(field.role)) {
        add(id("role-type"), "error", `${name} cannot have the ${ROLE_LABELS[field.role]} role (wrong question type).`, target);
      } else if (field.role === "services" && field.type === "checkbox" && (field.choices?.length ?? 0) === 0) {
        add(id("role-services"), "error", `${name} has the Services role, so it needs choices to pick from.`, target);
      }
      const sameRole = firstByRole.get(field.role);
      if (sameRole) {
        add(
          id("role-dup"),
          "error",
          `${name} and ${fieldName(sameRole.field)} both have the ${ROLE_LABELS[field.role]} role. Keep it on one of them.`,
          target,
        );
      } else {
        firstByRole.set(field.role, loc);
      }
    }

    // Choices
    if (usesChoices(field.type)) {
      const choices = field.choices ?? [];
      if (choices.length === 0 && field.type !== "checkbox") {
        add(id("no-choices"), "error", `${name} has no choices yet.`, target);
      } else if (choices.length === 1 && field.type !== "checkbox") {
        add(id("one-choice"), "warning", `${name} has only one choice.`, target);
      }
      const seen = new Set<string>();
      if (choices.some((c) => !c.label.trim())) add(id("choice-label"), "error", `${name} has a choice with no label.`, target);
      choices.forEach((c) => {
        if (!c.value.trim()) {
          add(id("choice-value"), "error", `${name} has a choice with no stored value.`, target);
        } else if (seen.has(c.value)) {
          add(id(`choice-dup:${c.value}`), "error", `${name} has two choices stored as "${c.value}".`, target);
        }
        seen.add(c.value);
      });
      const others = choices.filter((c) => c.isOther).length;
      if (others > 1) add(id("other-many"), "error", `${name} has more than one "Other" write-in.`, target);
    }

    // Numbers and lengths
    if (field.type === "number" && field.min != null && field.max != null && field.min > field.max) {
      add(id("min-max"), "error", `${name}: the smallest number is bigger than the largest.`, target);
    }
    if (field.type === "text" || field.type === "textarea" || field.type === "address") {
      if (field.minLength != null && field.maxLength != null && field.minLength > field.maxLength) {
        add(id("length"), "error", `${name}: the minimum length is longer than the maximum.`, target);
      }
      if (field.maxLength != null && field.maxLength > MAX_TEXT_LENGTH) {
        add(id("length-cap"), "error", `${name}: the maximum length can be at most ${MAX_TEXT_LENGTH.toLocaleString("en-US")} characters.`, target);
      }
      if ((field.minLength != null && field.minLength < 0) || (field.maxLength != null && field.maxLength < 1)) {
        add(id("length-range"), "error", `${name}: lengths must be positive whole numbers.`, target);
      }
    }

    if (field.type === "budget") checkBudget(field, name, id, target, add);
    if (field.showIf) checkShowIf(def, loc, name, id, target, add);
  }
}

function checkBudget(field: FieldDef, name: string, id: (s: string) => string, target: IssueTarget, add: AddIssue) {
  const b = field.budget;
  if (!b) {
    add(id("budget"), "error", `${name} has no budget setup.`, target);
    return;
  }
  if (b.mode === "tiers") {
    const tiers = b.tiers ?? [];
    if (tiers.length === 0) add(id("tiers"), "error", `${name} needs price ranges to pick from.`, target);
    else if (tiers.length === 1) add(id("tiers"), "warning", `${name} has only one price range, so it is not a real choice.`, target);
    if (tiers.some((t) => !t.label.trim())) add(id("tier-label"), "error", `${name} has a price range with no label.`, target);
    if (tiers.some((t) => (t.min != null && t.min < 0) || (t.max != null && t.max < 0))) {
      add(id("tier-negative"), "error", `${name} has a price range with an amount below zero.`, target);
    }
    if (tiers.some((t) => t.min != null && t.max != null && t.min > t.max)) {
      add(id("tier-range"), "error", `${name} has a price range whose low end is above its high end.`, target);
    }
    if (tiers.length > 0 && !tiers.some((t) => t.acceptable)) {
      add(
        id("tier-none-ok"),
        b.policy === "strict_stop" && !b.allowSkip ? "error" : "warning",
        b.policy === "strict_stop" && !b.allowSkip
          ? `${name} stops low budgets, but no range is marked workable and skipping is off, so nobody could continue.`
          : `${name}: no price range is marked as one you can work with.`,
        target,
      );
    }
  } else {
    const s = b.slider;
    if (!s || s.min < 0 || !(s.min < s.max) || !(s.step > 0) || s.step > s.max - s.min) {
      add(
        id("slider"),
        "error",
        `${name}: the slider needs a low end of 0 or more, a high end above it, and a step above zero that fits between them.`,
        target,
      );
    }
    if (b.policy === "strict_stop" && (b.minimum == null || !Number.isFinite(b.minimum))) {
      add(id("slider-min"), "warning", `${name} stops visitors below a minimum, but no minimum is set.`, target);
    }
  }
  if (b.minimum != null && b.minimum < 0) add(id("minimum"), "error", `${name}: the minimum budget cannot be below zero.`, target);
  if (b.policy === "strict_stop" && !(b.belowMessage ?? "").trim()) {
    add(id("below-message"), "warning", `${name} stops low budgets but has no message explaining why.`, target);
  }
}

function checkShowIf(
  def: FormDefinition,
  loc: FieldLocation,
  name: string,
  id: (s: string) => string,
  target: IssueTarget,
  add: AddIssue,
) {
  const rule = loc.field.showIf;
  if (!rule) return;
  const source = locateFieldByKey(def, rule.fieldKey);
  if (!source || source.field.id === loc.field.id) {
    add(id("showif-missing"), "error", `${name} depends on a question that no longer exists. Edit or turn off its show rule.`, target);
    return;
  }
  const earlier = source.stepIndex < loc.stepIndex || (source.stepIndex === loc.stepIndex && source.fieldIndex < loc.fieldIndex);
  if (!earlier) {
    add(
      id("showif-order"),
      "error",
      `${name} depends on ${fieldName(source.field)}, which now comes after it. Move it, or pick an earlier question.`,
      target,
    );
    return;
  }
  if (!isAnswerable(source.field)) {
    add(id("showif-content"), "error", `${name} depends on a text block, which has no answer.`, target);
    return;
  }
  if (opNeedsValues(rule.op)) {
    const values = rule.values ?? [];
    if (values.length === 0) {
      add(id("showif-values"), "error", `${name}: pick at least one answer for its show rule.`, target);
      return;
    }
    const choices = showIfChoicesFor(source.field);
    const known = new Set(choices.map((c) => c.value.toLowerCase()));
    // Free-form answers (no choices) can match any typed value, like validateDefinition allows.
    if (choices.length > 0 && values.some((v) => !known.has(v.toLowerCase()))) {
      add(id("showif-stale"), "error", `${name}: its show rule uses an answer that ${fieldName(source.field)} no longer offers.`, target);
    }
  }
}

// Settings checks

/** Ranges mergeFormSettings keeps (it clamps anything outside them). */
export const TIMING_RANGES = {
  messageIntervalMs: { min: 500, max: 15000 },
  minCheckMs: { min: 0, max: 20000 },
  preCelebrationMs: { min: 0, max: 10000 },
  popupMs: { min: 0, max: 15000 },
} as const;

/** Which settings section a validateFormSettings path belongs to ("thankYou.title" -> "thanks"). */
export function sectionForSettingsPath(path: string): SettingsSection {
  switch (path.split(".")[0]) {
    case "brand":
    case "accentColor":
      return "brand";
    case "headline":
    case "subheadline":
    case "submitLabel":
      return "copy";
    case "thankYou":
    case "waitlistThankYou":
    case "redirectUrl":
      return "thanks";
    case "qualify":
      return "qualify";
    case "onDateUnavailable":
      return "date";
    case "onLocationFail":
    case "referral":
      return "location";
    case "confirmationEmail":
    case "notify":
      return "emails";
    case "ownerByEventType":
      return "owners";
    case "copies":
      return "copies";
    case "hostEvent":
      return "embed";
    case "progressHype":
      return "progress";
    default:
      return "basics";
  }
}

/**
 * Name, web address and settings problems. Errors are exactly what saveDraft refuses
 * (checkFormName, isValidSlug, the published-slug rule and validateFormSettings); the rest
 * are suggestions.
 */
export function checkSettings(draft: EditorDraft, ctx: CheckContext): EditorIssue[] {
  const issues: EditorIssue[] = [];
  const s = draft.settings;
  const add = (id: string, severity: EditorIssue["severity"], message: string, section: SettingsSection) =>
    issues.push({ id: `settings:${id}`, severity, message, target: { tab: "settings", section } });

  const name = checkFormName(draft.name);
  if (!name.ok) add("name", "error", name.error, "basics");
  const slug = draft.slug.trim().toLowerCase();
  if (!isValidSlug(slug)) {
    add("slug", "error", "The web address needs 3 to 60 lowercase letters, numbers and single dashes.", "basics");
  } else if (ctx.slugLocked && slug !== ctx.savedSlug) {
    add(
      "slug-locked",
      "error",
      `This form is published, so its address stays /inquire/${ctx.savedSlug}. Duplicate the form to start a new address.`,
      "basics",
    );
  }

  const v = validateFormSettings(s, { brandKeys: ctx.brands.map((b) => b.key) });
  if (!v.ok) {
    v.issues.forEach((issue, i) => add(`${issue.path}:${i}`, "error", issue.message, sectionForSettingsPath(issue.path)));
  }

  // Suggestions (never block a save)
  const ratio = /^#[0-9a-fA-F]{6}$/.test(s.accentColor.trim()) ? whiteTextContrast(s.accentColor) : null;
  if (ratio !== null && ratio < MIN_TEXT_CONTRAST) {
    add(
      "accent-contrast",
      "warning",
      `White button text on the accent color is hard to read (${ratio}:1, needs ${MIN_TEXT_CONTRAST}:1).`,
      "brand",
    );
  }
  const qualifySteps = draft.definition.steps.filter((st) => st.kind === "qualify");
  const hasDateCheck = qualifySteps.some((st) => (st.checks ?? []).includes("date"));
  const hasLocationCheck = qualifySteps.some((st) => (st.checks ?? []).includes("location"));
  if (s.qualify.celebrate && !hasDateCheck) {
    add(
      "celebrate",
      "warning",
      "The celebration only plays after a date check. Add an availability check step or turn it off.",
      "qualify",
    );
  }
  if (s.qualify.urgency !== null && !s.qualify.urgency.trim()) {
    add("urgency", "warning", "The custom urgency line is empty, so none will show. Write one or pick None.", "qualify");
  }
  if (s.onLocationFail.action === "referral" && !hasLocationCheck) {
    add("referral-unused", "warning", "Referrals only show after a location check, and this form has none.", "location");
  }
  if (s.confirmationEmail.enabled && !orderedFields(draft.definition).some((l) => l.field.role === "email")) {
    add("confirm-no-email", "warning", "The confirmation email is on, but no question has the Email role.", "emails");
  }
  if (!s.notify.inApp && s.notify.recipients.length === 0) {
    add("nobody", "warning", "Nobody is told about new inquiries. Turn on Hub alerts or add a staff email.", "emails");
  }
  return issues;
}

// validateDefinition messages

/** Same normalization validateDefinition applies before quoting a label or title. */
function oneLine(s: string, max: number): string {
  return s.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

/**
 * Where a validateDefinition message points. Its messages read
 * "Step N 'Title': field 'Label' ..." (or "field #K", "text block 'Label'"), so the step comes
 * from N and the field from its quoted label within that step.
 */
export function locateValidationMessage(def: FormDefinition, message: string): IssueTarget | null {
  const stepMatch = /^Step (\d+)\b/.exec(message);
  if (stepMatch) {
    const step = def.steps[Number(stepMatch[1]) - 1];
    if (!step) return null;
    let best: FieldDef | null = null;
    let bestLen = 0;
    for (const f of step.fields) {
      const label = oneLine(f.label, 200);
      if (!label) continue;
      const kind = f.type === "content" ? "text block" : "field";
      if (message.includes(`${kind} '${label}'`) && label.length > bestLen) {
        best = f;
        bestLen = label.length;
      }
    }
    if (!best) {
      const numbered = /(?:field|text block) #(\d+)/.exec(message);
      if (numbered) best = step.fields[Number(numbered[1]) - 1] ?? null;
    }
    return buildTarget(step, best);
  }
  if (/^The last step must be/.test(message) && def.steps.length > 0) {
    return buildTarget(def.steps[def.steps.length - 1], null);
  }
  const several = /availability check step \(steps ([\d, ]+)/.exec(message);
  if (several) {
    const numbers = several[1].split(",").map((n) => Number(n.trim()));
    const step = def.steps[(numbers[1] ?? numbers[0]) - 1];
    if (step) return buildTarget(step, null);
  }
  if (/^A form can have at most \d+ fields/.test(message) || /^The form needs at least one step/.test(message)) {
    return { tab: "build", stepId: null, fieldId: null };
  }
  const quotedKey = /"([a-z][a-z0-9_]{0,47})"/.exec(message);
  if (quotedKey) {
    const loc = locateFieldByKey(def, quotedKey[1]);
    if (loc) return buildTarget(loc.step, loc.field);
  }
  return null;
}

function sameTarget(a: IssueTarget | null, b: IssueTarget | null): boolean {
  if (!a || !b) return false;
  if (a.tab === "settings" || b.tab === "settings") {
    return a.tab === "settings" && b.tab === "settings" && a.section === b.section;
  }
  if (a.fieldId || b.fieldId) return a.fieldId === b.fieldId;
  return a.stepId === b.stepId;
}

/**
 * Adds validateDefinition errors that the local checklist did not already report at the
 * same place (so the list never shows one problem twice). Unplaced messages always show.
 */
export function mergeValidationErrors(local: EditorIssue[], errors: string[], def: FormDefinition): EditorIssue[] {
  const merged = local.slice();
  errors.forEach((message, i) => {
    const target = locateValidationMessage(def, message);
    const covered = target !== null && local.some((issue) => issue.severity === "error" && sameTarget(issue.target, target));
    if (covered) return;
    merged.push({ id: `validate:${i}`, severity: "error", message, target });
  });
  return merged;
}

/** Errors first, then warnings, each in the order they were found. */
export function sortIssues(issues: EditorIssue[]): EditorIssue[] {
  return issues
    .map((issue, i) => ({ issue, i }))
    .sort((a, b) => (a.issue.severity === b.issue.severity ? a.i - b.i : a.issue.severity === "error" ? -1 : 1))
    .map((x) => x.issue);
}

/** Issues grouped by field id and by step id (step-level only), for badges and panels. */
export function indexIssues(issues: EditorIssue[]): {
  byField: Map<string, EditorIssue[]>;
  byStep: Map<string, EditorIssue[]>;
  errorsByStep: Map<string, number>;
} {
  const byField = new Map<string, EditorIssue[]>();
  const byStep = new Map<string, EditorIssue[]>();
  const errorsByStep = new Map<string, number>();
  for (const issue of issues) {
    const t = issue.target;
    if (!t || t.tab !== "build") continue;
    if (t.fieldId) {
      const list = byField.get(t.fieldId) ?? [];
      list.push(issue);
      byField.set(t.fieldId, list);
    } else if (t.stepId) {
      const list = byStep.get(t.stepId) ?? [];
      list.push(issue);
      byStep.set(t.stepId, list);
    }
    if (t.stepId && issue.severity === "error") errorsByStep.set(t.stepId, (errorsByStep.get(t.stepId) ?? 0) + 1);
  }
  return { byField, byStep, errorsByStep };
}
