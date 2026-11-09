import { describe, expect, it } from "vitest";
import type { DateVerdict, FieldDef, FormDefinition, PublicFormSettings } from "@/lib/inquiry-forms/types";
import {
  canContinuePastBlockedDate,
  dateTone,
  fieldErrorFor,
  formatUsd,
  hostOf,
  hypeFor,
  isDateBlocked,
  locationTone,
  nextLabel,
  previewEnding,
  progressItems,
  qualifyKey,
  stepErrors,
  stepForFieldErrors,
  stepPayload,
  unavailableActions,
  unavailableDialogMessage,
} from "./flow";

const TODAY = "2026-11-04";

let n = 0;
function f(partial: Partial<FieldDef> & Pick<FieldDef, "key" | "type" | "label">): FieldDef {
  n += 1;
  return { id: `f${n}`, required: false, width: "full", ...partial };
}

/** Shaped like the Y1 "Check Your Date" preset (spec sec 5). */
const DEF: FormDefinition = {
  version: 1,
  steps: [
    {
      id: "s-you",
      kind: "fields",
      title: "Let's check your date",
      progressLabel: "You",
      fields: [
        f({ key: "full_name", type: "text", role: "name", label: "Full name", required: true, width: "half" }),
        f({ key: "mobile_phone", type: "phone", role: "phone", label: "Mobile phone", required: true, width: "half" }),
        f({ key: "email", type: "email", role: "email", label: "Email", required: true }),
        f({ key: "event_date", type: "date", role: "event_date", label: "Event date", required: true, width: "half" }),
        f({ key: "venue", type: "address", role: "event_location", label: "Venue or city", required: true, width: "half" }),
      ],
    },
    {
      id: "s-check",
      kind: "qualify",
      title: "Checking our calendar",
      progressLabel: "Availability",
      fields: [],
      checks: ["date", "location"],
    },
    {
      id: "s-event",
      kind: "fields",
      title: "Tell us about your event",
      progressLabel: "Event",
      fields: [
        f({
          key: "event_type",
          type: "radio",
          role: "event_type",
          label: "Type of event",
          required: true,
          layout: "cards",
          choices: [
            { value: "wedding", label: "Wedding" },
            { value: "other", label: "Other", isOther: true },
          ],
        }),
        f({ key: "guest_count", type: "number", role: "guest_count", label: "Guest count", min: 1, max: 5000, width: "half" }),
        f({ key: "event_time", type: "time", role: "event_time", label: "Start and end time", showEndTime: true, width: "half" }),
        f({ key: "intro", type: "content", label: "Intro", content: { text: "A few details help us plan.", tone: "info" } }),
      ],
    },
    {
      id: "s-services",
      kind: "fields",
      title: "What would you like?",
      progressLabel: "Services",
      fields: [
        f({
          key: "services",
          type: "checkbox",
          role: "services",
          label: "Services",
          required: true,
          layout: "chips",
          choices: [
            { value: "dj_mc", label: "DJ / MC" },
            { value: "photo_booth", label: "Photo Booth" },
          ],
        }),
        f({
          key: "booth_style",
          type: "radio",
          label: "Photo booth style",
          required: true,
          choices: [
            { value: "digital", label: "Digital Photo Booth" },
            { value: "prints", label: "Photo Booth with Prints" },
          ],
          showIf: { fieldKey: "services", op: "includes", values: ["photo_booth"] },
        }),
        f({
          key: "budget",
          type: "budget",
          role: "budget",
          label: "Budget for DJ/MC",
          budget: {
            mode: "tiers",
            policy: "strict_stop",
            allowSkip: true,
            belowMessage: "Our DJ packages start at $1,000.",
            tiers: [
              { id: "under_1000", label: "Under $1,000", max: 1000, acceptable: false },
              { id: "1000_1500", label: "$1,000 - $1,500", min: 1000, max: 1500, acceptable: true },
            ],
          },
        }),
      ],
    },
    {
      id: "s-finish",
      kind: "fields",
      title: "Last step",
      progressLabel: "Finish",
      fields: [
        f({ key: "contact_pref", type: "contact_preference", role: "contact_preference", label: "How should we reach you?", required: true }),
        f({ key: "notes", type: "textarea", role: "notes", label: "Anything else we should know?", maxLength: 2000 }),
      ],
    },
  ],
};

const SETTINGS = {
  submitLabel: "Send my request",
  progressHype: null,
  onDateUnavailable: { actions: ["change_date", "waitlist", "continue"], message: "That date is already busy for us." },
  thankYou: { title: "You're all set!", message: "Thanks for reaching out." },
  waitlistThankYou: { title: "You're on the waitlist", message: "We'll reach out if the date opens." },
  redirectUrl: null,
} as unknown as PublicFormSettings;

describe("stepPayload", () => {
  it("sends every visible field, with null for empty answers", () => {
    const p = stepPayload(DEF.steps[0], { full_name: "Dana Cole", email: "  " });
    expect(p).toEqual({
      full_name: "Dana Cole",
      mobile_phone: null,
      email: null,
      event_date: null,
      venue: null,
    });
  });

  it("never sends hidden (showIf false) fields, and sends them once visible", () => {
    const hidden = stepPayload(DEF.steps[3], { services: ["dj_mc"], booth_style: "prints" });
    expect(hidden).not.toHaveProperty("booth_style");
    const shown = stepPayload(DEF.steps[3], { services: ["dj_mc", "photo_booth"], booth_style: "prints" });
    expect(shown.booth_style).toBe("prints");
  });

  it("sends the Other text only while Other is selected, and the end time companion", () => {
    const withOther = stepPayload(DEF.steps[2], { event_type: "other", event_type__other: "Reunion", event_time: "18:00", event_time__end: "23:00" });
    expect(withOther.event_type__other).toBe("Reunion");
    expect(withOther.event_time__end).toBe("23:00");
    const switched = stepPayload(DEF.steps[2], { event_type: "wedding", event_type__other: "Reunion" });
    expect(switched.event_type__other).toBeNull();
  });

  it("skips content blocks and qualify steps", () => {
    expect(stepPayload(DEF.steps[2], {})).not.toHaveProperty("intro");
    expect(stepPayload(DEF.steps[1], { event_date: "2027-05-15" })).toEqual({});
  });
});

describe("stepErrors / fieldErrorFor", () => {
  it("flags required visible fields only", () => {
    const errs = stepErrors(DEF.steps[3], { services: ["dj_mc"] }, TODAY);
    expect(errs).not.toHaveProperty("booth_style");
    const errs2 = stepErrors(DEF.steps[3], { services: ["photo_booth"] }, TODAY);
    expect(errs2.booth_style).toBeTruthy();
  });

  it("blocks a strict_stop budget below the minimum with the field's own message", () => {
    const errs = stepErrors(DEF.steps[3], { services: ["dj_mc"], budget: { type: "tier", tierId: "under_1000" } }, TODAY);
    expect(errs.budget).toBe("Our DJ packages start at $1,000.");
    const ok = stepErrors(DEF.steps[3], { services: ["dj_mc"], budget: { type: "tier", tierId: "1000_1500" } }, TODAY);
    expect(ok).toEqual({});
    const skipped = stepErrors(DEF.steps[3], { services: ["dj_mc"], budget: { type: "skip" } }, TODAY);
    expect(skipped).toEqual({});
  });

  it("validates one field like the step does, and treats hidden fields as valid", () => {
    const step0 = DEF.steps[0].fields;
    const email = step0.find((x) => x.key === "email")!;
    expect(fieldErrorFor(email, { email: "dana@" }, TODAY)).toBeTruthy();
    expect(fieldErrorFor(email, { email: "dana@example.com" }, TODAY)).toBeNull();
    const date = step0.find((x) => x.key === "event_date")!;
    expect(fieldErrorFor(date, { event_date: "2026-11-03" }, TODAY)).toBeTruthy();
    const booth = DEF.steps[3].fields.find((x) => x.key === "booth_style")!;
    expect(fieldErrorFor(booth, { services: ["dj_mc"] }, TODAY)).toBeNull();
  });
});

describe("stepForFieldErrors", () => {
  it("returns the earliest step holding an errored key (companions map to their field)", () => {
    expect(stepForFieldErrors(DEF, { guest_count: "x" })).toBe(2);
    expect(stepForFieldErrors(DEF, { event_type__other: "x", email: "y" })).toBe(0);
    expect(stepForFieldErrors(DEF, { event_time__end: "x" })).toBe(2);
  });
  it("prefers a valid server hint and ignores unknown keys", () => {
    expect(stepForFieldErrors(DEF, { email: "x" }, 4)).toBe(4);
    expect(stepForFieldErrors(DEF, { email: "x" }, 99)).toBe(0);
    expect(stepForFieldErrors(DEF, { nope: "x" })).toBeNull();
  });
});

describe("labels and progress", () => {
  it("uses the next step's title, the submit label last, and the waitlist label when waitlisting", () => {
    // Before a check step the button names the action, never the check's progress title.
    expect(nextLabel(DEF, SETTINGS, 0, false)).toBe("Check availability");
    expect(nextLabel(DEF, SETTINGS, 1, false)).toBe("Tell us about your event");
    expect(nextLabel(DEF, SETTINGS, 4, false)).toBe("Send my request");
    expect(nextLabel(DEF, SETTINGS, 4, true)).toBe("Join the waitlist");
  });

  it("names a location-only check as the action too", () => {
    const def: FormDefinition = { ...DEF, steps: DEF.steps.map((s) => (s.kind === "qualify" ? { ...s, checks: ["location"] } : s)) };
    expect(nextLabel(def, SETTINGS, 0, false)).toBe("Check my location");
  });

  it("lets a step's buttonText override the default", () => {
    const def: FormDefinition = { ...DEF, steps: DEF.steps.map((s, i) => (i === 0 ? { ...s, buttonText: "Check my date" } : s)) };
    expect(nextLabel(def, SETTINGS, 0, false)).toBe("Check my date");
  });

  it("labels progress segments with progressLabel, falling back to the title", () => {
    const items = progressItems(DEF);
    expect(items.map((i) => i.label)).toEqual(["You", "Availability", "Event", "Services", "Finish"]);
    const plain: FormDefinition = { version: 1, steps: [{ ...DEF.steps[0], progressLabel: undefined }] };
    expect(progressItems(plain)[0].label).toBe("Let's check your date");
  });

  it("returns the hype line for a step only when set", () => {
    const hype = { progressHype: ["Getting warmed up...", "  ", "MAX HYPE!"] } as Pick<PublicFormSettings, "progressHype">;
    expect(hypeFor(hype, 0)).toBe("Getting warmed up...");
    expect(hypeFor(hype, 1)).toBeNull();
    expect(hypeFor(hype, 7)).toBeNull();
    expect(hypeFor({ progressHype: null }, 0)).toBeNull();
  });
});

describe("qualifyKey", () => {
  it("changes when the date or the location changes, nothing else", () => {
    const a = qualifyKey(DEF, { event_date: "2027-05-15", venue: "Casa Monica", full_name: "A" });
    expect(qualifyKey(DEF, { event_date: "2027-05-15", venue: "Casa Monica", full_name: "B" })).toBe(a);
    expect(qualifyKey(DEF, { event_date: "2027-05-16", venue: "Casa Monica" })).not.toBe(a);
    expect(qualifyKey(DEF, { event_date: "2027-05-15", venue: "St. Augustine" })).not.toBe(a);
  });
});

describe("honest result tones", () => {
  it("maps date results", () => {
    expect(dateTone("available")).toBe("good");
    expect(dateTone("open")).toBe("good");
    expect(dateTone("limited")).toBe("caution");
    for (const r of ["unavailable", "blackout", "too_soon"] as const) {
      expect(dateTone(r)).toBe("bad");
      expect(isDateBlocked(r)).toBe(true);
    }
    expect(dateTone("unknown")).toBe("unknown");
    expect(dateTone("skipped")).toBe("unknown");
    expect(isDateBlocked("limited")).toBe(false);
    expect(isDateBlocked(undefined)).toBe(false);
  });

  it("maps location results", () => {
    expect(locationTone("pass")).toBe("good");
    expect(locationTone("risky")).toBe("caution");
    expect(locationTone("talk")).toBe("caution");
    expect(locationTone("fail")).toBe("bad");
    expect(locationTone("unverified")).toBe("unknown");
    expect(locationTone("skipped")).toBe("unknown");
  });
});

describe("unavailableActions", () => {
  const verdict = (alternatives?: string[]): DateVerdict => ({
    result: "unavailable",
    checkedFor: "2027-05-15",
    message: "That date is booked.",
    alternatives,
    checkedAt: "2026-11-04T20:00:00Z",
  });

  it("keeps settings order, drops duplicates and unknown actions", () => {
    const s = {
      onDateUnavailable: { actions: ["waitlist", "change_date", "waitlist", "bogus", "continue"], message: "" },
    } as unknown as PublicFormSettings;
    expect(unavailableActions(DEF, s, verdict())).toEqual(["waitlist", "change_date", "continue"]);
  });

  it("offers alternatives only when the server sent dates", () => {
    const s = {
      onDateUnavailable: { actions: ["change_date", "alternatives", "continue"], message: "" },
    } as unknown as PublicFormSettings;
    expect(unavailableActions(DEF, s, verdict([]))).toEqual(["change_date", "continue"]);
    expect(unavailableActions(DEF, s, verdict(["2027-05-14"]))).toEqual(["change_date", "alternatives", "continue"]);
  });

  it("drops change_date when the form has no date field", () => {
    const noDate: FormDefinition = { version: 1, steps: [{ ...DEF.steps[0], fields: DEF.steps[0].fields.filter((x) => x.role !== "event_date") }] };
    const s = { onDateUnavailable: { actions: ["change_date", "continue"], message: "" } } as unknown as PublicFormSettings;
    expect(unavailableActions(noDate, s, verdict())).toEqual(["continue"]);
  });

  it("allows Next past a blocked date only with continue (or no actions at all)", () => {
    expect(canContinuePastBlockedDate(["change_date", "continue"])).toBe(true);
    expect(canContinuePastBlockedDate([])).toBe(true);
    expect(canContinuePastBlockedDate(["change_date", "waitlist"])).toBe(false);
  });
});

describe("unavailableDialogMessage", () => {
  const FORM_TAKEN = "That date is already busy for us. You can pick another date, or send your request anyway.";
  const BLACKOUT = "We're not taking bookings on that date. Please choose another date, or send your request.";
  const TOO_SOON = "That date is a little too soon to book online. Send your request and we'll see what we can do.";

  it("uses the form's 'date is taken' message for a busy date", () => {
    expect(unavailableDialogMessage("unavailable", FORM_TAKEN, "Booked.")).toBe(FORM_TAKEN);
  });

  it("never calls a blackout day 'already busy': it shows the blackout message", () => {
    expect(unavailableDialogMessage("blackout", FORM_TAKEN, BLACKOUT)).toBe(BLACKOUT);
  });

  it("never calls a too-soon date 'already busy': it shows the minimum notice message", () => {
    expect(unavailableDialogMessage("too_soon", FORM_TAKEN, TOO_SOON)).toBe(TOO_SOON);
  });

  it("falls back to the other message when one is empty, trims, and never returns undefined", () => {
    expect(unavailableDialogMessage("blackout", FORM_TAKEN, "  ")).toBe(FORM_TAKEN);
    expect(unavailableDialogMessage("unavailable", "", ` ${BLACKOUT} `)).toBe(BLACKOUT);
    expect(unavailableDialogMessage("too_soon", null, undefined)).toBe("");
  });
});

describe("previewEnding and small formatters", () => {
  it("builds the local preview ending from settings copy", () => {
    expect(previewEnding(SETTINGS, "completed")).toEqual({
      kind: "completed",
      title: "You're all set!",
      message: "Thanks for reaching out.",
      redirectUrl: null,
    });
    expect(previewEnding(SETTINGS, "waitlisted").title).toBe("You're on the waitlist");
  });

  it("formats dollars and hosts", () => {
    expect(formatUsd(2500)).toBe("$2,500");
    expect(formatUsd(999.6)).toBe("$1,000");
    expect(hostOf("https://example.com/thank-you?x=1")).toBe("example.com");
    expect(hostOf("not a url")).toBeNull();
  });
});
