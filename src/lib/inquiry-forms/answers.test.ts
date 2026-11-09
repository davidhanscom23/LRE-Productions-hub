import { describe, expect, it } from "vitest";
import {
  BUDGET_SKIP_LABEL,
  allowedKeys,
  answerDisplay,
  asBoolean,
  asNumberOrNull,
  budgetOutcome,
  buildCrmSummary,
  cleanText,
  formatAnswerLines,
  formatMoney,
  mergeAnswers,
  sanitizeStepAnswers,
  stripHidden,
} from "./answers";
import { validateDefinition } from "./definition";
import type { Answers, FieldDef, FormDefinition } from "./types";

function build(): FormDefinition {
  const r = validateDefinition({
    version: 1,
    steps: [
      {
        id: "s1",
        title: "You",
        fields: [
          { key: "name", type: "text", role: "name", label: "Full name", required: true, width: "half" },
          { key: "phone", type: "phone", role: "phone", label: "Mobile phone", required: true, width: "half" },
          { key: "email", type: "email", role: "email", label: "Email", required: true },
          { key: "event_date", type: "date", role: "event_date", label: "Event date", required: true },
          { key: "event_location", type: "address", role: "event_location", label: "Venue or city" },
        ],
      },
      { id: "s2", kind: "qualify", title: "Checking our calendar", fields: [], checks: ["date", "location"] },
      {
        id: "s3",
        title: "Your event",
        fields: [
          {
            key: "event_type",
            type: "radio",
            role: "event_type",
            label: "Type of event",
            required: true,
            choices: [
              { value: "wedding", label: "Wedding" },
              { value: "corporate_event", label: "Corporate Event" },
              { value: "other", label: "Other", isOther: true },
            ],
          },
          { key: "guest_count", type: "number", role: "guest_count", label: "Guest count", min: 1, max: 5000 },
          { key: "event_time", type: "time", role: "event_time", label: "Start and end time", showEndTime: true },
        ],
      },
      {
        id: "s4",
        title: "What would you like?",
        fields: [
          {
            key: "services",
            type: "checkbox",
            role: "services",
            label: "Services",
            required: true,
            choices: [
              { value: "dj_mc", label: "DJ / MC" },
              { value: "photo_booth", label: "Photo Booth" },
              { value: "cold_sparks", label: "Cold Sparks" },
              { value: "other", label: "Other", isOther: true },
            ],
          },
          {
            key: "photo_booth_style",
            type: "radio",
            label: "Photo booth style",
            showIf: { fieldKey: "services", op: "includes", values: ["photo_booth"] },
            choices: [
              { value: "digital", label: "Digital Photo Booth" },
              { value: "prints", label: "Photo Booth with Prints" },
            ],
          },
          {
            key: "budget",
            type: "budget",
            role: "budget",
            label: "Budget for DJ/MC",
            budget: {
              mode: "tiers",
              policy: "label",
              allowSkip: true,
              tiers: [
                { id: "under_1000", label: "Under $1,000", min: null, max: 1000, acceptable: false },
                { id: "1000_2500", label: "$1,000 - $2,500", min: 1000, max: 2500, acceptable: true },
                { id: "2500_plus", label: "$2,500+", min: 2500, max: null, acceptable: true },
              ],
            },
          },
        ],
      },
      {
        id: "s5",
        title: "Last step",
        fields: [
          { key: "intro", type: "content", content: { text: "Almost done!" } },
          { key: "contact_preference", type: "contact_preference", role: "contact_preference", label: "How should we reach you?", required: true },
          {
            key: "referral_source",
            type: "select",
            role: "referral_source",
            label: "Who referred you to us?",
            choices: [
              { value: "google", label: "Google" },
              { value: "other", label: "Other", isOther: true },
            ],
          },
          { key: "notes", type: "textarea", role: "notes", label: "Anything else we should know?:" },
          { key: "agree", type: "checkbox", label: "Text me updates" },
        ],
      },
    ],
  });
  if (!r.ok) throw new Error(r.errors.join(" | "));
  return r.def;
}

const def = build();
const fieldByKey = (key: string): FieldDef => def.steps.flatMap((s) => s.fields).find((f) => f.key === key)!;

const fullAnswers: Answers = {
  name: "Jane Doe",
  phone: "904-571-9064",
  email: "jane@example.com",
  event_date: "2027-05-15",
  event_location: "Casa Monica, St. Augustine",
  event_type: "other",
  event_type__other: "Grand opening: VIP night",
  guest_count: 1200,
  event_time: "18:00",
  event_time__end: "23:00",
  services: ["dj_mc", "photo_booth", "other"],
  services__other: "Foam party",
  photo_booth_style: "prints",
  budget: { type: "tier", tierId: "1000_2500" },
  contact_preference: "text",
  referral_source: "google",
  notes: "Outdoor ceremony.\nIndoor reception.",
  agree: true,
};

describe("allowedKeys", () => {
  it("lists answer keys plus their companions, never content blocks", () => {
    const keys = allowedKeys(def);
    for (const k of ["name", "event_type", "event_type__other", "event_time__end", "services__other", "referral_source__other", "agree"]) {
      expect(keys.has(k), k).toBe(true);
    }
    expect(keys.has("intro")).toBe(false);
    expect(keys.has("guest_count__other")).toBe(false);
    expect(keys.has("photo_booth_style__other")).toBe(false);
  });
});

describe("sanitizeStepAnswers", () => {
  it("keeps only THAT step's keys and drops internal or unknown keys (LeadGate bugs 10.26, B7)", () => {
    const incoming = JSON.parse(
      JSON.stringify({
        name: "  Jane   Doe ",
        email: "Jane@Example.COM ",
        phone: "904-571-9064",
        event_date: "2027-05-15",
        event_location: "Casa Monica",
        event_type: "wedding",
        leadEventId: "x",
        _validated_date: "2027-05-15",
        hp: "",
        token: "secret",
        elapsedMs: 4000,
        turnstileToken: "t",
      }),
    );
    incoming["__proto__"] = { polluted: true };
    const out = sanitizeStepAnswers(def, 0, incoming);
    expect(Object.keys(out).sort()).toEqual(["email", "event_date", "event_location", "name", "phone"]);
    expect(out.name).toBe("Jane Doe");
    expect(out.email).toBe("jane@example.com");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("returns null for every missing key so re-saving a step replaces it as a whole", () => {
    const out = sanitizeStepAnswers(def, 2, { event_type: "wedding" });
    expect(out).toEqual({ event_type: "wedding", event_type__other: null, guest_count: null, event_time: null, event_time__end: null });
    const merged = mergeAnswers({ event_type: "corporate_event", guest_count: 80, event_time: "18:00" }, out);
    expect(merged).toEqual({ event_type: "wedding" });
  });

  it("keeps a single-step form's every answer (LeadGate bug 10.25)", () => {
    const one = validateDefinition({
      steps: [
        {
          title: "Contact",
          fields: [
            { key: "email", type: "email", role: "email", label: "Email" },
            { key: "favorite_song", type: "text", label: "Favorite song" },
          ],
        },
      ],
    });
    if (!one.ok) throw new Error("fixture");
    expect(sanitizeStepAnswers(one.def, 0, { email: "a@b.co", favorite_song: "September" })).toEqual({
      email: "a@b.co",
      favorite_song: "September",
    });
  });

  it("cleans text: trims, single-lines, keeps textarea line breaks, caps at 2000", () => {
    const step0 = sanitizeStepAnswers(def, 0, { name: "Jane\nDoe\t", event_location: "x".repeat(2500) });
    expect(step0.name).toBe("Jane Doe");
    expect((step0.event_location as string).length).toBe(2000);
    const last = sanitizeStepAnswers(def, 4, { notes: "  Line one  \r\nLine two\n\n\n\nLine three  " });
    expect(last.notes).toBe("Line one\nLine two\n\nLine three");
  });

  it("strips characters Postgres jsonb rejects (NUL, lone surrogates)", () => {
    const out = sanitizeStepAnswers(def, 4, { notes: "a\u0000b\ud800c\udc00d\u0007e 🎉" });
    expect(out.notes).toBe("abcde 🎉");
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/\\u0000|\\ud8|\\udc/);
    const cut = cleanText(`${"x".repeat(1999)}🎉`, false);
    expect(cut).toBe("x".repeat(1999));
  });

  it("coerces numbers, dates and times", () => {
    const out = sanitizeStepAnswers(def, 2, { event_type: "wedding", guest_count: "1,200", event_time: "9:05", event_time__end: "23:00:00" });
    expect(out.guest_count).toBe(1200);
    expect(out.event_time).toBe("09:05");
    expect(out.event_time__end).toBe("23:00");
    expect(sanitizeStepAnswers(def, 2, { guest_count: "12.6" }).guest_count).toBe(13);
    expect(sanitizeStepAnswers(def, 2, { guest_count: "lots" }).guest_count).toBeNull();
    expect(sanitizeStepAnswers(def, 2, { guest_count: 1e12 }).guest_count).toBeNull();
    expect(sanitizeStepAnswers(def, 2, { event_time: "25:00", event_time__end: "23:00" })).toMatchObject({ event_time: null, event_time__end: null });
    expect(sanitizeStepAnswers(def, 0, { event_date: "05/15/2027" }).event_date).toBeNull();
    expect(sanitizeStepAnswers(def, 0, { event_date: "2027-05-15" }).event_date).toBe("2027-05-15");
  });

  it("drops a choice that is not an option, and the Other detail unless Other is picked", () => {
    expect(sanitizeStepAnswers(def, 2, { event_type: "gala", event_type__other: "x" })).toMatchObject({ event_type: null, event_type__other: null });
    expect(sanitizeStepAnswers(def, 2, { event_type: "wedding", event_type__other: "stale" }).event_type__other).toBeNull();
    expect(sanitizeStepAnswers(def, 2, { event_type: "other", event_type__other: "  Grand opening  " }).event_type__other).toBe("Grand opening");
    expect(sanitizeStepAnswers(def, 2, { event_type: "other", event_type__other: "   " }).event_type__other).toBeNull();
  });

  it("makes multi-select answers arrays in option order, without duplicates or unknowns", () => {
    expect(sanitizeStepAnswers(def, 3, { services: ["cold_sparks", "dj_mc", "dj_mc", "laser"] }).services).toEqual(["dj_mc", "cold_sparks"]);
    expect(sanitizeStepAnswers(def, 3, { services: "photo_booth" }).services).toEqual(["photo_booth"]);
    expect(sanitizeStepAnswers(def, 3, { services: [] }).services).toBeNull();
    expect(sanitizeStepAnswers(def, 3, { services: ["other"], services__other: "Foam" }).services__other).toBe("Foam");
    expect(sanitizeStepAnswers(def, 3, { services: ["dj_mc"], services__other: "Foam" }).services__other).toBeNull();
  });

  it("coerces budget answers", () => {
    const s = (budget: unknown) => sanitizeStepAnswers(def, 3, { budget: budget as Answers[string] }).budget;
    expect(s({ type: "tier", tierId: "1000_2500" })).toEqual({ type: "tier", tierId: "1000_2500" });
    expect(s({ type: "tier", tierId: "gold" })).toBeNull();
    expect(s({ type: "amount", amount: "2,500" })).toEqual({ type: "amount", amount: 2500 });
    expect(s({ type: "amount", amount: -1 })).toBeNull();
    expect(s({ type: "skip" })).toEqual({ type: "skip" });
    expect(s("2500_plus")).toEqual({ type: "tier", tierId: "2500_plus" });
    expect(s({ type: "tier", tierId: "1000_2500", score: 999 })).toEqual({ type: "tier", tierId: "1000_2500" });
  });

  it("refuses a skip when the field does not allow skipping", () => {
    const noSkip = validateDefinition({
      steps: [
        {
          title: "B",
          fields: [
            { key: "email", type: "email", role: "email", label: "Email" },
            { key: "b", type: "budget", label: "Budget", budget: { mode: "tiers", policy: "label", tiers: [{ id: "a", label: "A" }] } },
          ],
        },
      ],
    });
    if (!noSkip.ok) throw new Error("fixture");
    expect(sanitizeStepAnswers(noSkip.def, 0, { b: { type: "skip" } }).b).toBeNull();
  });

  it("coerces a consent box to true or null", () => {
    expect(sanitizeStepAnswers(def, 4, { agree: "on" }).agree).toBe(true);
    expect(sanitizeStepAnswers(def, 4, { agree: false }).agree).toBeNull();
    expect(sanitizeStepAnswers(def, 4, { contact_preference: "call" }).contact_preference).toBeNull();
    expect(sanitizeStepAnswers(def, 4, { contact_preference: "email" }).contact_preference).toBe("email");
  });

  it("gives {} for a qualify step or a bad index, and nulls for non-object input", () => {
    expect(sanitizeStepAnswers(def, 1, { name: "x" })).toEqual({});
    expect(sanitizeStepAnswers(def, 9, { name: "x" })).toEqual({});
    expect(sanitizeStepAnswers(def, -1, { name: "x" })).toEqual({});
    expect(sanitizeStepAnswers(def, 0.5, { name: "x" })).toEqual({});
    expect(sanitizeStepAnswers(def, 0, null as unknown as Answers).name).toBeNull();
    expect(sanitizeStepAnswers(def, 0, ["Jane"] as unknown as Answers).name).toBeNull();
  });
});

describe("mergeAnswers", () => {
  it("applies the patch, null deletes, nulls in prev are dropped, inputs untouched", () => {
    const prev: Answers = { a: "1", b: "2", c: null };
    const patch: Answers = { b: null, d: "4" };
    expect(mergeAnswers(prev, patch)).toEqual({ a: "1", d: "4" });
    expect(prev).toEqual({ a: "1", b: "2", c: null });
  });

  it("cannot be used for prototype pollution", () => {
    const patch = JSON.parse('{"__proto__": {"polluted": "yes"}, "constructor": "x", "ok": "y"}');
    const out = mergeAnswers({}, patch);
    expect(out).toEqual({ ok: "y" });
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("tolerates junk", () => {
    expect(mergeAnswers(null as unknown as Answers, { a: "1" })).toEqual({ a: "1" });
    expect(mergeAnswers({ a: "1" }, "x" as unknown as Answers)).toEqual({ a: "1" });
  });
});

describe("stripHidden", () => {
  it("removes hidden answers, stale companions and unknown keys", () => {
    const answers: Answers = {
      ...fullAnswers,
      services: ["dj_mc"],
      photo_booth_style: "prints",
      services__other: "Foam party",
      event_type: "wedding",
      leadEventId: "zzz",
    };
    const out = stripHidden(def, answers);
    expect(out.photo_booth_style).toBeUndefined();
    expect(out.services__other).toBeUndefined();
    expect(out.event_type__other).toBeUndefined();
    expect(out.leadEventId).toBeUndefined();
    expect(out.name).toBe("Jane Doe");
    expect(answers.photo_booth_style).toBe("prints");
  });

  it("drops an end time without a start", () => {
    expect(stripHidden(def, { event_time__end: "23:00" })).toEqual({});
  });

  it("resolves chains across steps", () => {
    const chained = validateDefinition({
      steps: [
        {
          title: "A",
          fields: [
            { key: "email", type: "email", role: "email", label: "Email" },
            { key: "kind", type: "radio", label: "Kind", choices: [{ value: "wedding", label: "Wedding" }, { value: "gala", label: "Gala" }] },
          ],
        },
        { title: "B", fields: [{ key: "planning", type: "text", label: "Planning", showIf: { fieldKey: "kind", op: "equals", values: ["wedding"] } }] },
        { title: "C", fields: [{ key: "planner", type: "text", label: "Planner", showIf: { fieldKey: "planning", op: "answered" } }] },
      ],
    });
    if (!chained.ok) throw new Error(chained.errors.join("|"));
    expect(stripHidden(chained.def, { kind: "gala", planning: "full", planner: "Ann" })).toEqual({ kind: "gala" });
    expect(stripHidden(chained.def, { kind: "wedding", planning: "full", planner: "Ann" })).toEqual({ kind: "wedding", planning: "full", planner: "Ann" });
  });
});

describe("formatAnswerLines and answerDisplay (the ONE formatter)", () => {
  it("renders 'Label: value' lines in form order with labels, never raw keys", () => {
    expect(formatAnswerLines(def, fullAnswers)).toEqual([
      "Full name: Jane Doe",
      "Mobile phone: 904-571-9064",
      "Email: jane@example.com",
      "Event date: Saturday, May 15, 2027",
      "Venue or city: Casa Monica, St. Augustine",
      "Type of event: Other: Grand opening: VIP night",
      "Guest count: 1,200",
      "Start and end time: 6:00 PM - 11:00 PM",
      "Services: DJ / MC, Photo Booth, Other: Foam party",
      "Photo booth style: Photo Booth with Prints",
      "Budget for DJ/MC: $1,000 - $2,500",
      "How should we reach you?: Text message",
      "Who referred you to us?: Google",
      "Anything else we should know?: Outdoor ceremony.\nIndoor reception.",
      "Text me updates: Yes",
    ]);
  });

  it("skips empty answers, hidden fields and content blocks", () => {
    const lines = formatAnswerLines(def, { name: "Jane", services: ["dj_mc"], photo_booth_style: "prints", notes: "  ", intro: "x" });
    expect(lines).toEqual(["Full name: Jane", "Services: DJ / MC"]);
  });

  it("formats budgets: tier label, amount, skip", () => {
    const budget = fieldByKey("budget");
    expect(answerDisplay(budget, { budget: { type: "amount", amount: 2500 } })).toBe("$2,500");
    expect(answerDisplay(budget, { budget: { type: "skip" } })).toBe(BUDGET_SKIP_LABEL);
    expect(answerDisplay(budget, { budget: { type: "tier", tierId: "under_1000" } })).toBe("Under $1,000");
    expect(answerDisplay(budget, {})).toBeNull();
  });

  it("shows an Other option without detail as its label, and a removed option as its raw value", () => {
    const type = fieldByKey("event_type");
    expect(answerDisplay(type, { event_type: "other" })).toBe("Other");
    expect(answerDisplay(type, { event_type: "retired_option" })).toBe("retired_option");
  });

  it("shows a start time alone, and nothing for an unchecked consent box", () => {
    expect(answerDisplay(fieldByKey("event_time"), { event_time: "09:30" })).toBe("9:30 AM");
    expect(answerDisplay(fieldByKey("agree"), { agree: false })).toBeNull();
    expect(answerDisplay(fieldByKey("intro"), { intro: "x" })).toBeNull();
  });
});

describe("budgetOutcome", () => {
  const budget = fieldByKey("budget");

  it("reads tiers", () => {
    expect(budgetOutcome(budget, { type: "tier", tierId: "under_1000" })).toEqual({
      passed: false,
      tierId: "under_1000",
      amount: null,
      label: "Under $1,000",
      low: null,
    });
    expect(budgetOutcome(budget, { type: "tier", tierId: "2500_plus" })).toMatchObject({ passed: true, low: 2500, label: "$2,500+" });
    expect(budgetOutcome(budget, { type: "tier", tierId: "gold" })).toEqual({ passed: null, tierId: null, amount: null, label: null, low: null });
  });

  it("reads amounts (minimum first, else the containing tier)", () => {
    expect(budgetOutcome(budget, { type: "amount", amount: 800 })).toEqual({ passed: false, tierId: null, amount: 800, label: "$800", low: 800 });
    expect(budgetOutcome(budget, { type: "amount", amount: 3000 })).toMatchObject({ passed: true, label: "$3,000" });
    const slider: FieldDef = {
      id: "b",
      key: "b",
      type: "budget",
      label: "Budget",
      required: false,
      width: "full",
      budget: { mode: "slider", policy: "label", minimum: 2000, slider: { min: 0, max: 10000, step: 500 } },
    };
    expect(budgetOutcome(slider, { type: "amount", amount: 1500 }).passed).toBe(false);
    expect(budgetOutcome(slider, { type: "amount", amount: 2000 }).passed).toBe(true);
    const open: FieldDef = { ...slider, budget: { mode: "slider", policy: "label", slider: { min: 0, max: 10000, step: 500 } } };
    expect(budgetOutcome(open, { type: "amount", amount: 1 }).passed).toBe(true);
  });

  it("skip is neutral; non-budget fields give nothing", () => {
    expect(budgetOutcome(budget, { type: "skip" })).toEqual({ passed: null, tierId: null, amount: null, label: "Prefer not to say", low: null });
    expect(budgetOutcome(budget, null)).toEqual({ passed: null, tierId: null, amount: null, label: null, low: null });
    expect(budgetOutcome(fieldByKey("name"), { type: "tier", tierId: "under_1000" }).label).toBeNull();
  });
});

describe("buildCrmSummary", () => {
  it("maps answers by role", () => {
    const summary = buildCrmSummary(def, { ...fullAnswers, email: "Jane@Example.com" }, {}, "completed", "high");
    expect(summary).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "904-571-9064",
      company: null,
      eventType: "Other: Grand opening: VIP night",
      eventDate: "2027-05-15",
      eventTimeStart: "18:00",
      eventTimeEnd: "23:00",
      eventLocation: "Casa Monica, St. Augustine",
      guestCount: 1200,
      guestLabel: "1,200",
      services: ["DJ / MC", "Photo Booth", "Other: Foam party"],
      budgetLabel: "$1,000 - $2,500",
      budgetLow: 1000,
      referral: "Google",
      contactPreference: "Text message",
      notes: "Outdoor ceremony.\nIndoor reception.",
      scoreLabel: "high",
      ending: "completed",
    });
  });

  it("never invents a date or a name (LeadGate fake today+365 date, bug B8)", () => {
    const partial = buildCrmSummary(def, { phone: "904-571-9064" }, {}, "partial", null);
    expect(partial.eventDate).toBeNull();
    expect(partial.name).toBe("904-571-9064");
    expect(partial.services).toEqual([]);
    expect(partial.budgetLabel).toBeNull();
    expect(buildCrmSummary(def, {}, {}, "partial", null).name).toBe("Website inquiry");
    expect(buildCrmSummary(def, { email: "a@b.co" }, {}, "partial", null).name).toBe("a@b.co");
  });

  it("uses labels for a select guest count and leaves guestCount null", () => {
    const sel = validateDefinition({
      steps: [
        {
          title: "A",
          fields: [
            { key: "email", type: "email", role: "email", label: "Email" },
            { key: "company", type: "text", role: "company", label: "Company" },
            {
              key: "attendees",
              type: "select",
              role: "guest_count",
              label: "Estimated attendees",
              choices: [
                { value: "under_50", label: "Under 50" },
                { value: "50_150", label: "50 - 150" },
              ],
            },
            { key: "end", type: "time", role: "event_time", label: "Time" },
          ],
        },
      ],
    });
    if (!sel.ok) throw new Error(sel.errors.join("|"));
    const s = buildCrmSummary(sel.def, { company: "Acme", attendees: "50_150", end: "10:00", end__end: "12:00" }, {}, "waitlisted", "low");
    expect(s.guestCount).toBeNull();
    expect(s.guestLabel).toBe("50 - 150");
    expect(s.name).toBe("Acme");
    expect(s.company).toBe("Acme");
    expect(s.eventTimeStart).toBe("10:00");
    expect(s.eventTimeEnd).toBeNull();
    expect(s.ending).toBe("waitlisted");
  });

  it("ignores hidden answers", () => {
    const s = buildCrmSummary(def, { ...fullAnswers, services: ["dj_mc"], photo_booth_style: "prints" }, {}, "completed", null);
    expect(s.services).toEqual(["DJ / MC"]);
  });
});

describe("helpers", () => {
  it("asNumberOrNull, asBoolean, formatMoney", () => {
    expect(asNumberOrNull("$2,500")).toBe(2500);
    expect(asNumberOrNull("")).toBeNull();
    expect(asNumberOrNull(undefined)).toBeNull();
    expect(Number.isNaN(asNumberOrNull("abc"))).toBe(true);
    expect(Number.isNaN(asNumberOrNull(true))).toBe(true);
    expect(asBoolean("yes")).toBe(true);
    expect(asBoolean("no")).toBe(false);
    expect(asBoolean(0)).toBe(false);
    expect(formatMoney(2500)).toBe("$2,500");
    expect(formatMoney(1234567.4)).toBe("$1,234,567");
    expect(formatMoney(Number.NaN)).toBe("");
  });
});
