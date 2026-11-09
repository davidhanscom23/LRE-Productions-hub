import { describe, expect, it } from "vitest";
import { DEFAULT_BUDGET_STOP_MESSAGE, isValidEmail, isValidPhone, validateField, validateStep } from "./validation";
import type { Answers, BudgetConfig, FieldDef, StepDef } from "./types";

const ctx = { today: "2026-11-04" };

function f(partial: Partial<FieldDef> & Pick<FieldDef, "key" | "type">): FieldDef {
  return { id: partial.key, label: partial.key, required: false, width: "full", ...partial };
}

function check(field: FieldDef, value: unknown, extra: Answers = {}): string | null {
  return validateField(field, { [field.key]: value as Answers[string], ...extra }, ctx);
}

const tiers: BudgetConfig = {
  mode: "tiers",
  policy: "label",
  tiers: [
    { id: "low", label: "Under $1,000", min: null, max: 1000, acceptable: false },
    { id: "mid", label: "$1,000 - $2,500", min: 1000, max: 2500, acceptable: true },
  ],
};

describe("required text", () => {
  it("fails empty and whitespace-only, with a role-aware message", () => {
    const notes = f({ key: "notes", type: "textarea", required: true });
    expect(check(notes, "")).toBe("Please fill this in");
    expect(check(notes, "   \n ")).toBe("Please fill this in");
    expect(check(notes, undefined)).toBe("Please fill this in");
    expect(check(notes, "Hi")).toBeNull();
    expect(check(f({ key: "name", type: "text", role: "name", required: true }), "")).toBe("Please enter your name");
    expect(check(f({ key: "where", type: "address", required: true }), "")).toBe("Please enter a location");
  });

  it("optional fields may stay empty", () => {
    expect(check(f({ key: "notes", type: "textarea" }), "")).toBeNull();
  });

  it("applies min and max length (and the 2000 cap)", () => {
    const notes = f({ key: "notes", type: "textarea", minLength: 25, maxLength: 40 });
    expect(check(notes, "Too short")).toBe("Please enter at least 25 characters");
    expect(check(notes, "x".repeat(41))).toBe("Please keep this to 40 characters or fewer");
    expect(check(notes, "x".repeat(30))).toBeNull();
    expect(check(f({ key: "t", type: "text" }), "x".repeat(2001))).toBe("Please keep this to 2,000 characters or fewer");
    expect(check(f({ key: "t", type: "text", minLength: 1 }), "x")).toBeNull();
  });
});

describe("email (a dot after @ is required)", () => {
  const email = f({ key: "email", type: "email", required: true });
  it("validates", () => {
    expect(check(email, "")).toBe("Please enter your email");
    expect(check(email, "john@gmail")).toBe("Please enter a valid email address");
    expect(check(email, "a b@c.com")).toBe("Please enter a valid email address");
    expect(check(email, "john@gmail.com")).toBeNull(); // LeadGate's double-escaped regex rejected this (bug B19)
    expect(check(email, " John.Doe+events@Example.co ")).toBeNull();
    expect(check(email, `${"a".repeat(250)}@x.com`)).toBe("Please enter a valid email address");
    expect(isValidEmail("x@y.z")).toBe(true);
    // Characters that turn a mailto: link into extra headers (hidden Bcc, prefilled body) are refused.
    expect(isValidEmail("lead@example.com?bcc=attacker%40evil.test&body=hi")).toBe(false);
    expect(isValidEmail("planner@agency.com?bcc=x@evil.com")).toBe(false);
    expect(isValidEmail("a&b@example.com")).toBe(false);
    expect(isValidEmail("a@exa#mple.com")).toBe(false);
    expect(isValidEmail("a@example.com/x")).toBe(false);
    expect(isValidEmail("<a@example.com>")).toBe(false);
    expect(isValidEmail("o'brien+events@mail.example.co")).toBe(true);
    expect(isValidEmail("first.last@sub-domain.example.org")).toBe(true);
    expect(isValidEmail("x@y")).toBe(false);
  });
});

describe("phone", () => {
  const phone = f({ key: "phone", type: "phone", required: true });
  it("accepts common US and international formats", () => {
    for (const ok of ["904-571-9064", "+1 (904) 571-9064", "904.571.9064", "9045719064", "555-1234", "+44 20 7946 0958"]) {
      expect(check(phone, ok), ok).toBeNull();
    }
  });
  it("rejects junk", () => {
    expect(check(phone, "")).toBe("Please enter your phone number");
    for (const bad of ["1-2-3-4", "555-12", "call me", "904-571-9064 ext 2", "+1 (904) 571-9064-0000", "-".repeat(7)]) {
      expect(check(phone, bad), bad).toBe("Please enter a valid phone number");
    }
    expect(isValidPhone("(((((((")).toBe(false);
  });
});

describe("date (business-time-zone today)", () => {
  const date = f({ key: "event_date", type: "date", required: true });
  it("validates format and refuses past dates", () => {
    expect(check(date, "")).toBe("Please choose a date");
    expect(check(date, "05/15/2027")).toBe("Please choose a valid date");
    expect(check(date, "2027-02-30")).toBe("Please choose a valid date");
    expect(check(date, "2026-11-03")).toBe("That date has passed. Please choose an upcoming date");
    expect(check(date, "2026-11-04")).toBeNull();
    expect(check(date, "2030-01-01")).toBeNull();
  });
  it("skips the past check when today is unknown", () => {
    expect(validateField(date, { event_date: "2020-01-01" }, { today: "" })).toBeNull();
  });
});

describe("time", () => {
  const time = f({ key: "event_time", type: "time", required: true, showEndTime: true });
  it("validates start and optional end", () => {
    expect(check(time, "")).toBe("Please choose a time");
    expect(check(time, "25:00")).toBe("Please choose a valid time");
    expect(check(time, "18:00")).toBeNull();
    expect(check(time, "18:00:00")).toBeNull();
    expect(check(time, "", { event_time__end: "23:00" })).toBe("Please choose a start time");
    expect(check(time, "18:00", { event_time__end: "late" })).toBe("Please choose a valid end time");
    expect(check(time, "18:00", { event_time__end: "18:00" })).toBe("The end time must be different from the start time");
    expect(check(time, "21:00", { event_time__end: "01:00" })).toBeNull(); // overnight events are normal
  });
  it("ignores the end companion when the field has no end time", () => {
    const start = f({ key: "t", type: "time" });
    expect(check(start, "", { t__end: "23:00" })).toBeNull();
  });
});

describe("number", () => {
  it("validates, with numeric strings accepted", () => {
    const n = f({ key: "n", type: "number", required: true, min: 1, max: 5000 });
    expect(check(n, "")).toBe("Please enter a number");
    expect(check(n, null)).toBe("Please enter a number");
    expect(check(n, "abc")).toBe("Please enter a number");
    expect(check(n, "12")).toBeNull();
    expect(check(n, 0)).toBe("Please enter 1 or more");
    expect(check(n, 5001)).toBe("Please enter 5,000 or less");
    expect(check(n, 1e12)).toBe("Please enter a smaller number");
  });
  it("guest counts are whole numbers of 0 or more (DB column is int)", () => {
    const g = f({ key: "guest_count", type: "number", role: "guest_count" });
    expect(check(g, 12.5)).toBe("Please enter a whole number");
    expect(check(g, -3)).toBe("Please enter 0 or more");
    expect(check(g, 150)).toBeNull();
  });
});

describe("choices", () => {
  const radio = f({
    key: "event_type",
    type: "radio",
    required: true,
    choices: [
      { value: "wedding", label: "Wedding" },
      { value: "other", label: "Other", isOther: true },
    ],
  });
  it("radio / select need one of the options", () => {
    expect(check(radio, "")).toBe("Please choose an option");
    expect(check(radio, "gala")).toBe("Please choose one of the options");
    expect(check(radio, "wedding")).toBeNull();
    expect(check({ ...radio, type: "select" }, "gala")).toBe("Please choose one of the options");
  });
  it("Other needs no detail", () => {
    expect(check(radio, "other")).toBeNull();
    expect(check(radio, "other", { event_type__other: "" })).toBeNull();
  });
  it("contact preference uses the fixed email | text | phone options", () => {
    const pref = f({ key: "pref", type: "contact_preference", required: true });
    expect(check(pref, "")).toBe("Please choose how we should reach you");
    expect(check(pref, "text")).toBeNull();
    expect(check(pref, "phone")).toBeNull();
    expect(check(pref, "call")).toBe("Please choose one of the options");
  });
  it("a required multi-select fails with nothing checked (LeadGate bug B24)", () => {
    const multi = f({ key: "services", type: "checkbox", required: true, choices: [{ value: "dj", label: "DJ" }, { value: "booth", label: "Booth" }] });
    expect(check(multi, [])).toBe("Please choose at least one option");
    expect(check(multi, undefined)).toBe("Please choose at least one option");
    expect(check(multi, ["dj"])).toBeNull();
    expect(check(multi, "dj")).toBeNull();
    expect(check(multi, ["dj", "laser"])).toBe("Please choose from the options shown");
  });
  it("a required consent box must be checked", () => {
    const consent = f({ key: "agree", type: "checkbox", required: true });
    expect(check(consent, false)).toBe("Please check this box to continue");
    expect(check(consent, undefined)).toBe("Please check this box to continue");
    expect(check(consent, true)).toBeNull();
    expect(check(consent, "true")).toBeNull();
    expect(check({ ...consent, required: false }, false)).toBeNull();
  });
});

describe("budget", () => {
  it("required: tier or skip (when allowed)", () => {
    const b = f({ key: "budget", type: "budget", required: true, budget: tiers });
    expect(check(b, null)).toBe("Please choose a budget range");
    expect(check(b, { type: "skip" })).toBe("Please choose a budget range");
    const skippable = f({ key: "budget", type: "budget", required: true, budget: { ...tiers, allowSkip: true } });
    expect(check(skippable, null)).toBe("Please choose a budget range, or skip this question");
    expect(check(skippable, { type: "skip" })).toBeNull();
    const slider = f({ key: "budget", type: "budget", required: true, budget: { mode: "slider", policy: "label", slider: { min: 0, max: 10000, step: 500 } } });
    expect(check(slider, null)).toBe("Please choose a budget");
  });

  it("rejects unknown tiers and bad amounts; accepts the legacy bare tier id", () => {
    const b = f({ key: "budget", type: "budget", budget: tiers });
    expect(check(b, { type: "tier", tierId: "gold" })).toBe("Please choose one of the budget options");
    expect(check(b, { type: "amount", amount: -5 })).toBe("Please enter a budget amount");
    expect(check(b, { type: "amount", amount: 2500 })).toBeNull();
    expect(check(b, { type: "nope" })).toBe("Please choose one of the budget options");
    expect(check(b, "mid")).toBeNull();
  });

  it("label policy never blocks a low budget", () => {
    const b = f({ key: "budget", type: "budget", budget: tiers });
    expect(check(b, { type: "tier", tierId: "low" })).toBeNull();
  });

  it("strict stop blocks a low tier or amount with the below message", () => {
    const strict = f({ key: "budget", type: "budget", budget: { ...tiers, policy: "strict_stop", belowMessage: "Our packages start at $1,000." } });
    expect(check(strict, { type: "tier", tierId: "low" })).toBe("Our packages start at $1,000.");
    expect(check(strict, { type: "tier", tierId: "mid" })).toBeNull();
    const noMessage = f({ key: "budget", type: "budget", budget: { ...tiers, policy: "strict_stop" } });
    expect(check(noMessage, { type: "tier", tierId: "low" })).toBe(DEFAULT_BUDGET_STOP_MESSAGE);
    const slider = f({
      key: "budget",
      type: "budget",
      budget: { mode: "slider", policy: "strict_stop", minimum: 2000, slider: { min: 0, max: 10000, step: 500 } },
    });
    expect(check(slider, { type: "amount", amount: 1500 })).toBe(DEFAULT_BUDGET_STOP_MESSAGE);
    expect(check(slider, { type: "amount", amount: 2000 })).toBeNull();
  });
});

describe("hidden fields are never validated", () => {
  const services = f({ key: "services", type: "checkbox", choices: [{ value: "photo_booth", label: "Photo Booth" }, { value: "dj", label: "DJ" }] });
  const style = f({
    key: "style",
    type: "radio",
    required: true,
    choices: [{ value: "digital", label: "Digital" }],
    showIf: { fieldKey: "services", op: "includes", values: ["photo_booth"] },
  });

  it("validateField returns null for a hidden required field", () => {
    expect(validateField(style, { services: ["dj"] }, ctx)).toBeNull();
    expect(validateField(style, { services: ["photo_booth"] }, ctx)).toBe("Please choose an option");
  });

  it("validateStep only reports visible fields, keyed by field key", () => {
    const step: StepDef = { id: "s", kind: "fields", title: "S", fields: [services, style, f({ key: "email", type: "email", required: true })] };
    expect(validateStep(step, { services: ["dj"] }, ctx)).toEqual({ email: "Please enter your email" });
    expect(validateStep(step, { services: ["photo_booth"], email: "a@b.co" }, ctx)).toEqual({ style: "Please choose an option" });
    expect(validateStep(step, { services: ["photo_booth"], style: "digital", email: "a@b.co" }, ctx)).toEqual({});
  });

  it("handles condition chains inside the step", () => {
    const planner = f({ key: "planner", type: "text", required: true, showIf: { fieldKey: "style", op: "answered" } });
    const step: StepDef = { id: "s", kind: "fields", title: "S", fields: [services, style, planner] };
    // style holds a stale answer but is hidden, so planner is hidden too.
    expect(validateStep(step, { services: ["dj"], style: "digital" }, ctx)).toEqual({});
  });

  it("qualify steps and content blocks never produce errors", () => {
    expect(validateStep({ id: "q", kind: "qualify", title: "Q", fields: [], checks: ["date"] }, {}, ctx)).toEqual({});
    expect(validateField(f({ key: "c", type: "content", required: true, content: { text: "Hi" } }), {}, ctx)).toBeNull();
  });
});
