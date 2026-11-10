import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { darkenForWhiteText, whiteTextContrast } from "@/components/inquiry-forms/admin/form-settings-contrast";
import { allFields, keyFromLabel, validateDefinition } from "../definition";
import { DEFAULT_BUSINESS_SETTINGS, DEFAULT_FORM_SETTINGS, mergeBusinessSettings, mergeFormSettings } from "../defaults";
import { isValidSlug } from "../slug";
import type { FieldDef } from "../types";
import { layerSettings } from "./bundle-core";
import {
  BRANDS,
  DEFAULT_BRAND_KEY,
  HUB_BUSINESS_DEFAULTS,
  STARTER_FORMS,
  VIDENT_BRONZE,
  VIDENT_BRONZE_AA,
} from "./presets";

function byKey(fields: FieldDef[], key: string): FieldDef {
  const f = fields.find((x) => x.key === key);
  if (!f) throw new Error(`missing field ${key}`);
  return f;
}

const labels = (f: FieldDef) => (f.choices ?? []).map((c) => c.label);

describe("starter forms", () => {
  it("are the two spec forms with valid, unique slugs and known brands", () => {
    expect(STARTER_FORMS.map((f) => [f.slug, f.name, f.brand])).toEqual([
      ["get-a-quote", "Get a Quote", "vident-productions"],
      ["request-av", "Request AV", "vident-av"],
    ]);
    const brandKeys = new Set(BRANDS.map((b) => b.key));
    for (const form of STARTER_FORMS) {
      expect(isValidSlug(form.slug)).toBe(true);
      expect(brandKeys.has(form.brand)).toBe(true);
      expect(form.settings.brand).toBe(form.brand);
    }
  });

  it.each(STARTER_FORMS.map((f) => [f.slug, f] as const))("%s passes validateDefinition unchanged", (_slug, form) => {
    const result = validateDefinition(form.definition);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    // Nothing was renamed, regenerated or dropped by the validator.
    expect(result.def).toEqual(form.definition);
  });

  it.each(STARTER_FORMS.map((f) => [f.slug, f] as const))("%s uses snake_case label values for every option", (_slug, form) => {
    for (const field of allFields(form.definition)) {
      const taken = new Set<string>();
      for (const choice of field.choices ?? []) {
        const expected = keyFromLabel(choice.label, taken);
        taken.add(expected);
        expect(choice.value).toBe(expected);
      }
      const tierTaken = new Set<string>();
      for (const tier of field.budget?.tiers ?? []) {
        const expected = keyFromLabel(tier.label, tierTaken);
        tierTaken.add(expected);
        expect(tier.id).toBe(expected);
      }
    }
  });

  it.each(STARTER_FORMS.map((f) => [f.slug, f] as const))("%s: every showIf points at an earlier field and a real value", (_slug, form) => {
    const seen: FieldDef[] = [];
    for (const field of allFields(form.definition)) {
      if (field.showIf) {
        const ref = seen.find((f) => f.key === field.showIf?.fieldKey);
        expect(ref, `${field.key} depends on an earlier field`).toBeTruthy();
        const values = new Set((ref?.choices ?? []).map((c) => c.value));
        for (const v of field.showIf.values ?? []) expect(values.has(v), `${field.key}: "${v}" is an option`).toBe(true);
      }
      seen.push(field);
    }
  });

  it("keeps settings stable through mergeFormSettings", () => {
    for (const form of STARTER_FORMS) expect(mergeFormSettings(form.settings)).toEqual(form.settings);
  });

  it("keeps white button text readable (the editor warns below 4.5:1)", () => {
    for (const form of STARTER_FORMS) {
      expect(whiteTextContrast(form.settings.accentColor), form.slug).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("David's picks (05-Nov-26): confirmation on, staff email to hello@ with David always copied", () => {
    for (const form of STARTER_FORMS) {
      expect(form.settings.confirmationEmail.enabled, form.slug).toBe(true);
      expect(form.settings.notify.recipients, form.slug).toEqual(["hello@lreproductions.com"]);
    }
  });

  it("copies every inquiry to GoHighLevel exactly as each website's form does, never to DJEP", () => {
    const [quote, av] = STARTER_FORMS;
    expect(quote.settings.copies.ghl).toMatchObject({
      enabled: true,
      locationId: "LsjUOxo376FX3spTvDwa",
      trackingId: "tk_2ba7711add5e48fcbaeca8e803d01da4",
      formId: "Contact Form",
      notesKey: "contact.event_details",
      eventTypeKey: "contact.event_type",
      servicesKey: "contact.services_needed",
    });
    expect(av.settings.copies.ghl).toMatchObject({ enabled: true, formId: "LRE AV Website Form", notesKey: "calendar_notes", notesLabel: "Message" });
    for (const form of STARTER_FORMS) expect(form.settings.copies, form.slug).not.toHaveProperty("djep");
  });

  it("routes Get a Quote by event type to the website's directors; Other and Request AV stay with the admins", () => {
    const [quote, av] = STARTER_FORMS;
    const typeField = allFields(quote.definition).find((f) => f.role === "event_type");
    const ownerOf = (label: string) => quote.settings.ownerByEventType[typeField?.choices?.find((c) => c.label === label)?.value ?? ""] ?? null;
    for (const label of ["Corporate Event", "Incentive Trip", "Team Building", "Game Show", "Tradeshow", "Virtual or Hybrid"]) {
      expect(ownerOf(label), label).toBe("hello@lreproductions.com");
    }
    expect(ownerOf("Wedding")).toBe("hello@lreproductions.com");
    expect(ownerOf("Social Celebration")).toBe("hello@lreproductions.com");
    expect(ownerOf("Golf Experience")).toBe("hello@lreproductions.com");
    expect(ownerOf("Other")).toBeNull();
    expect(av.settings.ownerByEventType).toEqual({});
  });
});

describe("V1 Get a Quote", () => {
  const form = STARTER_FORMS[0];
  const fields = allFields(form.definition);

  it("follows the spec steps with a date-only check after when and where", () => {
    expect(form.definition.steps.map((s) => [s.title, s.kind])).toEqual([
      ["Let's start with you", "fields"],
      ["What are you planning?", "fields"],
      ["When and where", "fields"],
      ["Checking our calendar", "qualify"],
      ["What do you need?", "fields"],
      ["Last details", "fields"],
    ]);
    expect(form.definition.steps[3].checks).toEqual(["date"]);
    expect(form.definition.steps[0].fields.map((f) => [f.key, f.role, f.required, f.width])).toEqual([
      ["full_name", "name", true, "half"],
      ["phone", "phone", true, "half"],
      ["email", "email", true, "full"],
      ["company", "company", false, "full"],
    ]);
  });

  it("offers the event types as cards and branches for weddings and golf", () => {
    const eventType = byKey(fields, "event_type");
    expect(eventType).toMatchObject({ type: "radio", layout: "cards", required: true, role: "event_type" });
    expect(labels(eventType)).toEqual([
      "Corporate Event",
      "Wedding",
      "Social Celebration",
      "Golf Experience",
      "Incentive Trip",
      "Team Building",
      "Game Show",
      "Tradeshow",
      "Virtual or Hybrid",
      "Other",
    ]);
    expect(eventType.choices?.find((c) => c.isOther)?.label).toBe("Other");

    const wedding = byKey(fields, "wedding_planning_level");
    expect(wedding.showIf).toEqual({ fieldKey: "event_type", op: "equals", values: ["wedding"] });
    expect(labels(wedding)).toEqual([
      "Wedding Management (The Peace of Mind)",
      "Partial Planning (The Styled & Supported)",
      "Full-Service Planning (The Signature Soiree)",
      "Not sure yet",
    ]);

    const golf = byKey(fields, "golf_experience");
    expect(golf.showIf).toEqual({ fieldKey: "event_type", op: "equals", values: ["golf_experience"] });
    expect(labels(golf)).toEqual(["Tournament", "Corporate golf outing", "Golf trip or itinerary", "Putting party", "Other"]);
    expect(golf.choices?.some((c) => c.isOther)).toBe(false);
  });

  it("asks when and where with the area as a required choice", () => {
    const date = byKey(fields, "event_date");
    expect(date).toMatchObject({ type: "date", role: "event_date", required: false, width: "half" });
    expect(date.help).toBe("Not sure yet? Pick your best guess.");
    const area = byKey(fields, "event_location");
    expect(area).toMatchObject({ type: "select", role: "event_location", required: true });
    expect(labels(area)).toEqual([
      "Ponte Vedra",
      "Jacksonville",
      "St. Augustine",
      "Amelia Island",
      "Northeast Florida",
      "Central Florida or Orlando",
      "Tampa",
      "Southeast Georgia",
      "Somewhere else",
      "Not sure yet",
    ]);
    expect(byKey(fields, "venue")).toMatchObject({ type: "text", width: "half", required: false, role: null });
    const guests = byKey(fields, "guest_count");
    expect(guests).toMatchObject({ type: "select", role: "guest_count", required: true, width: "half" });
    expect(labels(guests)).toEqual(["Under 50", "50 - 150", "150 - 300", "300 - 500", "500 - 1,000", "1,000+"]);
  });

  it("lists the website's 15 services as chips and label-only budget tiers, all acceptable", () => {
    const services = byKey(fields, "services");
    expect(services).toMatchObject({ type: "checkbox", layout: "chips", role: "services" });
    expect(services.choices).toHaveLength(15);
    expect(labels(services)[0]).toBe("Audio & Visuals");
    expect(labels(services)).toContain("F&B Catering");
    const budget = byKey(fields, "budget").budget;
    expect(budget?.mode).toBe("tiers");
    expect(budget?.policy).toBe("label");
    expect(budget?.allowSkip).toBe(true);
    expect(budget?.tiers?.map((t) => [t.label, t.min, t.acceptable])).toEqual([
      ["Under $10,000", null, true],
      ["$10,000 - $25,000", 10000, true],
      ["$25,000 - $50,000", 25000, true],
      ["$50,000 - $100,000", 50000, true],
      ["$100,000+", 100000, true],
    ]);
  });

  it("asks for at least 25 characters about the event", () => {
    const notes = byKey(fields, "notes");
    expect(notes).toMatchObject({ type: "textarea", role: "notes", required: true, minLength: 25 });
    expect(notes.placeholder).toBe("Goals, schedule, anything you already have in place...");
    expect(byKey(fields, "contact_preference").required).toBe(false);
  });

  it("carries the spec copy, no celebration and the bronze accent", () => {
    expect(form.settings.submitLabel).toBe("Get a Quote");
    expect(form.settings.thankYou).toEqual({
      title: "Thank you!",
      message: "We received your inquiry and will be in touch soon to plan the details.",
    });
    expect(form.settings.qualify.celebrate).toBe(false);
    expect(form.settings.onDateUnavailable.actions).toEqual(["change_date", "continue"]);
    expect(form.settings.onDateUnavailable.message).toBe(DEFAULT_FORM_SETTINGS.onDateUnavailable.message);
    // The brand bronze, one AA-safe step darker (exactly what the editor's "use a darker shade" gives).
    expect(form.settings.accentColor).toBe(VIDENT_BRONZE_AA);
    expect(darkenForWhiteText(VIDENT_BRONZE)).toBe(VIDENT_BRONZE_AA);
  });
});

describe("V2 Request AV", () => {
  const form = STARTER_FORMS[1];
  const fields = allFields(form.definition);

  it("follows the spec steps with a date-only check", () => {
    expect(form.definition.steps.map((s) => [s.title, s.kind])).toEqual([
      ["Let's connect", "fields"],
      ["Your event", "fields"],
      ["Checking our calendar", "qualify"],
      ["What you need", "fields"],
      ["Last step", "fields"],
    ]);
    expect(form.definition.steps[2].checks).toEqual(["date"]);
    expect(form.definition.steps[0].fields.map((f) => f.key)).toEqual(["full_name", "phone", "email", "company"]);
  });

  it("asks the venue portal event types, a required date, times, venue and attendees", () => {
    const eventType = byKey(fields, "event_type");
    expect(eventType).toMatchObject({ type: "select", required: true, role: "event_type" });
    expect(labels(eventType)).toEqual([
      "Conference",
      "Corporate Meeting",
      "Wedding",
      "Gala",
      "Trade Show",
      "Concert",
      "Private Event",
      "Other",
    ]);
    expect(eventType.choices?.find((c) => c.isOther)?.label).toBe("Other");
    expect(byKey(fields, "event_date")).toMatchObject({ role: "event_date", required: true, width: "half" });
    expect(byKey(fields, "event_time")).toMatchObject({ type: "time", role: "event_time", showEndTime: true, width: "half" });
    expect(byKey(fields, "event_location")).toMatchObject({ type: "text", role: "event_location", required: true });
    expect(byKey(fields, "guest_count")).toMatchObject({ type: "number", role: "guest_count", width: "half" });
  });

  it("asks which AV services, the service level and the request (25 characters, like the website)", () => {
    const services = byKey(fields, "services");
    expect(services).toMatchObject({ type: "checkbox", layout: "chips", required: true, role: "services" });
    expect(labels(services)).toEqual([
      "Audio and Sound",
      "Lighting Design",
      "Video",
      "LED Walls and Projection",
      "Staging",
      "Live Stream or Broadcast",
      "Video Production",
      "Technicians",
      "Entertainment",
    ]);
    const level = byKey(fields, "service_level");
    expect(level).toMatchObject({ type: "radio", layout: "cards", required: true });
    expect(labels(level)).toEqual(["Rental only (pickup or delivery)", "Rental with technician", "Full production"]);
    const notes = byKey(fields, "notes");
    expect(notes).toMatchObject({ role: "notes", required: true, minLength: 25 });
    expect(notes.placeholder).toBe("Tell us about your event: date, venue, and what you need.");
    expect(form.definition.steps[4].fields.map((f) => f.key)).toEqual(["contact_preference"]);
  });

  it("carries the spec copy and the AV red accent", () => {
    expect(form.settings.submitLabel).toBe("Send Request");
    expect(form.settings.thankYou).toEqual({
      title: "Request received!",
      message: "Thank you for reaching out to LRE Audiovisual. We'll be in touch soon.",
    });
    expect(form.settings.accentColor).toBe("#c00000");
  });
});

describe("brands", () => {
  it("lists both brands with their sites, contacts and live privacy pages", () => {
    expect(BRANDS.map((b) => b.key)).toEqual(["vident-productions", "vident-av"]);
    expect(DEFAULT_BRAND_KEY).toBe("vident-productions");
    expect(BRANDS[0]).toEqual({
      key: "vident-productions",
      name: "LRE Productions",
      logoUrl: "/logo.png",
      logoOnDark: true,
      siteUrl: "https://lreproductions.com",
      privacyUrl: "https://lreproductions.com/privacy-policy",
      phone: "904-834-1216",
      email: "hello@lreproductions.com",
      accentColor: "#9a7340",
      legalLine: "LRE Productions, Inc.",
    });
    expect(BRANDS[1]).toMatchObject({
      name: "LRE Audiovisual",
      logoUrl: null,
      logoOnDark: false,
      siteUrl: "https://videntaudiovisual.com",
      privacyUrl: "https://videntaudiovisual.com/privacy-policy",
      phone: "904-834-1216",
      email: "hello@videntaudiovisual.com",
      accentColor: "#c00000",
    });
  });
});

describe("LRE business defaults", () => {
  it("layer onto the generic defaults as spec section 4 says (open dates, no location check)", () => {
    const merged = mergeBusinessSettings(layerSettings(DEFAULT_BUSINESS_SETTINGS, HUB_BUSINESS_DEFAULTS));
    expect(merged.homeBase).toEqual({
      label: "LRE Productions, Ponte Vedra",
      address: "101 Marketside Avenue, Ponte Vedra, FL 32081",
      lat: 30.24,
      lng: -81.3853,
    });
    expect(merged.location.enabled).toBe(false);
    expect(merged.availability.mode).toBe("open");
    expect(merged.availability.capacity).toEqual({ source: "none", departments: [], fixed: null });
    expect(merged.availability.blackouts).toEqual([]);
    expect(merged.availability.minNoticeDays).toBeNull();
    expect(merged.timezone).toBe("America/New_York");
  });

  it("let the saved settings win", () => {
    const saved = { availability: { blackouts: [{ start: "2026-12-25", end: "2026-12-25" }], minNoticeDays: 14 } };
    const merged = mergeBusinessSettings(layerSettings(layerSettings(DEFAULT_BUSINESS_SETTINGS, HUB_BUSINESS_DEFAULTS), saved));
    expect(merged.availability.blackouts).toEqual([{ start: "2026-12-25", end: "2026-12-25" }]);
    expect(merged.availability.minNoticeDays).toBe(14);
    expect(merged.availability.mode).toBe("open");
    expect(merged.location.enabled).toBe(false);
  });
});
