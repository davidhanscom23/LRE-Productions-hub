import { describe, expect, it } from "vitest";
import { answerTokens, hasAnswer, isFieldVisible, visibleFields } from "./visibility";
import type { Answers, FieldDef, ShowIf, StepDef } from "./types";

function f(key: string, showIf?: ShowIf | null, extra: Partial<FieldDef> = {}): FieldDef {
  return { id: key, key, type: "text", label: key, required: false, width: "full", showIf: showIf ?? null, ...extra };
}

describe("isFieldVisible", () => {
  it("shows a field without a condition", () => {
    expect(isFieldVisible(f("a"), {})).toBe(true);
    expect(isFieldVisible(f("a", null), {})).toBe(true);
  });

  it("equals: single value, case-insensitive and trimmed", () => {
    const field = f("planning", { fieldKey: "event_type", op: "equals", values: ["wedding"] });
    expect(isFieldVisible(field, { event_type: "wedding" })).toBe(true);
    expect(isFieldVisible(field, { event_type: " Wedding " })).toBe(true);
    expect(isFieldVisible(field, { event_type: "corporate_event" })).toBe(false);
    expect(isFieldVisible(field, {})).toBe(false);
  });

  it("equals with several values matches any of them", () => {
    const field = f("x", { fieldKey: "t", op: "equals", values: ["wedding", "mitzvah"] });
    expect(isFieldVisible(field, { t: "mitzvah" })).toBe(true);
    expect(isFieldVisible(field, { t: "other" })).toBe(false);
  });

  it("includes / not_includes on a multi-select", () => {
    const shown = f("style", { fieldKey: "services", op: "includes", values: ["photo_booth"] });
    const notShown = f("why", { fieldKey: "services", op: "not_includes", values: ["photo_booth"] });
    const answers: Answers = { services: ["dj_mc", "photo_booth"] };
    expect(isFieldVisible(shown, answers)).toBe(true);
    expect(isFieldVisible(notShown, answers)).toBe(false);
    expect(isFieldVisible(shown, { services: ["dj_mc"] })).toBe(false);
    expect(isFieldVisible(notShown, { services: ["dj_mc"] })).toBe(true);
    expect(isFieldVisible(shown, { services: [] })).toBe(false);
    expect(isFieldVisible(notShown, {})).toBe(true);
  });

  it("includes also works on a single answer, equals on an array (lenient)", () => {
    expect(isFieldVisible(f("x", { fieldKey: "t", op: "includes", values: ["a"] }), { t: "a" })).toBe(true);
    expect(isFieldVisible(f("x", { fieldKey: "t", op: "equals", values: ["a"] }), { t: ["b", "a"] })).toBe(true);
  });

  it("not_equals shows the field while the parent is unanswered", () => {
    const field = f("x", { fieldKey: "t", op: "not_equals", values: ["wedding"] });
    expect(isFieldVisible(field, {})).toBe(true);
    expect(isFieldVisible(field, { t: "wedding" })).toBe(false);
    expect(isFieldVisible(field, { t: "gala" })).toBe(true);
  });

  it("answered: blank, empty, unchecked and skipped do not count; 0 does", () => {
    const field = f("x", { fieldKey: "t", op: "answered" });
    expect(isFieldVisible(field, { t: "" })).toBe(false);
    expect(isFieldVisible(field, { t: "   " })).toBe(false);
    expect(isFieldVisible(field, { t: [] })).toBe(false);
    expect(isFieldVisible(field, { t: false })).toBe(false);
    expect(isFieldVisible(field, { t: null })).toBe(false);
    expect(isFieldVisible(field, { t: { type: "skip" } })).toBe(false);
    expect(isFieldVisible(field, { t: true })).toBe(true);
    expect(isFieldVisible(field, { t: 0 })).toBe(true);
    expect(isFieldVisible(field, { t: "hi" })).toBe(true);
    expect(isFieldVisible(field, { t: { type: "tier", tierId: "x" } })).toBe(true);
  });

  it("compares budget tiers by id and numbers by value", () => {
    expect(isFieldVisible(f("x", { fieldKey: "b", op: "equals", values: ["under_1000"] }), { b: { type: "tier", tierId: "under_1000" } })).toBe(true);
    expect(isFieldVisible(f("x", { fieldKey: "n", op: "equals", values: ["12"] }), { n: 12 })).toBe(true);
    expect(isFieldVisible(f("x", { fieldKey: "c", op: "equals", values: ["true"] }), { c: true })).toBe(true);
  });

  it("never reads inherited object properties", () => {
    const field = f("x", { fieldKey: "constructor", op: "answered" });
    expect(isFieldVisible(field, {})).toBe(false);
  });

  it("fails open (visible) on an unknown operator", () => {
    const field = f("x", { fieldKey: "t", op: "matches" as ShowIf["op"], values: ["a"] });
    expect(isFieldVisible(field, {})).toBe(true);
  });
});

describe("visibleFields", () => {
  const step: StepDef = {
    id: "s",
    kind: "fields",
    title: "T",
    fields: [
      f("type", null, { type: "radio", choices: [{ value: "wedding", label: "Wedding" }, { value: "gala", label: "Gala" }] }),
      f("planning", { fieldKey: "type", op: "equals", values: ["wedding"] }),
      f("planner_name", { fieldKey: "planning", op: "answered" }),
      f("notes"),
    ],
  };

  it("resolves condition chains: a hidden parent hides its children even with a stale answer", () => {
    const answers: Answers = { type: "gala", planning: "full service (stale)", planner_name: "Ann" };
    expect(visibleFields(step, answers).map((x) => x.key)).toEqual(["type", "notes"]);
    expect(visibleFields(step, { type: "wedding", planning: "full" }).map((x) => x.key)).toEqual([
      "type",
      "planning",
      "planner_name",
      "notes",
    ]);
  });

  it("does not mutate the answers it is given", () => {
    const answers: Answers = { type: "gala", planning: "x" };
    visibleFields(step, answers);
    expect(answers).toEqual({ type: "gala", planning: "x" });
  });

  it("tolerates missing answers", () => {
    expect(visibleFields(step, undefined as unknown as Answers).map((x) => x.key)).toEqual(["type", "notes"]);
  });
});

describe("answerTokens / hasAnswer", () => {
  it("normalizes answers for comparison", () => {
    expect(answerTokens(" A ")).toEqual(["a"]);
    expect(answerTokens(["A", " b ", "a", ""])).toEqual(["a", "b"]);
    expect(answerTokens(Number.NaN)).toEqual([]);
    expect(answerTokens({ type: "amount", amount: 2500 })).toEqual(["2500"]);
    expect(answerTokens(undefined)).toEqual([]);
    expect(hasAnswer(false)).toBe(false);
    expect(hasAnswer(true)).toBe(true);
  });
});
