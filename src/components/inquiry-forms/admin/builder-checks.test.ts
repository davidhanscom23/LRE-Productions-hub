import { describe, expect, it } from "vitest";
import { mergeFormSettings } from "@/lib/inquiry-forms/defaults";
import { validateDefinition } from "@/lib/inquiry-forms/definition";
import type { BrandProfile, FieldDef, FormDefinition } from "@/lib/inquiry-forms/types";
import {
  checkDefinition,
  checkSettings,
  locateValidationMessage,
  mergeValidationErrors,
  sectionForSettingsPath,
  type CheckContext,
} from "./builder-checks";
import { createFieldFromTemplate, insertField, insertStep, newFieldsStep, newQualifyStep } from "./builder-ops";
import type { FieldTemplateId } from "./builder-catalog";

const BRAND: BrandProfile = {
  key: "vident",
  name: "LRE Productions",
  logoUrl: "/logo.png",
  logoOnDark: false,
  siteUrl: "https://example.com",
  privacyUrl: null,
  phone: "904-571-9064",
  email: "events@example.com",
  accentColor: "#ae4213",
  legalLine: null,
};

const ctx: CheckContext = { business: null, brands: [BRAND], savedSlug: "check-your-date", slugLocked: false };

function build(layout: Array<FieldTemplateId[] | "qualify">): FormDefinition {
  let def: FormDefinition = { version: 1, steps: [] };
  layout.forEach((entry, i) => {
    if (entry === "qualify") {
      def = insertStep(def, { ...newQualifyStep(def, true), title: "Checking our calendar" });
      return;
    }
    const s = { ...newFieldsStep(), title: `Questions ${i + 1}` };
    def = insertStep(def, s);
    for (const t of entry) def = insertField(def, s.id, createFieldFromTemplate(def, t, new Set()));
  });
  return def;
}

const GOOD: Array<FieldTemplateId[] | "qualify"> = [
  ["full_name", "phone", "email", "event_date", "event_location"],
  "qualify",
  ["event_type", "budget", "contact_preference", "long_text"],
];

function settings() {
  return mergeFormSettings({ brand: "vident", accentColor: "#ae4213" });
}

function errorsOf(def: FormDefinition) {
  return checkDefinition(def, ctx).filter((i) => i.severity === "error");
}

describe("checkDefinition", () => {
  it("a well-formed form has no problems", () => {
    expect(errorsOf(build(GOOD))).toEqual([]);
  });

  it("flags an availability check as the last step, at that step", () => {
    const def = build([["full_name", "phone", "email", "event_date", "event_location"], "qualify"]);
    const issues = errorsOf(def);
    expect(issues.some((i) => i.id.endsWith(":last") && i.target?.tab === "build" && i.target.stepId === def.steps[1].id)).toBe(true);
  });

  it("flags a date check with no earlier date question", () => {
    const def = build([["full_name", "email"], "qualify", ["event_date"]]);
    expect(errorsOf(def).some((i) => i.id.endsWith(":no-date"))).toBe(true);
  });

  it("flags a first step without email or phone", () => {
    const def = build([["full_name"], ["email"]]);
    expect(errorsOf(def).some((i) => i.id === "form:first-contact")).toBe(true);
  });

  it("flags duplicate keys on the later field", () => {
    const def = build(GOOD);
    const fields = def.steps[2].fields;
    fields[1] = { ...fields[1], key: fields[0].key };
    const dup = errorsOf(def).find((i) => i.id.endsWith(":key-dup"));
    expect(dup?.target).toEqual({ tab: "build", stepId: def.steps[2].id, fieldId: fields[1].id });
  });
});

describe("validateDefinition messages", () => {
  it("are located at the right step and field", () => {
    const def = build(GOOD);
    const s3 = def.steps[2];
    const broken: FieldDef = { ...s3.fields[0], choices: [] }; // radio with no options
    s3.fields[0] = broken;
    const v = validateDefinition(def);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    const msg = v.errors.find((m) => m.includes("needs at least one option"));
    expect(msg).toBeTruthy();
    expect(locateValidationMessage(def, msg as string)).toEqual({ tab: "build", stepId: s3.id, fieldId: broken.id });
  });

  it("the last-step and duplicate-step messages point at steps", () => {
    const def = build([["full_name", "phone", "email", "event_date", "event_location"], "qualify"]);
    const v = validateDefinition(def);
    if (v.ok) throw new Error("expected errors");
    const last = v.errors.find((m) => m.startsWith("The last step must be"));
    expect(locateValidationMessage(def, last as string)).toEqual({ tab: "build", stepId: def.steps[1].id, fieldId: null });
  });

  it("merging never lists one problem twice but keeps unplaced ones", () => {
    const def = build(GOOD);
    const fields = def.steps[2].fields;
    fields[1] = { ...fields[1], key: fields[0].key };
    const local = checkDefinition(def, ctx);
    const v = validateDefinition(def);
    if (v.ok) throw new Error("expected errors");
    const merged = mergeValidationErrors(local, v.errors, def);
    const atField = merged.filter((i) => i.severity === "error" && i.target?.tab === "build" && i.target.fieldId === fields[1].id);
    expect(atField).toHaveLength(1);
    const withUnplaced = mergeValidationErrors(local, [...v.errors, "Something nobody can place."], def);
    expect(withUnplaced.some((i) => i.message === "Something nobody can place." && i.target === null)).toBe(true);
  });
});

describe("checkSettings", () => {
  const draft = (patch: Partial<{ name: string; slug: string }> = {}, s = settings()) => ({
    name: "Check Your Date",
    slug: "check-your-date",
    definition: build(GOOD),
    settings: s,
    ...patch,
  });

  it("default settings with a known brand have no problems", () => {
    expect(checkSettings(draft(), ctx).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("reports what saveDraft would refuse, in the right section", () => {
    const s = settings();
    s.redirectUrl = "javascript:alert(1)";
    s.thankYou = { title: "", message: "Thanks" };
    const issues = checkSettings(draft({ name: "  " }, s), ctx).filter((i) => i.severity === "error");
    const sections = issues.map((i) => (i.target?.tab === "settings" ? i.target.section : null));
    expect(sections).toContain("basics");
    expect(sections).toContain("thanks");
    expect(issues.length).toBeGreaterThanOrEqual(3);
  });

  it("a published form cannot change its address", () => {
    const issues = checkSettings(draft({ slug: "new-address" }), { ...ctx, slugLocked: true });
    expect(issues.some((i) => i.id === "settings:slug-locked" && i.severity === "error")).toBe(true);
  });

  it("warns (never blocks) on a light accent", () => {
    const s = settings();
    s.accentColor = "#9a7340";
    const issues = checkSettings(draft({}, s), ctx);
    expect(issues.find((i) => i.id === "settings:accent-contrast")?.severity).toBe("warning");
  });

  it("maps validator paths to sections", () => {
    expect(sectionForSettingsPath("thankYou.title")).toBe("thanks");
    expect(sectionForSettingsPath("referral.links.0.url")).toBe("location");
    expect(sectionForSettingsPath("qualify.timings.popupMs")).toBe("qualify");
    expect(sectionForSettingsPath("notify.recipients")).toBe("emails");
    expect(sectionForSettingsPath("accentColor")).toBe("brand");
  });
});
