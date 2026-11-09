import { describe, expect, it } from "vitest";
import type { BrandProfile, FormSettings } from "../types";
import { emptyDefinition } from "../definition";
import { draftPreviewState, layerSettings, projectPublicSettings, resolveBrand } from "./bundle-core";

const settings: FormSettings = {
  brand: "vident",
  accentColor: "#ae4213",
  submitLabel: "Send my request",
  thankYou: { title: "You're all set!", message: "Thanks." },
  waitlistThankYou: { title: "You're on the list", message: "We'll reach out." },
  redirectUrl: null,
  qualify: {
    celebrate: true,
    popupTitle: "YOUR SEARCH IS OVER!",
    popupSubtitle: "WE ARE AVAILABLE",
    timings: { messageIntervalMs: 3000, minCheckMs: 4000, preCelebrationMs: 2000, popupMs: 5500 },
    urgency: null,
    dateLoadingMessages: ["a"],
    locationLoadingMessages: ["b"],
  },
  onDateUnavailable: { actions: ["change_date", "continue"], message: "Busy" },
  onLocationFail: { action: "continue", message: "Far" },
  referral: null,
  confirmationEmail: { enabled: true, subject: "S", intro: "I" },
  notify: { recipients: ["owner@example.com"], inApp: true },
  hostEvent: true,
  progressHype: null,
  ownerByEventType: { wedding: "router@example.com" },
  copies: {
    ghl: {
      enabled: true,
      locationId: "loc-secretish",
      trackingId: "tk_secretish",
      formId: "Contact Form",
      siteUrl: "https://example.com/",
      notesKey: "contact.event_details",
      notesLabel: "Event Details",
      eventTypeKey: null,
      servicesKey: null,
    },
  },
};

const brand = (key: string): BrandProfile => ({
  key,
  name: key,
  logoUrl: null,
  logoOnDark: false,
  siteUrl: null,
  privacyUrl: null,
  phone: null,
  email: null,
  accentColor: "#000000",
  legalLine: null,
});

describe("projectPublicSettings", () => {
  it("drops notify recipients and the confirmation email setup", () => {
    const pub = projectPublicSettings(settings);
    expect(pub).not.toHaveProperty("notify");
    expect(pub).not.toHaveProperty("confirmationEmail");
    expect(JSON.stringify(pub)).not.toContain("owner@example.com");
    expect(pub.thankYou.title).toBe("You're all set!");
  });
  it("drops the owner routing and the copy settings (server-only)", () => {
    const pub = projectPublicSettings(settings);
    expect(pub).not.toHaveProperty("ownerByEventType");
    expect(pub).not.toHaveProperty("copies");
    const json = JSON.stringify(pub);
    for (const leak of ["router@example.com", "9999", "loc-secretish", "tk_secretish"]) expect(json).not.toContain(leak);
    expect(pub.qualify.popupTitle).toBe("YOUR SEARCH IS OVER!");
  });
});

describe("resolveBrand", () => {
  const brands = [brand("vident"), brand("partner-brand")];

  it("finds by key, then the default, then the first", () => {
    expect(resolveBrand(brands, "partner-brand", "vident").key).toBe("partner-brand");
    expect(resolveBrand(brands, "nope", "vident").key).toBe("vident");
    expect(resolveBrand(brands, "", "missing").key).toBe("vident");
    expect(resolveBrand([], "x", "fallback").key).toBe("fallback");
  });
});

describe("layerSettings", () => {
  it("merges nested objects and replaces arrays", () => {
    const base = { a: 1, nested: { x: 1, y: 2 }, list: [1, 2, 3] };
    const out = layerSettings(base, { nested: { y: 5 }, list: [9] }) as typeof base;
    expect(out).toEqual({ a: 1, nested: { x: 1, y: 5 }, list: [9] });
    expect(base.nested.y).toBe(2);
  });

  it("keeps the base for undefined and never copies prototype keys", () => {
    const out = layerSettings({ a: 1 }, { a: undefined }) as Record<string, unknown>;
    expect(out.a).toBe(1);
    const polluted = layerSettings({ a: 1 }, JSON.parse('{"__proto__": {"polluted": true}}')) as Record<string, unknown>;
    expect(polluted.polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("deep-copies nested override objects instead of sharing them", () => {
    const override = { nested: { x: 1 } };
    const out = layerSettings({}, override) as { nested: { x: number } };
    out.nested.x = 2;
    expect(override.nested.x).toBe(1);
  });
});

describe("draftPreviewState (?preview=draft)", () => {
  it("renders a draft that passes validateDefinition, with settings merged onto the defaults", () => {
    const state = draftPreviewState(emptyDefinition(), { submitLabel: "Get a Quote", bogus: true });
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    expect(state.definition.steps).toHaveLength(1);
    expect(state.settings.submitLabel).toBe("Get a Quote");
    expect(state.settings).not.toHaveProperty("bogus");
  });

  it("lists the problems of a draft saved with issues instead of rendering it", () => {
    const def = emptyDefinition();
    def.steps.push({ id: "s-new", kind: "fields", title: "New step", fields: [] });
    const state = draftPreviewState(def, {});
    expect(state).toEqual({ ok: false, issues: ["Step 2 'New step' has no fields. Add a field or delete the step."] });
  });

  it("never blocks a preview on settings: broken settings fall back to the defaults", () => {
    const state = draftPreviewState(emptyDefinition(), { accentColor: "not a color", thankYou: { title: "" } });
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    expect(state.settings.accentColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(state.settings.thankYou.title.length).toBeGreaterThan(0);
  });
});
