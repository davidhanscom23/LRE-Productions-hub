/**
 * Inquiry Forms builder - pure, immutable edits of the draft definition.
 *
 * Every function returns a NEW definition (or the same object when nothing changed), so the
 * history can store snapshots cheaply. No React, no network: unit tested in builder-ops.test.ts.
 */
import { KEY_PATTERN, RESERVED_KEYS, keyFromLabel, newId } from "@/lib/inquiry-forms/definition";
import type {
  BudgetTier,
  CheckKind,
  Choice,
  FieldDef,
  FieldRole,
  FieldType,
  FormDefinition,
  FormSettings,
  ShowIf,
  StepDef,
} from "@/lib/inquiry-forms/types";
import {
  CONTACT_PREFERENCE_CHOICES,
  FIELD_TEMPLATES,
  defaultBudgetConfig,
  isAnswerable,
  rolesForType,
  typeFamily,
  usesChoices,
  type FieldTemplateId,
} from "./builder-catalog";

export type FormStatus = "draft" | "live" | "paused" | "archived";

/** Everything the editor saves with saveDraft (and undo / redo covers). */
export interface EditorDraft {
  name: string;
  slug: string;
  definition: FormDefinition;
  settings: FormSettings;
}

// Generic helpers

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = items.slice();
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** JSON with sorted keys and undefined dropped: equal drafts give equal strings. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
}

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// Lookups

export interface FieldLocation {
  stepIndex: number;
  fieldIndex: number;
  step: StepDef;
  field: FieldDef;
}

export function locateField(def: FormDefinition, fieldId: string): FieldLocation | null {
  for (let s = 0; s < def.steps.length; s++) {
    const step = def.steps[s];
    const fieldIndex = step.fields.findIndex((f) => f.id === fieldId);
    if (fieldIndex >= 0) return { stepIndex: s, fieldIndex, step, field: step.fields[fieldIndex] };
  }
  return null;
}

export function locateFieldByKey(def: FormDefinition, key: string): FieldLocation | null {
  for (let s = 0; s < def.steps.length; s++) {
    const step = def.steps[s];
    const fieldIndex = step.fields.findIndex((f) => f.key === key);
    if (fieldIndex >= 0) return { stepIndex: s, fieldIndex, step, field: step.fields[fieldIndex] };
  }
  return null;
}

/** Every field in form order with its position. */
export function orderedFields(def: FormDefinition): FieldLocation[] {
  const out: FieldLocation[] = [];
  def.steps.forEach((step, stepIndex) => {
    step.fields.forEach((field, fieldIndex) => out.push({ stepIndex, fieldIndex, step, field }));
  });
  return out;
}

export function stepIndexById(def: FormDefinition, stepId: string): number {
  return def.steps.findIndex((s) => s.id === stepId);
}

/** True when `a` comes before `b` in form order. */
export function isBefore(a: FieldLocation, b: FieldLocation): boolean {
  return a.stepIndex < b.stepIndex || (a.stepIndex === b.stepIndex && a.fieldIndex < b.fieldIndex);
}

/** Answerable fields that come before `fieldId` (the only valid show-if sources). */
export function earlierAnswerableFields(def: FormDefinition, fieldId: string): FieldDef[] {
  const out: FieldDef[] = [];
  for (const loc of orderedFields(def)) {
    if (loc.field.id === fieldId) break;
    if (isAnswerable(loc.field)) out.push(loc.field);
  }
  return out;
}

export function keysOfOtherFields(def: FormDefinition, exceptFieldId: string | null): Set<string> {
  const keys = new Set<string>();
  for (const loc of orderedFields(def)) {
    if (loc.field.id !== exceptFieldId) keys.add(loc.field.key);
  }
  return keys;
}

/** Roles in use, mapped to the field that holds them. */
export function rolesInUse(def: FormDefinition, exceptFieldId: string | null = null): Map<FieldRole, FieldDef> {
  const map = new Map<FieldRole, FieldDef>();
  for (const loc of orderedFields(def)) {
    const role = loc.field.role;
    if (role && loc.field.id !== exceptFieldId && !map.has(role)) map.set(role, loc.field);
  }
  return map;
}

/** Roles this field may take: allowed for its type and not used by another field. */
export function availableRoles(def: FormDefinition, field: FieldDef): FieldRole[] {
  const used = rolesInUse(def, field.id);
  return rolesForType(field.type).filter((role) => !used.has(role));
}

/** Fields whose show-if rule reads `key`. */
export function dependentsOfKey(def: FormDefinition, key: string, exceptFieldId: string | null = null): FieldDef[] {
  return orderedFields(def)
    .map((loc) => loc.field)
    .filter((f) => f.id !== exceptFieldId && f.showIf?.fieldKey === key);
}

// Keys

export { KEY_PATTERN };

/** Cleans what someone typed into the key box (lowercase, single underscores, 48 max). */
export function sanitizeKeyInput(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 48);
}

/** The same key rules validateDefinition enforces, in plain words (null = fine). */
export function keyProblem(def: FormDefinition, fieldId: string, key: string): string | null {
  if (!key) return "Add a key.";
  if (!KEY_PATTERN.test(key)) {
    return "Start with a lowercase letter and use only lowercase letters, numbers and underscores (48 at most).";
  }
  if (key.includes("__")) return "Use single underscores (two in a row are kept for extra answers).";
  if (RESERVED_KEYS.has(key)) return "This key is reserved. Pick another one.";
  if (keysOfOtherFields(def, fieldId).has(key)) return "Another question already uses this key.";
  return null;
}

/** Keys a NEW key must avoid: every other field's key plus retired keys that still hold answers. */
function takenKeysFor(def: FormDefinition, fieldId: string | null, reserved: ReadonlySet<string>, ownKey?: string): Set<string> {
  const taken = keysOfOtherFields(def, fieldId);
  reserved.forEach((k) => {
    if (k !== ownKey) taken.add(k);
  });
  return taken;
}

/**
 * A key is "automatic" while it still equals what the label would generate. Typing a custom
 * key stops the label from changing it.
 */
export function isAutoKey(def: FormDefinition, field: FieldDef, reserved: ReadonlySet<string>): boolean {
  return field.key === keyFromLabel(field.label, takenKeysFor(def, field.id, reserved, field.key));
}

function renameShowIfRefs(def: FormDefinition, oldKey: string, newKey: string): FormDefinition {
  if (oldKey === newKey) return def;
  let changed = false;
  const steps = def.steps.map((step) => {
    let stepChanged = false;
    const fields = step.fields.map((f) => {
      if (f.showIf?.fieldKey !== oldKey) return f;
      stepChanged = true;
      return { ...f, showIf: { ...f.showIf, fieldKey: newKey } };
    });
    if (!stepChanged) return step;
    changed = true;
    return { ...step, fields };
  });
  return changed ? { ...def, steps } : def;
}

/** Points show-if rules at the new key, but only when neither key is shared (no hijacking). */
function followKeyChange(before: FormDefinition, after: FormDefinition, fieldId: string, oldKey: string, newKey: string): FormDefinition {
  if (oldKey === newKey) return after;
  const othersBefore = keysOfOtherFields(before, fieldId);
  if (othersBefore.has(oldKey) || othersBefore.has(newKey)) return after;
  return renameShowIfRefs(after, oldKey, newKey);
}

// Steps

export function newFieldsStep(): StepDef {
  return { id: newId(), kind: "fields", title: "New step", fields: [] };
}

export function newQualifyStep(def: FormDefinition, locationEnabled: boolean): StepDef {
  const fields = orderedFields(def).map((l) => l.field);
  const checks: CheckKind[] = ["date"];
  if (locationEnabled && fields.some((f) => f.role === "event_location")) checks.push("location");
  return {
    id: newId(),
    kind: "qualify",
    title: "Checking our calendar",
    progressLabel: "Availability",
    fields: [],
    checks,
  };
}

/** Inserts a step at `index` (default: the end). */
export function insertStep(def: FormDefinition, step: StepDef, index?: number): FormDefinition {
  const steps = def.steps.slice();
  const at = index === undefined ? steps.length : Math.max(0, Math.min(index, steps.length));
  steps.splice(at, 0, step);
  return { ...def, steps };
}

export function updateStep(def: FormDefinition, stepId: string, patch: Partial<Omit<StepDef, "id" | "fields">>): FormDefinition {
  const i = stepIndexById(def, stepId);
  if (i < 0) return def;
  const steps = def.steps.slice();
  steps[i] = { ...steps[i], ...patch };
  return { ...def, steps };
}

export function moveStep(def: FormDefinition, from: number, to: number): FormDefinition {
  if (from === to) return def;
  return { ...def, steps: moveItem(def.steps, from, to) };
}

/** Clears show-if rules that read any of `keys` (keys no other remaining field still uses). */
function clearShowIfFor(def: FormDefinition, keys: Set<string>): FormDefinition {
  if (keys.size === 0) return def;
  const remaining = new Set(orderedFields(def).map((l) => l.field.key));
  const gone = new Set([...keys].filter((k) => !remaining.has(k)));
  if (gone.size === 0) return def;
  let changed = false;
  const steps = def.steps.map((step) => {
    let stepChanged = false;
    const fields = step.fields.map((f) => {
      if (!f.showIf || !gone.has(f.showIf.fieldKey)) return f;
      stepChanged = true;
      return { ...f, showIf: null };
    });
    if (!stepChanged) return step;
    changed = true;
    return { ...step, fields };
  });
  return changed ? { ...def, steps } : def;
}

export function removeStep(def: FormDefinition, stepId: string): FormDefinition {
  const i = stepIndexById(def, stepId);
  if (i < 0) return def;
  const removedKeys = new Set(def.steps[i].fields.map((f) => f.key));
  const steps = def.steps.filter((s) => s.id !== stepId);
  return clearShowIfFor({ ...def, steps }, removedKeys);
}

/** Fields in OTHER steps whose show-if reads a field of this step (they lose the rule on delete). */
export function dependentsOfStep(def: FormDefinition, stepId: string): FieldDef[] {
  const i = stepIndexById(def, stepId);
  if (i < 0) return [];
  const keys = new Set(def.steps[i].fields.map((f) => f.key));
  return orderedFields(def)
    .filter((loc) => loc.step.id !== stepId && loc.field.showIf && keys.has(loc.field.showIf.fieldKey))
    .map((loc) => loc.field);
}

// Fields

export function insertField(def: FormDefinition, stepId: string, field: FieldDef, index?: number): FormDefinition {
  const i = stepIndexById(def, stepId);
  if (i < 0) return def;
  const steps = def.steps.slice();
  const fields = steps[i].fields.slice();
  const at = index === undefined ? fields.length : Math.max(0, Math.min(index, fields.length));
  fields.splice(at, 0, field);
  steps[i] = { ...steps[i], fields };
  return { ...def, steps };
}

export type FieldPatch = Partial<Omit<FieldDef, "id">>;

export function updateField(def: FormDefinition, fieldId: string, patch: FieldPatch): FormDefinition {
  const loc = locateField(def, fieldId);
  if (!loc) return def;
  const steps = def.steps.slice();
  const fields = loc.step.fields.slice();
  const merged: FieldDef = { ...loc.field, ...patch };
  // Keep the stored shape tidy: drop keys explicitly set to undefined.
  const loose = merged as unknown as Record<string, unknown>;
  for (const k of Object.keys(loose)) {
    if (loose[k] === undefined) delete loose[k];
  }
  fields[loc.fieldIndex] = merged;
  steps[loc.stepIndex] = { ...loc.step, fields };
  return { ...def, steps };
}

export function removeField(def: FormDefinition, fieldId: string): FormDefinition {
  const loc = locateField(def, fieldId);
  if (!loc) return def;
  const steps = def.steps.slice();
  steps[loc.stepIndex] = { ...loc.step, fields: loc.step.fields.filter((f) => f.id !== fieldId) };
  return clearShowIfFor({ ...def, steps }, new Set([loc.field.key]));
}

export function moveFieldInStep(def: FormDefinition, stepId: string, from: number, to: number): FormDefinition {
  const i = stepIndexById(def, stepId);
  if (i < 0 || from === to) return def;
  const steps = def.steps.slice();
  steps[i] = { ...steps[i], fields: moveItem(steps[i].fields, from, to) };
  return { ...def, steps };
}

/** Moves a field to the end (or `index`) of another fields step. */
export function moveFieldToStep(def: FormDefinition, fieldId: string, toStepId: string, index?: number): FormDefinition {
  const loc = locateField(def, fieldId);
  const target = stepIndexById(def, toStepId);
  if (!loc || target < 0 || def.steps[target].kind !== "fields") return def;
  if (loc.step.id === toStepId) return def;
  const steps = def.steps.slice();
  steps[loc.stepIndex] = { ...loc.step, fields: loc.step.fields.filter((f) => f.id !== fieldId) };
  const targetFields = steps[target].fields.slice();
  const at = index === undefined ? targetFields.length : Math.max(0, Math.min(index, targetFields.length));
  targetFields.splice(at, 0, loc.field);
  steps[target] = { ...steps[target], fields: targetFields };
  return { ...def, steps };
}

/** New label; the key follows the label while it is still automatic and not locked. */
export function retitleField(
  def: FormDefinition,
  fieldId: string,
  label: string,
  opts: { locked: boolean; reserved: ReadonlySet<string> },
): FormDefinition {
  const loc = locateField(def, fieldId);
  if (!loc) return def;
  const field = loc.field;
  let key = field.key;
  if (!opts.locked && isAutoKey(def, field, opts.reserved)) {
    key = keyFromLabel(label, takenKeysFor(def, field.id, opts.reserved, field.key));
  }
  const next = updateField(def, fieldId, { label, key });
  return followKeyChange(def, next, fieldId, field.key, key);
}

/** An emptied key box gets a key from the label again (validateDefinition would invent one anyway). */
export function fillEmptyKey(def: FormDefinition, fieldId: string, reserved: ReadonlySet<string>): FormDefinition {
  const loc = locateField(def, fieldId);
  if (!loc || loc.field.key) return def;
  const key = keyFromLabel(loc.field.label || loc.field.type, takenKeysFor(def, fieldId, reserved));
  return updateField(def, fieldId, { key });
}

/** Sets a typed key (already sanitized) and keeps show-if rules pointing at this field. */
export function rekeyField(def: FormDefinition, fieldId: string, key: string): FormDefinition {
  const loc = locateField(def, fieldId);
  if (!loc || loc.field.key === key) return def;
  const next = updateField(def, fieldId, { key });
  return followKeyChange(def, next, fieldId, loc.field.key, key);
}

/** Role change; null clears it. A role held by another field is refused (returns def). */
export function setFieldRole(def: FormDefinition, fieldId: string, role: FieldRole | null): FormDefinition {
  const loc = locateField(def, fieldId);
  if (!loc) return def;
  if (role) {
    if (!rolesForType(loc.field.type).includes(role)) return def;
    if (rolesInUse(def, fieldId).has(role)) return def;
  }
  return updateField(def, fieldId, { role: role ?? null });
}

/** Switch within a type family (text / long text, single / dropdown / multiple). */
export function changeFieldType(def: FormDefinition, fieldId: string, type: FieldType): FormDefinition {
  const loc = locateField(def, fieldId);
  if (!loc || loc.field.type === type) return def;
  const family = typeFamily(loc.field.type);
  if (!family || !family.includes(type)) return def;
  const field = loc.field;
  const patch: FieldPatch = { type };
  if (field.role && !rolesForType(type).includes(field.role)) patch.role = null;
  if (usesChoices(type)) {
    if (type === "select") {
      patch.layout = undefined;
      patch.choices = (field.choices ?? []).map((c) => {
        if (!c.isOther) return c;
        const rest = { ...c };
        delete rest.isOther;
        return rest;
      });
    } else if (!field.layout) {
      patch.layout = type === "checkbox" ? "chips" : "list";
    }
  }
  if (type === "textarea" && !field.maxLength) patch.maxLength = 2000;
  return updateField(def, fieldId, patch);
}

export function createFieldFromTemplate(
  def: FormDefinition,
  templateId: FieldTemplateId,
  reserved: ReadonlySet<string>,
): FieldDef {
  const draft = FIELD_TEMPLATES[templateId].build();
  const { preferredRole, ...rest } = draft;
  const used = rolesInUse(def);
  const role =
    preferredRole && rolesForType(rest.type).includes(preferredRole) && !used.has(preferredRole)
      ? preferredRole
      : null;
  const taken = takenKeysFor(def, null, reserved);
  const field: FieldDef = {
    ...rest,
    id: newId(),
    key: keyFromLabel(rest.label, taken),
    role,
  };
  if (field.type === "budget") field.budget = defaultBudgetConfig(newId);
  return field;
}

/** A copy of a field (new id and key, no role: roles are one per form), not yet inserted. */
export function duplicateFieldCopy(def: FormDefinition, fieldId: string, reserved: ReadonlySet<string>): FieldDef | null {
  const loc = locateField(def, fieldId);
  if (!loc) return null;
  const copy = deepCopy(loc.field);
  copy.id = newId();
  copy.label = `${loc.field.label} (copy)`;
  copy.role = null;
  copy.key = keyFromLabel(copy.label, takenKeysFor(def, null, reserved));
  if (copy.budget?.tiers) copy.budget.tiers = copy.budget.tiers.map((t) => ({ ...t, id: newId() }));
  return copy;
}

/** Inserts `copy` right after the field `afterFieldId` (same step). */
export function insertAfterField(def: FormDefinition, afterFieldId: string, copy: FieldDef): FormDefinition {
  const loc = locateField(def, afterFieldId);
  if (!loc) return def;
  return insertField(def, loc.step.id, copy, loc.fieldIndex + 1);
}

/** Copies a field right after itself. */
export function duplicateField(
  def: FormDefinition,
  fieldId: string,
  reserved: ReadonlySet<string>,
): { def: FormDefinition; fieldId: string } | null {
  const copy = duplicateFieldCopy(def, fieldId, reserved);
  if (!copy) return null;
  return { def: insertAfterField(def, fieldId, copy), fieldId: copy.id };
}

/**
 * Makes a stored definition safe for the editor to render (moved to the pure definition module:
 * saveDraft stores a draft with problems in exactly this shape, so it loads back unchanged).
 */
export { coerceDefinition } from "@/lib/inquiry-forms/definition";

// Choices

/**
 * snake_case value from a label, unique within the field ("Photo Booth" -> "photo_booth").
 * Same generator the presets use (keyFromLabel), so starter forms and builder edits agree.
 */
export function choiceValueFromLabel(label: string, taken: ReadonlySet<string>): string {
  return keyFromLabel(label.trim() ? label : "option", new Set(taken));
}

export function sanitizeChoiceValue(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 100);
}

function otherValues(choices: readonly Choice[], index: number): Set<string> {
  return new Set(choices.filter((_, i) => i !== index).map((c) => c.value));
}

/** True while the value still equals what the label would generate. */
export function isAutoChoiceValue(choices: readonly Choice[], index: number): boolean {
  const c = choices[index];
  return Boolean(c) && c.value === choiceValueFromLabel(c.label, otherValues(choices, index));
}

/** Relabels a choice; the value follows unless it was typed by hand or is protected. */
export function relabelChoice(choices: readonly Choice[], index: number, label: string, protectValue: boolean): Choice[] {
  const next = choices.slice();
  const c = next[index];
  if (!c) return next;
  const auto = !protectValue && isAutoChoiceValue(choices, index);
  next[index] = { ...c, label, value: auto ? choiceValueFromLabel(label, otherValues(choices, index)) : c.value };
  return next;
}

export function nextChoiceLabel(choices: readonly Choice[]): string {
  const labels = new Set(choices.map((c) => c.label.trim().toLowerCase()));
  let n = choices.length + 1;
  while (labels.has(`option ${n}`)) n++;
  return `Option ${n}`;
}

export function appendChoices(choices: readonly Choice[], labels: string[]): Choice[] {
  const next = choices.slice();
  for (const raw of labels) {
    const label = raw.trim();
    if (!label) continue;
    const taken = new Set(next.map((c) => c.value));
    next.push({ value: choiceValueFromLabel(label, taken), label });
  }
  return next;
}

/** Only one "Other" write-in per field. */
export function setOtherChoice(choices: readonly Choice[], index: number, on: boolean): Choice[] {
  return choices.map((c, i) => {
    if (i === index) {
      if (on) return { ...c, isOther: true };
      const rest = { ...c };
      delete rest.isOther;
      return rest;
    }
    if (on && c.isOther) {
      const rest = { ...c };
      delete rest.isOther;
      return rest;
    }
    return c;
  });
}

// Budget

export function newBudgetTier(tiers: readonly BudgetTier[]): BudgetTier {
  return { id: newId(), label: `Range ${tiers.length + 1}`, min: null, max: null, acceptable: true };
}

/** "$1,000" / "1000" / "1,000.50" -> 1000 / 1000 / 1000.5; blank -> null; junk -> undefined. */
export function parseMoney(raw: string): number | null | undefined {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

// Show-if

export function showIfOpsFor(source: FieldDef): ShowIf["op"][] {
  if (source.type === "radio" || source.type === "select" || source.type === "contact_preference") {
    return ["equals", "not_equals", "answered"];
  }
  if (source.type === "checkbox" && (source.choices?.length ?? 0) > 0) {
    return ["includes", "not_includes", "answered"];
  }
  // A price-range budget answers with a tier id, so it can be matched like a single choice.
  if (source.type === "budget" && source.budget?.mode === "tiers" && (source.budget.tiers?.length ?? 0) > 0) {
    return ["equals", "not_equals", "answered"];
  }
  return ["answered"];
}

/** The answers a show-if rule can match on (values are what visibility.ts compares). */
export function showIfChoicesFor(source: FieldDef): ReadonlyArray<{ value: string; label: string }> {
  if (source.type === "contact_preference") return CONTACT_PREFERENCE_CHOICES;
  if (usesChoices(source.type)) return (source.choices ?? []).map((c) => ({ value: c.value, label: c.label }));
  if (source.type === "budget" && source.budget?.mode === "tiers") {
    return (source.budget.tiers ?? []).map((t) => ({ value: t.id, label: t.label }));
  }
  return [];
}

export function opNeedsValues(op: ShowIf["op"]): boolean {
  return op !== "answered";
}

/** A starting rule for a source field (first op, no values picked yet). */
export function defaultShowIf(source: FieldDef): ShowIf {
  const op = showIfOpsFor(source)[0];
  return opNeedsValues(op) ? { fieldKey: source.key, op, values: [] } : { fieldKey: source.key, op };
}
