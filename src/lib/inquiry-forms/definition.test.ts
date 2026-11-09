import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTACT_PREFERENCE_CHOICES,
  HONEYPOT_INPUT_NAME,
  KEY_PATTERN,
  MAX_FIELDS,
  MAX_STEPS,
  allFields,
  baseKey,
  emptyDefinition,
  endKey,
  fieldChoices,
  findRoleField,
  firstStepContactOk,
  isConsentCheckbox,
  isMultiCheckbox,
  keyFromLabel,
  newId,
  otherChoice,
  otherKey,
  stepIndexOfField,
  validateDefinition,
} from "./definition";
import type { FieldDef, FormDefinition } from "./types";

// ===========================================================================
// Fixture: the Y1 "Check Your Date" structure from the spec (sec 5)
// ===========================================================================

type RawField = Record<string, unknown>;
type RawStep = { id?: string; kind?: string; title?: string; fields?: RawField[]; checks?: string[]; [k: string]: unknown };
type RawDef = { version?: number; steps: RawStep[] };

function choices(labels: string[], other?: string) {
  const taken = new Set<string>();
  const out: { value: string; label: string; isOther?: boolean }[] = labels.map((label) => {
    const value = keyFromLabel(label, taken);
    taken.add(value);
    return { value, label };
  });
  if (other) out.push({ value: keyFromLabel(other, taken), label: other, isOther: true });
  return out;
}

function y1(): RawDef {
  return {
    version: 1,
    steps: [
      {
        id: "s1",
        kind: "fields",
        title: "Let's check your date",
        progressLabel: "You",
        fields: [
          { id: "f1", key: "name", type: "text", role: "name", label: "Full name", required: true, width: "half" },
          { id: "f2", key: "phone", type: "phone", role: "phone", label: "Mobile phone", required: true, width: "half" },
          { id: "f3", key: "email", type: "email", role: "email", label: "Email", required: true, width: "full" },
          { id: "f4", key: "event_date", type: "date", role: "event_date", label: "Event date", required: true, width: "half" },
          {
            id: "f5",
            key: "event_location",
            type: "address",
            role: "event_location",
            label: "Venue or city",
            required: true,
            width: "half",
            placeholder: "Venue name or city, e.g. Casa Monica, St. Augustine",
          },
        ],
      },
      { id: "s2", kind: "qualify", title: "Checking our calendar", progressLabel: "Availability", fields: [], checks: ["date", "location"] },
      {
        id: "s3",
        kind: "fields",
        title: "Tell us about your event",
        progressLabel: "Event",
        fields: [
          {
            id: "f6",
            key: "event_type",
            type: "radio",
            role: "event_type",
            label: "Type of event",
            required: true,
            width: "full",
            layout: "cards",
            choices: choices(
              ["Wedding", "Corporate Event", "Birthday or Milestone", "School Dance or Prom", "Mitzvah", "Quinceanera or Sweet 16", "Holiday Party"],
              "Other",
            ),
          },
          { id: "f7", key: "guest_count", type: "number", role: "guest_count", label: "Guest count", required: false, width: "half", min: 1, max: 5000 },
          { id: "f8", key: "event_time", type: "time", role: "event_time", label: "Start and end time", required: false, width: "half", showEndTime: true },
        ],
      },
      {
        id: "s4",
        kind: "fields",
        title: "What would you like?",
        progressLabel: "Services",
        fields: [
          {
            id: "f9",
            key: "services",
            type: "checkbox",
            role: "services",
            label: "Services",
            required: true,
            width: "full",
            layout: "chips",
            choices: choices([
              "DJ / MC",
              "Lighting & Uplighting",
              "Photo Booth",
              "Cold Sparks",
              "CO2 Cannons",
              "Dancing on a Cloud",
              "Audio Guest Book",
              "Silent Disco",
              "LED Dance Floor",
              "Game Show (Partner Brand)",
            ]),
          },
          {
            id: "f10",
            key: "photo_booth_style",
            type: "radio",
            label: "Photo booth style",
            required: false,
            width: "full",
            showIf: { fieldKey: "services", op: "includes", values: ["photo_booth"] },
            choices: choices(["Digital Photo Booth", "Photo Booth with Prints", "Digital Roamer", "AI Photo Booth", "Not sure yet"]),
          },
          {
            id: "f11",
            key: "budget",
            type: "budget",
            role: "budget",
            label: "Budget for DJ/MC",
            required: false,
            width: "full",
            budget: {
              mode: "tiers",
              policy: "label",
              allowSkip: true,
              belowMessage: "Thanks for sharing. We'll suggest the options that fit your budget best.",
              tiers: [
                { id: "under_1000", label: "Under $1,000", min: null, max: 1000, acceptable: false },
                { id: "1000_1500", label: "$1,000 - $1,500", min: 1000, max: 1500, acceptable: true },
                { id: "1500_2500", label: "$1,500 - $2,500", min: 1500, max: 2500, acceptable: true },
                { id: "2500_4000", label: "$2,500 - $4,000", min: 2500, max: 4000, acceptable: true },
                { id: "4000_plus", label: "$4,000+", min: 4000, max: null, acceptable: true },
              ],
            },
          },
        ],
      },
      {
        id: "s5",
        kind: "fields",
        title: "Last step",
        progressLabel: "Finish",
        fields: [
          { id: "f12", key: "contact_preference", type: "contact_preference", role: "contact_preference", label: "How should we reach you?", required: true, width: "full" },
          {
            id: "f13",
            key: "referral_source",
            type: "select",
            role: "referral_source",
            label: "Who referred you to us?",
            required: false,
            width: "full",
            choices: choices(
              ["Google", "Instagram", "Facebook", "The Knot or WeddingWire", "Venue recommendation", "Planner", "Friend or family", "Saw us at an event"],
              "Other",
            ),
          },
          { id: "f14", key: "notes", type: "textarea", role: "notes", label: "Anything else we should know?", required: false, width: "full", maxLength: 2000 },
        ],
      },
    ],
  };
}

function errorsOf(input: unknown): string[] {
  const r = validateDefinition(input);
  return r.ok ? [] : r.errors;
}

function okDef(input: unknown): FormDefinition {
  const r = validateDefinition(input);
  if (!r.ok) throw new Error(`expected ok, got: ${r.errors.join(" | ")}`);
  return r.def;
}

function field(def: RawDef, step: number, key: string): RawField {
  const f = def.steps[step].fields?.find((x) => x.key === key);
  if (!f) throw new Error(`no field ${key}`);
  return f;
}

// ===========================================================================

describe("keyFromLabel", () => {
  it("makes the exact snake_case values presets and conditions rely on", () => {
    const none = new Set<string>();
    expect(keyFromLabel("Photo Booth", none)).toBe("photo_booth");
    expect(keyFromLabel("Wedding", none)).toBe("wedding");
    expect(keyFromLabel("Golf Experience", none)).toBe("golf_experience");
    expect(keyFromLabel("DJ / MC", none)).toBe("dj_mc");
    expect(keyFromLabel("Lighting & Uplighting", none)).toBe("lighting_uplighting");
    expect(keyFromLabel("Quinceañera or Sweet 16", none)).toBe("quinceanera_or_sweet_16");
    expect(keyFromLabel("Game Show (Partner Brand)", none)).toBe("game_show_partner_brand");
    expect(keyFromLabel("Who's coming?", none)).toBe("whos_coming");
  });

  it("adds _2, _3 for taken keys and never returns a reserved key", () => {
    expect(keyFromLabel("Guest count", new Set(["guest_count"]))).toBe("guest_count_2");
    expect(keyFromLabel("Guest count", new Set(["guest_count", "guest_count_2"]))).toBe("guest_count_3");
    expect(keyFromLabel("Inqf hp x", new Set())).toBe(`${HONEYPOT_INPUT_NAME}_2`);
    expect(keyFromLabel("Constructor", new Set())).toBe("constructor_2");
    // The honeypot moved off this name, so a real "Company website" question gets it.
    expect(keyFromLabel("Company website", new Set())).toBe("company_website");
  });

  it("prefixes keys that would start with a digit and names empty labels", () => {
    expect(keyFromLabel("2nd choice", new Set())).toBe("field_2nd_choice");
    expect(keyFromLabel("$1,000 - $1,500", new Set())).toBe("field_1_000_1_500");
    expect(keyFromLabel("", new Set())).toBe("field");
    expect(keyFromLabel("???", new Set(["field"]))).toBe("field_2");
  });

  it("caps at 48 characters, suffix included", () => {
    const long = "This is a very long question label that keeps going and going forever";
    const k1 = keyFromLabel(long, new Set());
    expect(k1.length).toBeLessThanOrEqual(48);
    const k2 = keyFromLabel(long, new Set([k1]));
    expect(k2.length).toBeLessThanOrEqual(48);
    expect(k2.endsWith("_2")).toBe(true);
    expect(k2).not.toBe(k1);
  });

  it("always returns a valid key with no double underscore (fuzz)", () => {
    const alphabet = "aZ09 _-&'’ñé?!/()__";
    let seed = 11;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const taken = new Set<string>();
    for (let i = 0; i < 500; i++) {
      let label = "";
      const len = Math.floor(rand() * 70);
      for (let j = 0; j < len; j++) label += alphabet[Math.floor(rand() * alphabet.length)];
      const key = keyFromLabel(label, taken);
      expect(KEY_PATTERN.test(key), `${JSON.stringify(label)} -> ${key}`).toBe(true);
      expect(key.includes("__")).toBe(false);
      expect(taken.has(key)).toBe(false);
      taken.add(key);
    }
  });
});

describe("newId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("returns unique UUID v4 strings", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = newId();
      expect(id).toMatch(UUID_V4);
      seen.add(id);
    }
    expect(seen.size).toBe(1000);
  });

  it("falls back to getRandomValues when randomUUID is missing (insecure http page)", () => {
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => a.fill(0xab) });
    expect(newId()).toMatch(UUID_V4);
  });

  it("falls back to Math.random when there is no crypto at all", () => {
    vi.stubGlobal("crypto", undefined);
    expect(newId()).toMatch(UUID_V4);
  });

  it("survives a randomUUID that throws", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => {
        throw new Error("insecure context");
      },
      getRandomValues: (a: Uint8Array) => a.fill(0x11),
    });
    expect(newId()).toMatch(UUID_V4);
  });
});

describe("emptyDefinition", () => {
  it("is a minimal, already valid form with a reachable contact on step 1", () => {
    const def = emptyDefinition();
    expect(def.version).toBe(1);
    expect(def.steps).toHaveLength(1);
    expect(firstStepContactOk(def)).toBe(true);
    expect(validateDefinition(def).ok).toBe(true);
    expect(def.steps[0].id).not.toBe(emptyDefinition().steps[0].id);
  });
});

describe("validateDefinition: the spec's Y1 preset", () => {
  it("passes and is normalized", () => {
    const def = okDef(y1());
    expect(def.version).toBe(1);
    expect(def.steps).toHaveLength(5);
    expect(def.steps[1]).toMatchObject({ kind: "qualify", fields: [], checks: ["date", "location"] });
    const booth = def.steps[3].fields[1];
    expect(booth.showIf).toEqual({ fieldKey: "services", op: "includes", values: ["photo_booth"] });
    expect(def.steps[4].fields[0].choices).toBeUndefined();
    expect(def.steps[0].fields[4].placeholder).toBe("Venue name or city, e.g. Casa Monica, St. Augustine");
  });

  it("accepts its JSON text too", () => {
    expect(validateDefinition(JSON.stringify(y1())).ok).toBe(true);
  });

  it("is idempotent: validating the normalized output gives the same definition", () => {
    const once = okDef(y1());
    const twice = okDef(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it("allows a phone-only first step (LeadGate required name AND email, bug 10.27)", () => {
    const d = y1();
    d.steps[0].fields = d.steps[0].fields!.filter((f) => f.key !== "email");
    expect(validateDefinition(d).ok).toBe(true);
  });

  it("allows a single-step form", () => {
    const d: RawDef = { steps: [{ title: "Contact us", fields: [{ key: "email", type: "email", role: "email", label: "Email", required: true }] }] };
    const def = okDef(d);
    expect(def.steps[0].kind).toBe("fields");
    expect(def.steps[0].fields[0].width).toBe("full");
  });
});

describe("validateDefinition: shape errors", () => {
  it("rejects non-definitions with a readable message", () => {
    expect(errorsOf(null)[0]).toMatch(/empty or not an object/);
    expect(errorsOf([])[0]).toMatch(/empty or not an object/);
    expect(errorsOf("{nope")[0]).toMatch(/not valid JSON/);
    expect(errorsOf({})[0]).toMatch(/list of steps/);
    expect(errorsOf({ steps: [] })).toContain("The form needs at least one step.");
  });

  it("rejects other definition versions", () => {
    const d = { ...y1(), version: 2 };
    expect(errorsOf(d).join("\n")).toMatch(/version 2, but only version 1/);
  });

  it(`caps steps at ${MAX_STEPS} and fields at ${MAX_FIELDS}`, () => {
    const many: RawDef = {
      steps: Array.from({ length: 21 }, (_, i) => ({
        title: `Step ${i + 1}`,
        fields: i === 0 ? [{ key: "email", type: "email", role: "email", label: "Email" }] : [{ type: "text", label: `Q${i}` }],
      })),
    };
    expect(errorsOf(many).join("\n")).toMatch(/at most 20 steps; this one has 21/);
    const wide: RawDef = {
      steps: [
        {
          title: "All",
          fields: [
            { key: "email", type: "email", role: "email", label: "Email" },
            ...Array.from({ length: 60 }, (_, i) => ({ type: "text", label: `Question ${i}` })),
          ],
        },
      ],
    };
    expect(errorsOf(wide).join("\n")).toMatch(/at most 60 fields; this one has 61/);
  });

  it("caps the error list at 50", () => {
    const bad: RawDef = {
      steps: [{ title: "Bad", fields: Array.from({ length: 59 }, () => ({ type: "select", label: "", choices: [] })) }],
    };
    const errors = errorsOf(bad);
    expect(errors.length).toBeGreaterThan(10);
    expect(errors.length).toBeLessThanOrEqual(50);
  });

  it("names steps without titles and unknown kinds/types/roles", () => {
    const d = y1();
    d.steps[2].title = "";
    field(d, 2, "guest_count").type = "slider";
    field(d, 0, "name").role = "nickname";
    d.steps[3].kind = "page";
    const text = errorsOf(d).join("\n");
    expect(text).toMatch(/Step 3 needs a title\./);
    expect(text).toMatch(/Step 3: field 'Guest count' has an unknown type "slider"/);
    expect(text).toMatch(/field 'Full name' has an unknown role "nickname"/);
    expect(text).toMatch(/Step 4 'What would you like\?' has an unknown kind "page"/);
  });

  it("requires labels on answer fields", () => {
    const d = y1();
    field(d, 0, "name").label = "  ";
    expect(errorsOf(d).join("\n")).toMatch(/Step 1 'Let's check your date': field #1 needs a label\./);
  });
});

describe("validateDefinition: keys", () => {
  it("requires unique keys across the whole form (message names both places)", () => {
    const d = y1();
    field(d, 2, "guest_count").key = "email";
    expect(errorsOf(d)).toContain(
      `Step 3 'Tell us about your event': field 'Guest count' key must be unique ("email" is also used by field 'Email' in step 1).`,
    );
  });

  it("enforces the key pattern, the double-underscore reservation and reserved names", () => {
    for (const [bad, pattern] of [
      ["Guest Count", /must start with a lowercase letter/],
      ["1st_choice", /must start with a lowercase letter/],
      ["guest-count", /must start with a lowercase letter/],
      ["a".repeat(49), /must start with a lowercase letter/],
      ["services__other", /two underscores in a row/],
      ["event__end", /two underscores in a row/],
      [HONEYPOT_INPUT_NAME, /is reserved/],
      ["constructor", /is reserved/],
    ] as const) {
      const d = y1();
      field(d, 2, "guest_count").key = bad;
      expect(errorsOf(d).join("\n"), bad).toMatch(pattern);
    }
  });

  it("accepts company_website as an ordinary key (the honeypot no longer uses it)", () => {
    const d = y1();
    field(d, 2, "guest_count").key = "company_website";
    expect(validateDefinition(d).ok).toBe(true);
  });

  it("generates missing keys from labels without colliding", () => {
    const d = y1();
    delete field(d, 2, "guest_count").key;
    d.steps[2].fields!.push({ type: "text", label: "Email" });
    d.steps[2].fields!.push({ type: "content", content: { text: "Heads up" } });
    const def = okDef(d);
    const keys = allFields(def).map((f) => f.key);
    expect(keys).toContain("guest_count");
    expect(keys).toContain("email_2");
    expect(keys).toContain("content");
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("validateDefinition: roles", () => {
  it("allows each role once", () => {
    const d = y1();
    d.steps[4].fields!.push({ key: "second_email", type: "email", role: "email", label: "Second email" });
    expect(errorsOf(d).join("\n")).toMatch(
      /field 'Second email' uses the Email role, but field 'Email' in step 1 already has it\. Each role can be used once\./,
    );
  });

  it("checks the role fits the field type (ROLE_FIELD_TYPES)", () => {
    const d = y1();
    field(d, 0, "name").role = "email";
    field(d, 0, "email").role = null;
    expect(errorsOf(d).join("\n")).toMatch(/field 'Full name' cannot use the Email role\. That role needs an Email field\./);
    const d2 = y1();
    field(d2, 2, "guest_count").type = "text";
    expect(errorsOf(d2).join("\n")).toMatch(/cannot use the Guest count role\. That role needs a Number, Dropdown or Multiple choice field\./);
  });

  it("needs options for a Services checkbox", () => {
    const d = y1();
    delete field(d, 3, "services").choices;
    d.steps[3].fields = d.steps[3].fields!.filter((f) => f.key !== "photo_booth_style");
    expect(errorsOf(d).join("\n")).toMatch(/uses the Services role, so it needs options/);
  });
});

describe("validateDefinition: options", () => {
  it("requires options on dropdowns and multiple choice, allows a consent checkbox", () => {
    const d = y1();
    field(d, 4, "referral_source").choices = [];
    expect(errorsOf(d).join("\n")).toMatch(/field 'Who referred you to us\?' needs at least one option\./);
    const d2 = y1();
    d2.steps[4].fields!.push({ key: "agree", type: "checkbox", label: "I agree to be contacted", required: true });
    const def = okDef(d2);
    const agree = allFields(def).find((f) => f.key === "agree")!;
    expect(isConsentCheckbox(agree)).toBe(true);
    expect(isMultiCheckbox(agree)).toBe(false);
  });

  it("requires unique non-empty values and at most one Other", () => {
    const d = y1();
    const c = field(d, 2, "event_type").choices as { value: string; label: string; isOther?: boolean }[];
    c[1].value = "wedding";
    c[2].value = "  ";
    c[3].isOther = true;
    c[4].label = "";
    const text = errorsOf(d).join("\n");
    expect(text).toMatch(/two options use the value "wedding"/);
    expect(text).toMatch(/option 'Birthday or Milestone' needs a value/);
    expect(text).toMatch(/can have only one "Other" option/);
    expect(text).toMatch(/option 5 needs a label/);
  });

  it("allows an Other option on a dropdown (the spec presets use it)", () => {
    const def = okDef(y1());
    const referral = allFields(def).find((f) => f.key === "referral_source")!;
    expect(otherChoice(referral)?.value).toBe("other");
  });
});

describe("validateDefinition: show-when conditions", () => {
  it("accepts an earlier field in the same step", () => {
    expect(validateDefinition(y1()).ok).toBe(true);
  });

  it("rejects a condition on a later field, an unknown field, or itself", () => {
    const later = y1();
    field(later, 0, "name").showIf = { fieldKey: "email", op: "answered" };
    expect(errorsOf(later).join("\n")).toMatch(/field 'Full name' depends on field 'Email', which comes later in the form/);

    const unknown = y1();
    field(unknown, 3, "photo_booth_style").showIf = { fieldKey: "extras", op: "includes", values: ["photo_booth"] };
    expect(errorsOf(unknown).join("\n")).toMatch(/depends on "extras", which is not a field in this form/);

    const self = y1();
    field(self, 3, "photo_booth_style").showIf = { fieldKey: "photo_booth_style", op: "answered" };
    expect(errorsOf(self).join("\n")).toMatch(/cannot depend on its own answer/);
  });

  it("rejects values that are not options of the referenced field (typo guard)", () => {
    const d = y1();
    field(d, 3, "photo_booth_style").showIf = { fieldKey: "services", op: "includes", values: ["photobooth"] };
    expect(errorsOf(d).join("\n")).toMatch(/depends on the answer "photobooth", which is not an option of field 'Services'/);
  });

  it("rejects an empty value list and malformed conditions", () => {
    const d = y1();
    field(d, 3, "photo_booth_style").showIf = { fieldKey: "services", op: "includes", values: [] };
    expect(errorsOf(d).join("\n")).toMatch(/show-when condition with no values/);
    const d2 = y1();
    field(d2, 3, "photo_booth_style").showIf = { fieldKey: "services", op: "matches" };
    expect(errorsOf(d2).join("\n")).toMatch(/show-when condition that is not valid/);
  });

  it("rejects a condition on a text block", () => {
    const d = y1();
    d.steps[3].fields!.splice(0, 0, { key: "intro", type: "content", content: { text: "Pick what you like" } });
    field(d, 3, "photo_booth_style").showIf = { fieldKey: "intro", op: "answered" };
    expect(errorsOf(d).join("\n")).toMatch(/depends on a text block/);
  });

  it("checks condition values against contact preference and budget tier ids", () => {
    const d = y1();
    field(d, 4, "notes").showIf = { fieldKey: "contact_preference", op: "equals", values: ["text"] };
    expect(validateDefinition(d).ok).toBe(true);
    field(d, 4, "notes").showIf = { fieldKey: "contact_preference", op: "equals", values: ["sms"] };
    expect(errorsOf(d).join("\n")).toMatch(/"sms", which is not an option/);
    const d2 = y1();
    field(d2, 4, "notes").showIf = { fieldKey: "budget", op: "equals", values: ["under_1000"] };
    expect(validateDefinition(d2).ok).toBe(true);
  });

  it("drops values from an 'answered' condition", () => {
    const d = y1();
    field(d, 4, "notes").showIf = { fieldKey: "contact_preference", op: "answered", values: ["x"] };
    const def = okDef(d);
    expect(allFields(def).find((f) => f.key === "notes")!.showIf).toEqual({ fieldKey: "contact_preference", op: "answered" });
  });
});

describe("validateDefinition: availability check steps", () => {
  it("cannot hold fields and needs at least one known check", () => {
    const d = y1();
    d.steps[1].fields = [{ key: "x", type: "text", label: "X" }];
    d.steps[1].checks = [];
    const text = errorsOf(d).join("\n");
    expect(text).toMatch(/Step 2 'Checking our calendar': an availability check step cannot hold fields/);
    expect(text).toMatch(/Step 2 'Checking our calendar' needs at least one check/);
    const d2 = y1();
    d2.steps[1].checks = ["date", "weather"];
    expect(errorsOf(d2).join("\n")).toMatch(/unknown check "weather"/);
  });

  it("needs an Event date field on an EARLIER step for a date check", () => {
    const d = y1();
    const dateField = field(d, 0, "event_date");
    d.steps[0].fields = d.steps[0].fields!.filter((f) => f.key !== "event_date");
    d.steps[2].fields!.push(dateField);
    expect(errorsOf(d).join("\n")).toMatch(/checks the date, so an earlier step needs a Date field with the Event date role/);
  });

  it("needs an Event location field on an earlier step for a location check", () => {
    const d = y1();
    field(d, 0, "event_location").role = null;
    expect(errorsOf(d).join("\n")).toMatch(/checks the location, so an earlier step needs a field with the Event location role/);
    const d2 = y1();
    field(d2, 0, "event_location").role = null;
    d2.steps[1].checks = ["date"];
    expect(validateDefinition(d2).ok).toBe(true);
  });

  it("allows only one availability step and never as the last step (LeadGate bug 10.29)", () => {
    const two = y1();
    two.steps.splice(3, 0, { kind: "qualify", title: "Second check", fields: [], checks: ["date"] });
    expect(errorsOf(two).join("\n")).toMatch(/only one availability check step \(steps 2, 4 are availability checks\)/);
    const last = y1();
    last.steps.push({ kind: "qualify", title: "Final check", fields: [], checks: ["date"] });
    last.steps.splice(1, 1);
    expect(errorsOf(last).join("\n")).toMatch(/The last step must be a regular step with fields.*Step 5 'Final check' is an availability check/);
  });

  it("dedupes repeated checks", () => {
    const d = y1();
    d.steps[1].checks = ["date", "date", "location"];
    expect(okDef(d).steps[1].checks).toEqual(["date", "location"]);
  });
});

describe("validateDefinition: first step, empty steps", () => {
  it("needs an Email or Phone role field on the first step", () => {
    const d = y1();
    field(d, 0, "email").role = null;
    field(d, 0, "phone").role = null;
    expect(errorsOf(d).join("\n")).toMatch(
      /Step 1 'Let's check your date': the first step needs an Email or Phone field \(with the Email or Phone role\)/,
    );
    const q = y1();
    q.steps.unshift({ kind: "qualify", title: "Check", fields: [], checks: ["date"] });
    expect(errorsOf(q).join("\n")).toMatch(/Step 1 'Check': the first step needs an Email or Phone field/);
  });

  it("rejects a regular step with no fields", () => {
    const d = y1();
    d.steps.splice(2, 0, { title: "Empty", fields: [] });
    expect(errorsOf(d).join("\n")).toMatch(/Step 3 'Empty' has no fields\. Add a field or delete the step\./);
  });
});

describe("validateDefinition: budget", () => {
  it("needs a config and at least one tier", () => {
    const d = y1();
    delete field(d, 3, "budget").budget;
    expect(errorsOf(d).join("\n")).toMatch(/field 'Budget for DJ\/MC' needs budget settings/);
    const d2 = y1();
    (field(d2, 3, "budget").budget as Record<string, unknown>).tiers = [];
    expect(errorsOf(d2).join("\n")).toMatch(/needs at least one budget option/);
  });

  it("checks tier ranges, ids and labels", () => {
    const d = y1();
    const tiers = (field(d, 3, "budget").budget as { tiers: Record<string, unknown>[] }).tiers;
    tiers[1].min = 2000;
    tiers[2].id = "1000_1500";
    tiers[3].label = "";
    tiers[4].min = "lots";
    const text = errorsOf(d).join("\n");
    expect(text).toMatch(/budget option '\$1,000 - \$1,500' starts above where it ends \(\$2,000 > \$1,500\)/);
    expect(text).toMatch(/two budget options use the id "1000_1500"/);
    expect(text).toMatch(/budget option 4 needs a label/);
    expect(text).toMatch(/budget option '\$4,000\+' has an amount that is not a number/);
  });

  it("generates missing tier ids and treats a missing acceptable flag as acceptable", () => {
    const d = y1();
    const tiers = (field(d, 3, "budget").budget as { tiers: Record<string, unknown>[] }).tiers;
    delete tiers[2].id;
    delete tiers[2].acceptable;
    const def = okDef(d);
    const t = allFields(def).find((f) => f.key === "budget")!.budget!.tiers![2];
    expect(t.id).toBe("field_1_500_2_500");
    expect(t.acceptable).toBe(true);
  });

  it("refuses a strict stop nobody can pass", () => {
    const d = y1();
    const b = field(d, 3, "budget").budget as Record<string, unknown> & { tiers: Record<string, unknown>[] };
    b.policy = "strict_stop";
    b.allowSkip = false;
    for (const t of b.tiers) t.acceptable = false;
    expect(errorsOf(d).join("\n")).toMatch(/nobody could continue/);
    b.allowSkip = true;
    expect(validateDefinition(d).ok).toBe(true);
  });

  it("validates slider mode", () => {
    const d = y1();
    field(d, 3, "budget").budget = { mode: "slider", policy: "label", slider: { min: 500, max: 500, step: 100 } };
    expect(errorsOf(d).join("\n")).toMatch(/the budget slider needs/);
    field(d, 3, "budget").budget = { mode: "slider", policy: "strict_stop", minimum: 60000, slider: { min: 500, max: 50000, step: 500 } };
    expect(errorsOf(d).join("\n")).toMatch(/only goes up to \$50,000, so nobody could continue/);
    field(d, 3, "budget").budget = { mode: "slider", policy: "label", minimum: 1000, slider: { min: 500, max: 50000, step: 500 }, tiers: [{ id: "x" }] };
    const def = okDef(d);
    const b = allFields(def).find((f) => f.key === "budget")!.budget!;
    expect(b).toEqual({ mode: "slider", policy: "label", minimum: 1000, slider: { min: 500, max: 50000, step: 500 } });
  });

  it("rejects unknown modes and policies", () => {
    const d = y1();
    (field(d, 3, "budget").budget as Record<string, unknown>).mode = "dial";
    expect(errorsOf(d).join("\n")).toMatch(/unknown budget mode "dial"/);
    const d2 = y1();
    (field(d2, 3, "budget").budget as Record<string, unknown>).policy = "hard_stop";
    expect(errorsOf(d2).join("\n")).toMatch(/unknown budget rule "hard_stop"/);
  });
});

describe("validateDefinition: numbers, lengths, text blocks", () => {
  it("checks number bounds", () => {
    const d = y1();
    field(d, 2, "guest_count").min = 10;
    field(d, 2, "guest_count").max = 5;
    expect(errorsOf(d).join("\n")).toMatch(/the lowest allowed number \(10\) is above the highest \(5\)/);
    const d2 = y1();
    field(d2, 2, "guest_count").min = "many";
    expect(errorsOf(d2).join("\n")).toMatch(/the lowest allowed number must be a number/);
  });

  it("checks length rules (max 2000)", () => {
    const d = y1();
    field(d, 4, "notes").maxLength = 5000;
    expect(errorsOf(d).join("\n")).toMatch(/maximum length can be at most 2000/);
    const d2 = y1();
    field(d2, 4, "notes").minLength = 50;
    field(d2, 4, "notes").maxLength = 20;
    expect(errorsOf(d2).join("\n")).toMatch(/minimum length \(50\) is above the maximum length \(20\)/);
    const d3 = y1();
    field(d3, 4, "notes").minLength = 2.5;
    expect(errorsOf(d3).join("\n")).toMatch(/minimum length must be a whole number/);
  });

  it("needs text in a text block and never makes it required", () => {
    const d = y1();
    d.steps[4].fields!.push({ key: "fine_print", type: "content", label: "", required: true, content: { text: "  " } });
    expect(errorsOf(d).join("\n")).toMatch(/Step 5 'Last step': text block #4 needs some text/);
    (d.steps[4].fields![3].content as Record<string, unknown>).text = "We never share your details.";
    (d.steps[4].fields![3].content as Record<string, unknown>).tone = "loud";
    const block = okDef(d).steps[4].fields[3];
    expect(block.required).toBe(false);
    expect(block.content).toEqual({ text: "We never share your details." });
  });
});

describe("validateDefinition: normalization", () => {
  it("keeps only properties that mean something for the field type", () => {
    const d = y1();
    Object.assign(field(d, 0, "name"), { choices: [{ value: "a", label: "A" }], min: 3, layout: "cards", junk: true, label: "  Full   name  " });
    Object.assign(field(d, 4, "contact_preference"), { choices: [{ value: "fax", label: "Fax" }], layout: "cards" });
    Object.assign(field(d, 4, "referral_source"), { layout: "chips", showEndTime: true });
    const def = okDef(d);
    const name = def.steps[0].fields[0] as FieldDef & Record<string, unknown>;
    expect(name).toEqual({ id: "f1", key: "name", type: "text", role: "name", label: "Full name", required: true, width: "half" });
    const pref = def.steps[4].fields[0];
    expect(pref.choices).toBeUndefined();
    expect(pref.layout).toBeUndefined();
    expect(fieldChoices(pref)).toBe(CONTACT_PREFERENCE_CHOICES);
    const referral = def.steps[4].fields[1];
    expect(referral.layout).toBeUndefined();
    expect(referral.showEndTime).toBeUndefined();
  });

  it("defaults width, role and required; regenerates missing or duplicate ids", () => {
    const d = y1();
    Object.assign(field(d, 0, "name"), { width: "wide", required: "yes" });
    delete field(d, 0, "name").role;
    field(d, 0, "phone").id = "f1";
    delete d.steps[2].id;
    const def = okDef(d);
    const [name, phone] = def.steps[0].fields;
    expect(name.width).toBe("full");
    expect(name.required).toBe(false);
    expect(name.role).toBeNull();
    expect(phone.id).not.toBe("f1");
    expect(def.steps[2].id).toMatch(/^[0-9a-f-]{36}$/);
    const ids = [...def.steps.map((s) => s.id), ...allFields(def).map((f) => f.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("lookups", () => {
  const def = okDef(y1());

  it("allFields lists every field in form order", () => {
    expect(allFields(def).map((f) => f.key)).toEqual([
      "name",
      "phone",
      "email",
      "event_date",
      "event_location",
      "event_type",
      "guest_count",
      "event_time",
      "services",
      "photo_booth_style",
      "budget",
      "contact_preference",
      "referral_source",
      "notes",
    ]);
  });

  it("findRoleField finds by role, null when absent", () => {
    expect(findRoleField(def, "event_location")?.key).toBe("event_location");
    expect(findRoleField(def, "company")).toBeNull();
  });

  it("stepIndexOfField resolves companions and returns -1 when absent", () => {
    expect(stepIndexOfField(def, "email")).toBe(0);
    expect(stepIndexOfField(def, "budget")).toBe(3);
    expect(stepIndexOfField(def, "event_time__end")).toBe(2);
    expect(stepIndexOfField(def, "event_type__other")).toBe(2);
    expect(stepIndexOfField(def, "nope")).toBe(-1);
    expect(stepIndexOfField(def, "")).toBe(-1);
  });

  it("firstStepContactOk", () => {
    expect(firstStepContactOk(def)).toBe(true);
    expect(firstStepContactOk({ version: 1, steps: [] })).toBe(false);
    expect(
      firstStepContactOk({ version: 1, steps: [{ id: "a", kind: "qualify", title: "Q", fields: [], checks: ["date"] }] }),
    ).toBe(false);
    expect(
      firstStepContactOk({
        version: 1,
        steps: [{ id: "a", kind: "fields", title: "T", fields: [{ id: "b", key: "phone", type: "phone", role: "phone", label: "Phone", required: false, width: "full" }] }],
      }),
    ).toBe(true);
  });

  it("companion keys", () => {
    expect(otherKey("event_type")).toBe("event_type__other");
    expect(endKey("event_time")).toBe("event_time__end");
    expect(baseKey("event_time__end")).toBe("event_time");
    expect(baseKey("event_type__other")).toBe("event_type");
    expect(baseKey("notes")).toBe("notes");
  });

  it("contact preference options are the fixed LeadGate values", () => {
    expect(CONTACT_PREFERENCE_CHOICES.map((c) => c.value)).toEqual(["email", "text", "phone"]);
    expect(CONTACT_PREFERENCE_CHOICES.map((c) => c.label)).toEqual(["Email", "Text message", "Phone call"]);
    expect(Object.isFrozen(CONTACT_PREFERENCE_CHOICES)).toBe(true);
  });
});
