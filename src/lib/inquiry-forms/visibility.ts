/**
 * Inquiry Forms - conditional field visibility ("show this field when...").
 *
 * PURE module, imported by the public renderer AND the server, so both always agree on which
 * fields are visible (hidden fields are never validated and their answers are stripped).
 *
 * Semantics (comparisons are trimmed and case-insensitive):
 * - equals / includes: at least one of the referenced answer's values is in `values`
 *   (works for single answers and multi-select arrays alike).
 * - not_equals / not_includes: none of the answer's values is in `values` (an empty answer matches).
 * - answered: the referenced field has a non-empty answer (unchecked consent and a skipped budget
 *   count as not answered).
 * A field without a condition is always visible. An unknown operator fails open (visible).
 */

import type { AnswerValue, Answers, FieldDef, StepDef } from "./types";

function ownValue(answers: Answers | null | undefined, key: string): AnswerValue | undefined {
  if (!answers || typeof answers !== "object") return undefined;
  return Object.prototype.hasOwnProperty.call(answers, key) ? answers[key] : undefined;
}

/** Lowercased comparable tokens of an answer (tier answers compare by tier id). */
export function answerTokens(value: AnswerValue | undefined): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    return t ? [t] : [];
  }
  if (typeof value === "number") return Number.isFinite(value) ? [String(value)] : [];
  if (typeof value === "boolean") return [value ? "true" : "false"];
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const v of value) {
      if (typeof v !== "string") continue;
      const t = v.trim().toLowerCase();
      if (t && !out.includes(t)) out.push(t);
    }
    return out;
  }
  if (typeof value === "object") {
    if (value.type === "tier" && typeof value.tierId === "string" && value.tierId.trim()) {
      return [value.tierId.trim().toLowerCase()];
    }
    if (value.type === "amount" && typeof value.amount === "number" && Number.isFinite(value.amount)) {
      return [String(value.amount)];
    }
  }
  return [];
}

/** True when an answer counts as given (false consent, empty arrays and a skipped budget do not). */
export function hasAnswer(value: AnswerValue | undefined): boolean {
  if (value === true) return true;
  if (value === false) return false;
  return answerTokens(value).length > 0;
}

/** Should `field` show, given the answers so far? */
export function isFieldVisible(field: FieldDef, answers: Answers): boolean {
  const cond = field?.showIf;
  if (!cond || typeof cond !== "object" || typeof cond.fieldKey !== "string" || !cond.fieldKey) return true;
  const value = ownValue(answers, cond.fieldKey);
  if (cond.op === "answered") return hasAnswer(value);
  const wanted = (Array.isArray(cond.values) ? cond.values : [])
    .map((v) => String(v).trim().toLowerCase())
    .filter((v) => v.length > 0);
  const got = answerTokens(value);
  const anyMatch = got.some((t) => wanted.includes(t));
  switch (cond.op) {
    case "equals":
    case "includes":
      return anyMatch;
    case "not_equals":
    case "not_includes":
      return !anyMatch;
    default:
      return true;
  }
}

/**
 * The step's visible fields, in order (content blocks included). Evaluated progressively: a
 * field hidden earlier in the step counts as unanswered for fields after it, so condition
 * chains resolve. For chains that cross steps, pass answers through stripHidden() first.
 */
export function visibleFields(step: StepDef, answers: Answers): FieldDef[] {
  const working: Answers = { ...(answers ?? {}) };
  const out: FieldDef[] = [];
  for (const field of step?.fields ?? []) {
    if (isFieldVisible(field, working)) {
      out.push(field);
    } else {
      delete working[field.key];
      delete working[`${field.key}__other`];
      delete working[`${field.key}__end`];
    }
  }
  return out;
}
