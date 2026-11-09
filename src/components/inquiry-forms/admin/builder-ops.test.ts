import { describe, expect, it } from "vitest";
import { HONEYPOT_INPUT_NAME, validateDefinition } from "@/lib/inquiry-forms/definition";
import type { FieldDef, FormDefinition, StepDef } from "@/lib/inquiry-forms/types";
import {
  appendChoices,
  changeFieldType,
  choiceValueFromLabel,
  coerceDefinition,
  createFieldFromTemplate,
  duplicateField,
  fillEmptyKey,
  insertField,
  insertStep,
  isAutoChoiceValue,
  keyProblem,
  locateField,
  moveFieldInStep,
  moveFieldToStep,
  moveStep,
  newFieldsStep,
  newQualifyStep,
  parseMoney,
  rekeyField,
  relabelChoice,
  removeField,
  removeStep,
  retitleField,
  sanitizeKeyInput,
  setFieldRole,
  setOtherChoice,
  showIfChoicesFor,
  showIfOpsFor,
  stableStringify,
  updateField,
} from "./builder-ops";
import type { FieldTemplateId } from "./builder-catalog";

const NONE: ReadonlySet<string> = new Set();

function step(id: string, fields: FieldDef[], extra: Partial<StepDef> = {}): StepDef {
  return { id, kind: "fields", title: `Step ${id}`, fields, ...extra };
}

function field(id: string, key: string, patch: Partial<FieldDef> = {}): FieldDef {
  return { id, key, type: "text", label: key, required: false, width: "full", ...patch };
}

/** Builds a definition the way the builder does: templates added one by one. */
function buildWithTemplates(layout: Array<FieldTemplateId[] | "qualify">): FormDefinition {
  let def: FormDefinition = { version: 1, steps: [] };
  for (const entry of layout) {
    if (entry === "qualify") {
      def = insertStep(def, newQualifyStep(def, true));
      continue;
    }
    const s = newFieldsStep();
    def = insertStep(def, { ...s, title: "Details" });
    for (const t of entry) def = insertField(def, s.id, createFieldFromTemplate(def, t, NONE));
  }
  return def;
}

describe("templates", () => {
  it("everything the Add field menu creates passes validateDefinition", () => {
    const def = buildWithTemplates([
      ["full_name", "phone", "email", "event_date", "event_location"],
      "qualify",
      ["event_type", "event_time", "guest_count", "single_choice", "multiple_choice", "dropdown"],
      ["short_text", "long_text", "number", "budget", "contact_preference", "text_block", "company"],
    ]);
    const v = validateDefinition(def);
    expect(v.ok ? [] : v.errors).toEqual([]);
    const qualify = def.steps[1];
    expect(qualify.kind).toBe("qualify");
    expect(qualify.checks).toEqual(["date", "location"]);
  });

  it("gives roles only while they are free and keeps keys unique", () => {
    let def: FormDefinition = { version: 1, steps: [step("s1", [])] };
    const first = createFieldFromTemplate(def, "email", NONE);
    def = insertField(def, "s1", first);
    const second = createFieldFromTemplate(def, "email", NONE);
    expect(first.role).toBe("email");
    expect(first.key).toBe("email");
    expect(second.role).toBeNull();
    expect(second.key).toBe("email_2");
  });

  it("never reuses a retired key that still holds answers", () => {
    const def: FormDefinition = { version: 1, steps: [step("s1", [])] };
    const f = createFieldFromTemplate(def, "email", new Set(["email"]));
    expect(f.key).toBe("email_2");
  });

  it("starts choice fields with choices and budgets with ranges", () => {
    const def: FormDefinition = { version: 1, steps: [step("s1", [])] };
    const radio = createFieldFromTemplate(def, "event_type", NONE);
    expect(radio.choices?.map((c) => c.value)).toEqual(["wedding", "corporate_event", "birthday_or_milestone", "other"]);
    expect(radio.choices?.[3].isOther).toBe(true);
    const budget = createFieldFromTemplate(def, "budget", NONE);
    expect(budget.budget?.tiers?.length).toBe(4);
    expect(new Set(budget.budget?.tiers?.map((t) => t.id)).size).toBe(4);
  });
});

describe("keys follow labels until set by hand", () => {
  const base = (): FormDefinition => ({
    version: 1,
    steps: [
      step("s1", [
        field("a", "guest_count", { label: "Guest count", type: "number" }),
        field("b", "custom_key", { label: "Notes" }),
        field("c", "other", { label: "Other", showIf: { fieldKey: "guest_count", op: "answered" } }),
      ]),
    ],
  });

  it("re-derives an automatic key and points show rules at it", () => {
    const def = retitleField(base(), "a", "Number of guests", { locked: false, reserved: NONE });
    expect(locateField(def, "a")?.field.key).toBe("number_of_guests");
    expect(locateField(def, "c")?.field.showIf?.fieldKey).toBe("number_of_guests");
  });

  it("keeps a hand-typed key", () => {
    const def = retitleField(base(), "b", "Anything else?", { locked: false, reserved: NONE });
    expect(locateField(def, "b")?.field.key).toBe("custom_key");
    expect(locateField(def, "b")?.field.label).toBe("Anything else?");
  });

  it("never changes a locked key", () => {
    const def = retitleField(base(), "a", "Number of guests", { locked: true, reserved: new Set(["guest_count"]) });
    expect(locateField(def, "a")?.field.key).toBe("guest_count");
  });

  it("rekeys and follows show rules, but never hijacks another field's rules", () => {
    const renamed = rekeyField(base(), "a", "guests");
    expect(locateField(renamed, "c")?.field.showIf?.fieldKey).toBe("guests");
    // Typing a key that collides with another field must not repoint rules.
    const collide = rekeyField(base(), "a", "custom_key");
    expect(locateField(collide, "c")?.field.showIf?.fieldKey).toBe("guest_count");
  });
});

describe("key rules", () => {
  const def: FormDefinition = { version: 1, steps: [step("s1", [field("a", "name"), field("b", "email")])] };
  it("matches validateDefinition", () => {
    expect(keyProblem(def, "a", "")).toBeTruthy();
    expect(keyProblem(def, "a", "1abc")).toBeTruthy();
    expect(keyProblem(def, "a", "a__b")).toMatch(/single underscores/);
    expect(keyProblem(def, "a", HONEYPOT_INPUT_NAME)).toMatch(/reserved/);
    expect(keyProblem(def, "a", "company_website")).toBeNull();
    expect(keyProblem(def, "a", "email")).toMatch(/already uses/);
    expect(keyProblem(def, "a", "full_name")).toBeNull();
  });
  it("cleans typed keys", () => {
    expect(sanitizeKeyInput("Guest Count!")).toBe("guest_count");
    expect(sanitizeKeyInput("a - b__c")).toBe("a_b_c");
  });
  it("an emptied key is made from the label again, avoiding taken and retired keys", () => {
    const emptied: FormDefinition = {
      version: 1,
      steps: [step("s1", [field("a", "", { label: "Email" }), field("b", "email")])],
    };
    expect(locateField(fillEmptyKey(emptied, "a", new Set(["email_2"])), "a")?.field.key).toBe("email_3");
    // A key that is already set is left alone.
    expect(fillEmptyKey(def, "a", NONE)).toBe(def);
  });
});

describe("structure edits", () => {
  const def = (): FormDefinition => ({
    version: 1,
    steps: [
      step("s1", [field("a", "email", { type: "email", role: "email" }), field("b", "kind", { type: "radio", choices: [{ value: "x", label: "X" }] })]),
      step("s2", [field("c", "more", { showIf: { fieldKey: "kind", op: "equals", values: ["x"] } })]),
      step("s3", [field("d", "last")]),
    ],
  });

  it("moves steps and fields", () => {
    expect(moveStep(def(), 0, 2).steps.map((s) => s.id)).toEqual(["s2", "s3", "s1"]);
    expect(moveFieldInStep(def(), "s1", 0, 1).steps[0].fields.map((f) => f.id)).toEqual(["b", "a"]);
    const moved = moveFieldToStep(def(), "a", "s3");
    expect(moved.steps[0].fields.map((f) => f.id)).toEqual(["b"]);
    expect(moved.steps[2].fields.map((f) => f.id)).toEqual(["d", "a"]);
  });

  it("deleting a field clears the show rules that read it", () => {
    const next = removeField(def(), "b");
    expect(locateField(next, "c")?.field.showIf).toBeNull();
  });

  it("deleting a step clears show rules in other steps that read its fields", () => {
    const next = removeStep(def(), "s1");
    expect(next.steps.map((s) => s.id)).toEqual(["s2", "s3"]);
    expect(locateField(next, "c")?.field.showIf).toBeNull();
  });

  it("refuses a role another field holds and clears roles a new type cannot carry", () => {
    expect(setFieldRole(def(), "d", "email")).toEqual(def());
    const typed = changeFieldType(
      updateField(def(), "b", { role: "event_type", layout: "cards", choices: [{ value: "x", label: "X", isOther: true }] }),
      "b",
      "checkbox",
    );
    const b = locateField(typed, "b")?.field;
    expect(b?.type).toBe("checkbox");
    expect(b?.role).toBeNull();
    const toSelect = changeFieldType(updateField(def(), "b", { layout: "cards", choices: [{ value: "x", label: "X", isOther: true }] }), "b", "select");
    const s = locateField(toSelect, "b")?.field;
    expect(s?.layout).toBeUndefined();
    expect(s?.choices?.[0].isOther).toBeUndefined();
    // Not in the same family: refused.
    expect(changeFieldType(def(), "a", "number")).toEqual(def());
  });

  it("duplicates right after the original with a new id, key and no role", () => {
    const res = duplicateField(def(), "a", NONE);
    expect(res).not.toBeNull();
    const fields = res!.def.steps[0].fields;
    expect(fields.map((f) => f.id)).toEqual(["a", res!.fieldId, "b"]);
    expect(fields[1].role).toBeNull();
    expect(fields[1].key).not.toBe("email");
    expect(fields[1].label).toBe("email (copy)");
  });
});

describe("choices", () => {
  it("values are snake_case and unique", () => {
    expect(choiceValueFromLabel("Photo Booth", new Set())).toBe("photo_booth");
    expect(choiceValueFromLabel("Photo Booth", new Set(["photo_booth"]))).toBe("photo_booth_2");
    expect(choiceValueFromLabel("", new Set())).toBe("option");
  });

  it("relabeling moves an automatic value but keeps typed and protected ones", () => {
    const choices = [
      { value: "option_1", label: "Option 1" },
      { value: "my_value", label: "Option 2" },
    ];
    expect(isAutoChoiceValue(choices, 0)).toBe(true);
    expect(isAutoChoiceValue(choices, 1)).toBe(false);
    expect(relabelChoice(choices, 0, "Wedding", false)[0]).toEqual({ value: "wedding", label: "Wedding" });
    expect(relabelChoice(choices, 1, "Party", false)[1]).toEqual({ value: "my_value", label: "Party" });
    expect(relabelChoice(choices, 0, "Wedding", true)[0]).toEqual({ value: "option_1", label: "Wedding" });
  });

  it("only one Other per field, and pasted lists skip blanks", () => {
    const choices = [
      { value: "a", label: "A", isOther: true },
      { value: "b", label: "B" },
    ];
    const next = setOtherChoice(choices, 1, true);
    expect(next.map((c) => Boolean(c.isOther))).toEqual([false, true]);
    expect(appendChoices([], ["Wedding", "", "  ", "Wedding"]).map((c) => c.value)).toEqual(["wedding", "wedding_2"]);
  });
});

describe("show-if sources", () => {
  it("offers tier ids for a price-range budget and fixed contact options", () => {
    const def: FormDefinition = { version: 1, steps: [step("s1", [])] };
    const budget = createFieldFromTemplate(def, "budget", NONE);
    expect(showIfOpsFor(budget)).toEqual(["equals", "not_equals", "answered"]);
    expect(showIfChoicesFor(budget).map((c) => c.value)).toEqual(budget.budget?.tiers?.map((t) => t.id));
    const pref = createFieldFromTemplate(def, "contact_preference", NONE);
    expect(showIfChoicesFor(pref).map((c) => c.value)).toEqual(["email", "text", "phone"]);
    expect(showIfOpsFor(createFieldFromTemplate(def, "short_text", NONE))).toEqual(["answered"]);
    expect(showIfOpsFor(createFieldFromTemplate(def, "multiple_choice", NONE))).toEqual(["includes", "not_includes", "answered"]);
  });
});

describe("helpers", () => {
  it("stableStringify ignores key order and undefined", () => {
    expect(stableStringify({ b: 1, a: { d: undefined, c: [1, { y: 2, x: 1 }] } })).toBe(
      stableStringify({ a: { c: [1, { x: 1, y: 2 }] }, b: 1 }),
    );
    expect(stableStringify({ a: null })).not.toBe(stableStringify({}));
  });

  it("parseMoney reads whole dollars (never cents)", () => {
    expect(parseMoney("1000")).toBe(1000);
    expect(parseMoney("$1,000")).toBe(1000);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeUndefined();
  });

  it("coerceDefinition turns a broken row into something the editor can show", () => {
    expect(coerceDefinition(null)).toEqual({ version: 1, steps: [] });
    const def = coerceDefinition({ steps: [{ title: 5, fields: [{ type: "text", key: "a" }, "junk", { key: "no_type" }] }, "junk"] });
    expect(def.steps).toHaveLength(1);
    expect(def.steps[0].title).toBe("");
    expect(def.steps[0].kind).toBe("fields");
    expect(def.steps[0].fields).toHaveLength(1);
    expect(def.steps[0].fields[0].id).toBeTruthy();
    expect(def.steps[0].fields[0].width).toBe("full");
  });
});
