import { describe, expect, it } from "vitest";
import type { FormDefinition, FormSettings, Qualification } from "../types";
import {
  altDateWasChosen,
  applyAltDateChoice,
  budgetLabelOf,
  budgetQualification,
  celebrateFor,
  contactColumns,
  crmRefDone,
  dateResultWords,
  endingFor,
  eventDateOf,
  firstInvalidStep,
  hasContact,
  inquiryHeadline,
  isUuid,
  locationResultWords,
  missingContactErrors,
  newInquiryNotice,
  nextCurrentStep,
  parseCompleteBody,
  parseSaveBody,
  parseSlugBody,
  parseStartBody,
  parseTokenBody,
  qualificationSummaryLine,
  qualifyStepOf,
  resolveEnding,
  staleChecks,
  storedEndingKind,
  submissionHref,
  unfinishedNotice,
  urgencyFor,
  visitorQualification,
  withinUpdateWindow,
} from "./lifecycle-core";

const def: FormDefinition = {
  version: 1,
  steps: [
    {
      id: "s1",
      kind: "fields",
      title: "Let's check your date",
      fields: [
        { id: "f1", key: "full_name", type: "text", role: "name", label: "Full name", required: true, width: "half" },
        { id: "f2", key: "phone", type: "phone", role: "phone", label: "Mobile phone", required: false, width: "half" },
        { id: "f3", key: "email", type: "email", role: "email", label: "Email", required: false, width: "full" },
        { id: "f4", key: "event_date", type: "date", role: "event_date", label: "Event date", required: true, width: "half" },
        {
          id: "f5",
          key: "area",
          type: "select",
          role: "event_location",
          label: "Area",
          required: true,
          width: "half",
          choices: [
            { value: "ponte_vedra", label: "Ponte Vedra" },
            { value: "other", label: "Somewhere else", isOther: true },
          ],
        },
      ],
    },
    { id: "s2", kind: "qualify", title: "Checking our calendar", fields: [], checks: ["date", "location"] },
    {
      id: "s3",
      kind: "fields",
      title: "Details",
      fields: [
        { id: "f6", key: "guest_count", type: "number", role: "guest_count", label: "Guest count", required: false, width: "half", min: 1, max: 5000 },
        {
          id: "f7",
          key: "services",
          type: "checkbox",
          role: "services",
          label: "Services",
          required: true,
          width: "full",
          choices: [
            { value: "dj_mc", label: "DJ / MC" },
            { value: "photo_booth", label: "Photo Booth" },
          ],
        },
        {
          id: "f8",
          key: "booth_style",
          type: "radio",
          label: "Photo booth style",
          required: true,
          width: "full",
          choices: [{ value: "digital", label: "Digital" }],
          showIf: { fieldKey: "services", op: "includes", values: ["photo_booth"] },
        },
        {
          id: "f9",
          key: "budget",
          type: "budget",
          role: "budget",
          label: "Budget",
          required: false,
          width: "full",
          budget: {
            mode: "tiers",
            policy: "label",
            allowSkip: true,
            tiers: [
              { id: "under_1_000", label: "Under $1,000", min: null, max: 1000, acceptable: false },
              { id: "field_1_000_1_500", label: "$1,000 - $1,500", min: 1000, max: 1500, acceptable: true },
            ],
          },
        },
      ],
    },
  ],
};

const settings: FormSettings = {
  brand: "vident",
  accentColor: "#ae4213",
  submitLabel: "Send my request",
  thankYou: { title: "You're all set!", message: "Thanks." },
  waitlistThankYou: { title: "You're on the waitlist", message: "We'll reach out." },
  redirectUrl: null,
  qualify: {
    celebrate: true,
    popupTitle: "YOUR SEARCH IS OVER!",
    popupSubtitle: "WE ARE AVAILABLE",
    timings: { messageIntervalMs: 3000, minCheckMs: 4000, preCelebrationMs: 2000, popupMs: 5500 },
    urgency: "Popular dates go fast.",
    dateLoadingMessages: [],
    locationLoadingMessages: [],
  },
  onDateUnavailable: { actions: ["change_date", "waitlist", "continue"], message: "Busy" },
  onLocationFail: { action: "continue", message: "Far" },
  referral: null,
  confirmationEmail: { enabled: false, subject: "S", intro: "I" },
  notify: { recipients: [], inApp: true },
  hostEvent: true,
  progressHype: null,
  ownerByEventType: {},
  copies: { ghl: null },
};

const today = "2026-11-04";

describe("ids, windows and steps", () => {
  it("accepts only uuids as submission ids", () => {
    expect(isUuid("6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f")).toBe(true);
    expect(isUuid("6f1c2b8e")).toBe(false);
    expect(isUuid("6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f; drop table")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });

  it("allows saves for 72 hours from the start", () => {
    const started = "2026-11-01T12:00:00Z";
    expect(withinUpdateWindow(started, new Date("2026-11-04T12:00:00Z"))).toBe(true);
    expect(withinUpdateWindow(started, new Date("2026-11-04T12:00:01Z"))).toBe(false);
    expect(withinUpdateWindow("garbage", new Date())).toBe(false);
  });

  it("moves the current step forward only, never past the last step", () => {
    expect(nextCurrentStep(0, 0, 5)).toBe(1);
    expect(nextCurrentStep(3, 0, 5)).toBe(3);
    expect(nextCurrentStep(1, 2, 5)).toBe(3);
    expect(nextCurrentStep(3, 4, 5)).toBe(4);
    expect(nextCurrentStep(0, 0, 1)).toBe(0);
  });
});

describe("contact columns", () => {
  it("copies role answers into the submission columns", () => {
    const cols = contactColumns(def, {
      full_name: "Ann Lee",
      phone: "904-555-0142",
      email: "Ann@Example.com",
      event_date: "2027-05-15",
      area: "ponte_vedra",
      guest_count: 150,
    });
    expect(cols).toEqual({
      contact_name: "Ann Lee",
      contact_email: "ann@example.com",
      contact_phone: "904-555-0142",
      event_date: "2027-05-15",
      event_location: "Ponte Vedra",
      guest_count: 150,
    });
    expect(hasContact(cols)).toBe(true);
  });

  it("never writes a value the columns would reject", () => {
    const cols = contactColumns(def, { event_date: "2027-02-30", guest_count: 3e12, email: "nope" });
    expect(cols.event_date).toBeNull();
    expect(cols.guest_count).toBeNull();
    expect(cols.contact_email).toBeNull();
    expect(hasContact(cols)).toBe(false);
  });

  it("asks for an email or phone on both contact fields", () => {
    expect(missingContactErrors(def)).toEqual({
      email: "Please add an email or phone so we can reach you",
      phone: "Please add an email or phone so we can reach you",
    });
  });
});

describe("validation across steps", () => {
  const complete = {
    full_name: "Ann Lee",
    email: "ann@example.com",
    event_date: "2027-05-15",
    area: "ponte_vedra",
    services: ["dj_mc"],
  };

  it("passes a complete form and ignores hidden fields", () => {
    expect(firstInvalidStep(def, complete, today)).toBeNull();
  });

  it("points at the first step with a problem", () => {
    const missingName = firstInvalidStep(def, { ...complete, full_name: "" }, today);
    expect(missingName?.stepIndex).toBe(0);
    expect(Object.keys(missingName?.fieldErrors ?? {})).toEqual(["full_name"]);
    const shownButEmpty = firstInvalidStep(def, { ...complete, services: ["photo_booth"] }, today);
    expect(shownButEmpty?.stepIndex).toBe(2);
    expect(Object.keys(shownButEmpty?.fieldErrors ?? {})).toEqual(["booth_style"]);
  });

  it("rejects a past date server-side", () => {
    const past = firstInvalidStep(def, { ...complete, event_date: "2026-11-01" }, today);
    expect(past?.stepIndex).toBe(0);
    expect(past?.fieldErrors.event_date).toBeTruthy();
  });
});

describe("qualification helpers", () => {
  it("finds the availability step and its checks", () => {
    expect(qualifyStepOf(def)).toEqual({ index: 1, checks: ["date", "location"] });
    expect(qualifyStepOf({ version: 1, steps: [def.steps[0]] })).toBeNull();
  });

  it("reads the event date and budget", () => {
    expect(eventDateOf(def, { event_date: "2027-05-15" })).toBe("2027-05-15");
    expect(eventDateOf(def, { event_date: "2027-02-30" })).toBeNull();
    expect(budgetQualification(def, {})).toBeUndefined();
    expect(budgetQualification(def, { budget: { type: "tier", tierId: "under_1_000" } })).toEqual({
      passed: false,
      tierId: "under_1_000",
      amount: null,
    });
    expect(budgetQualification(def, { budget: { type: "skip" } })?.passed).toBeNull();
    expect(budgetLabelOf(def, { budget: { type: "tier", tierId: "field_1_000_1_500" } })).toBe("$1,000 - $1,500");
  });

  it("detects a suggested date being picked", () => {
    const prev: Qualification = {
      date: { result: "unavailable", checkedFor: "2027-05-15", message: "", alternatives: ["2027-05-16"], checkedAt: "x" },
    };
    expect(altDateWasChosen(prev, "2027-05-16")).toBe(true);
    expect(altDateWasChosen(prev, "2027-05-20")).toBe(false);
    expect(altDateWasChosen(prev, "2027-05-15")).toBe(false);
    expect(altDateWasChosen({}, "2027-05-16")).toBe(false);
  });

  it("keeps the suggested-date credit only while the visitor stays on that date", () => {
    // After the pick, the re-check stores a verdict for the suggested date itself (no alternatives).
    const picked: Qualification = {
      altDateChosen: true,
      altDate: "2027-05-16",
      date: { result: "available", checkedFor: "2027-05-16", message: "", checkedAt: "x" },
    };
    expect(altDateWasChosen(picked, "2027-05-16")).toBe(true);
    // They went back and typed a date we never suggested: no +15, no "picked a suggested date" line.
    expect(altDateWasChosen(picked, "2027-06-01")).toBe(false);
    expect(altDateWasChosen(picked, null)).toBe(false);
    // Older rows without altDate: the date the credit was given for is the last checked date.
    expect(altDateWasChosen({ altDateChosen: true, date: picked.date }, "2027-05-16")).toBe(true);
    expect(altDateWasChosen({ altDateChosen: true, date: picked.date }, "2027-06-01")).toBe(false);
  });

  it("applies the alt date credit to a qualification (set and cleared)", () => {
    const prev: Qualification = {
      date: { result: "unavailable", checkedFor: "2027-05-15", message: "", alternatives: ["2027-05-16"], checkedAt: "x" },
    };
    const q: Qualification = { ...prev };
    applyAltDateChoice(q, prev, "2027-05-16");
    expect(q).toMatchObject({ altDateChosen: true, altDate: "2027-05-16" });
    const later: Qualification = { ...q };
    applyAltDateChoice(later, q, "2027-07-04");
    expect(later.altDateChosen).toBeUndefined();
    expect(later.altDate).toBeUndefined();
  });

  it("celebrates only on real good news with the switch on", () => {
    const good: Qualification = {
      date: { result: "available", checkedFor: "2027-05-15", message: "", checkedAt: "x" },
      location: { result: "pass", message: "", checkedAt: "x" },
    };
    expect(celebrateFor(good, ["date", "location"], settings)).toBe(true);
    expect(celebrateFor(good, ["date", "location"], { ...settings, qualify: { ...settings.qualify, celebrate: false } })).toBe(
      false,
    );
    const open: Qualification = { ...good, date: { ...good.date!, result: "open" } };
    expect(celebrateFor(open, ["date"], settings)).toBe(false);
  });

  it("shows urgency only under a good date answer", () => {
    const date = (result: "available" | "open" | "limited" | "unknown") => ({
      date: { result, checkedFor: "2027-05-15", message: "", checkedAt: "x" },
    });
    expect(urgencyFor(date("available"), settings)).toBe("Popular dates go fast.");
    expect(urgencyFor(date("open"), settings)).toBe("Popular dates go fast.");
    expect(urgencyFor(date("limited"), settings)).toBeNull();
    expect(urgencyFor(date("unknown"), settings)).toBeNull();
    expect(urgencyFor({ ...date("available"), location: { result: "fail", message: "", checkedAt: "x" } }, settings)).toBeNull();
    expect(urgencyFor(date("available"), { ...settings, qualify: { ...settings.qualify, urgency: null } })).toBeNull();
  });
});

describe("completion re-checks and the visitor view", () => {
  const q: Qualification = {
    date: { result: "available", checkedFor: "2027-05-15", message: "Open", checkedAt: "x" },
    location: { result: "risky", message: "Fee", miles: 72.4, confidence: "high", query: "Casa Monica, St. Augustine", checkedAt: "x" },
    budget: { passed: true, tierId: "t", amount: null },
  };

  it("re-runs only the checks whose answer changed or never ran", () => {
    const same = { date: "2027-05-15", locationText: "Casa Monica, St. Augustine" };
    expect(staleChecks(q, ["date", "location"], same)).toEqual([]);
    expect(staleChecks(q, ["date", "location"], { ...same, date: "2027-05-16" })).toEqual(["date"]);
    expect(staleChecks(q, ["date", "location"], { ...same, locationText: "Ponte Vedra Inn" })).toEqual(["location"]);
    expect(staleChecks({}, ["date", "location"], same)).toEqual(["date", "location"]);
    expect(staleChecks(q, ["date"], { date: null, locationText: null })).toEqual(["date"]);
    expect(staleChecks({ date: { ...q.date!, checkedFor: null, result: "skipped" } }, ["date"], { date: null, locationText: null })).toEqual([]);
  });

  it("hides staff-only location details from the browser", () => {
    const shown = visitorQualification({ ...q, altDateChosen: true });
    expect(shown.location).toEqual({ result: "risky", message: "Fee", checkedAt: "x" });
    expect(JSON.stringify(shown)).not.toContain("72.4");
    expect(shown.date?.result).toBe("available");
    expect(shown.altDateChosen).toBe(true);
    expect(shown).not.toHaveProperty("budget");
  });

  it("returns the same ending on a second complete call", () => {
    expect(storedEndingKind("waitlisted", "completed", settings)).toBe("waitlisted");
    expect(storedEndingKind("completed", "waitlisted", settings)).toBe("completed");
    expect(storedEndingKind("spam", "waitlisted", settings)).toBe("waitlisted");
    expect(storedEndingKind("spam", "anything", settings)).toBe("completed");
  });
});

describe("staff wording", () => {
  it("words every verdict", () => {
    expect(dateResultWords("unavailable")).toBe("date already booked");
    expect(locationResultWords("risky")).toBe("travel fee zone");
  });

  it("summarizes the qualification in one staff line", () => {
    const q: Qualification = {
      date: { result: "available", checkedFor: "2027-05-15", message: "", checkedAt: "x" },
      location: { result: "risky", message: "", miles: 72.4, confidence: "high", query: "x", checkedAt: "x" },
      budget: { passed: true, tierId: "t", amount: null },
    };
    expect(qualificationSummaryLine({ qualification: q, score: 80, scoreLabel: "high", budgetLabel: "$1,500 - $2,500" })).toBe(
      "Fit: high (80). Date open. Travel fee zone, about 72 mi. Budget: $1,500 - $2,500.",
    );
    expect(qualificationSummaryLine({ qualification: {}, score: null, scoreLabel: null, budgetLabel: null })).toBe(
      "Not qualified automatically.",
    );
    expect(
      qualificationSummaryLine({ qualification: { ...q, altDateChosen: true }, score: 95, scoreLabel: "high", budgetLabel: null }),
    ).toContain("Picked one of our suggested dates.");
  });

  it("writes a short alert headline", () => {
    expect(
      inquiryHeadline({ name: "Ann Lee", email: null, phone: null, eventType: "Wedding", eventDate: "2027-05-15", scoreLabel: "high" }),
    ).toBe("Ann Lee - Wedding on Saturday, May 15, 2027 (high fit)");
    expect(
      inquiryHeadline({ name: "", email: "a@b.co", phone: null, eventType: null, eventDate: "2027-05-15", scoreLabel: null }),
    ).toBe("a@b.co - on Saturday, May 15, 2027");
    expect(inquiryHeadline({ name: null, email: null, phone: null, eventType: null, eventDate: null, scoreLabel: "low" })).toBe(
      "Someone (low fit)",
    );
  });

  it("builds the in-app alerts", () => {
    expect(newInquiryNotice({ headline: "Ann Lee - Wedding", ending: "completed" })).toEqual({
      title: "New website inquiry",
      body: "Ann Lee - Wedding",
    });
    expect(newInquiryNotice({ headline: "Ann Lee", ending: "waitlisted" }).body).toBe("Ann Lee - joined the waitlist");
    expect(
      unfinishedNotice({
        who: "Ann Lee",
        email: "ann@example.com",
        phone: "904-555-0142",
        formName: "Check Your Date",
        stepIndex: 1,
        totalSteps: 5,
        stepTitle: "Checking our calendar",
      }),
    ).toEqual({
      title: "Unfinished website inquiry",
      body: "Ann Lee stopped at step 2 of 5 (Checking our calendar) on Check Your Date. Reach them at ann@example.com or 904-555-0142.",
    });
  });
});

describe("endings and links", () => {
  it("returns the matching thank-you copy and only safe redirects", () => {
    expect(endingFor(settings, "completed")).toEqual({
      kind: "completed",
      title: "You're all set!",
      message: "Thanks.",
      redirectUrl: null,
    });
    expect(endingFor({ ...settings, redirectUrl: "https://example.com/thanks" }, "waitlisted")).toEqual({
      kind: "waitlisted",
      title: "You're on the waitlist",
      message: "We'll reach out.",
      redirectUrl: "https://example.com/thanks",
    });
    expect(endingFor({ ...settings, redirectUrl: "javascript:alert(1)" }, "completed").redirectUrl).toBeNull();
  });

  it("allows a waitlist ending only when the form offers it", () => {
    expect(resolveEnding("waitlisted", settings)).toBe("waitlisted");
    expect(resolveEnding("waitlisted", { ...settings, onDateUnavailable: { actions: ["continue"], message: "" } })).toBe(
      "completed",
    );
    expect(resolveEnding("spam", settings)).toBe("completed");
  });

  it("links to the submission drawer", () => {
    expect(submissionHref("form-1", "sub-1")).toBe("/inquiry-forms/form-1?tab=submissions&s=sub-1");
  });

  it("knows when the CRM write finished", () => {
    expect(crmRefDone({})).toBe(false);
    expect(crmRefDone(null)).toBe(false);
    expect(crmRefDone({ client_id: "c", partial: "true" })).toBe(false);
    expect(crmRefDone({ client_id: "c", lead_id: "l" })).toBe(true);
  });
});

describe("request bodies", () => {
  it("parses start", () => {
    expect(parseStartBody({ formSlug: " check-your-date ", answers: { a: 1 }, elapsedMs: 4000 })).toEqual({
      ok: true,
      value: { formSlug: "check-your-date", answers: { a: 1 }, attribution: undefined, hp: undefined, elapsedMs: 4000, turnstileToken: null },
    });
    expect(parseStartBody({ formSlug: "" }).ok).toBe(false);
    expect(parseStartBody("nope").ok).toBe(false);
    expect(parseStartBody({ formSlug: "x", answers: ["a"] })).toMatchObject({ ok: true, value: { answers: {} } });
    // The start keeps the Turnstile token (the server verifies it there too).
    expect(parseStartBody({ formSlug: "x", turnstileToken: "tok" })).toMatchObject({ ok: true, value: { turnstileToken: "tok" } });
  });

  it("parses save, ping/qualify, complete and slug bodies", () => {
    expect(parseSaveBody({ token: "t", stepIndex: 2, answers: {} }).ok).toBe(true);
    expect(parseSaveBody({ token: "t", stepIndex: 1.5 }).ok).toBe(false);
    expect(parseSaveBody({ stepIndex: 1 }).ok).toBe(false);
    expect(parseTokenBody({ token: "t" })).toEqual({ ok: true, value: { token: "t" } });
    expect(parseTokenBody({}).ok).toBe(false);
    expect(parseCompleteBody({ token: "t", ending: "waitlisted", turnstileToken: "" })).toEqual({
      ok: true,
      value: { token: "t", answers: {}, ending: "waitlisted", turnstileToken: null },
    });
    expect(parseSlugBody({ slug: "check-your-date", answers: { a: "b" } })).toEqual({
      ok: true,
      value: { slug: "check-your-date", formId: null, answers: { a: "b" } },
    });
    // The public client's spelling: formSlug + formId.
    expect(
      parseSlugBody({ formSlug: "check-your-date", formId: "6F1C2B8E-1D2A-4C3B-9E8F-0A1B2C3D4E5F", answers: {} }),
    ).toEqual({
      ok: true,
      value: { slug: "check-your-date", formId: "6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f", answers: {} },
    });
    expect(parseSlugBody({ formId: "6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f" })).toMatchObject({
      ok: true,
      value: { slug: null },
    });
    expect(parseSlugBody({}).ok).toBe(false);
    expect(parseSlugBody({ formId: "not-a-uuid" }).ok).toBe(false);
  });
});
