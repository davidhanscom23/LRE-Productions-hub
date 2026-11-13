import { describe, expect, it } from "vitest";
import { DEFAULT_FORM_SETTINGS, mergeFormSettings } from "./defaults";

describe("form settings: owners by event type", () => {
  it("defaults to no routing", () => {
    expect(DEFAULT_FORM_SETTINGS.ownerByEventType).toEqual({});
    expect(mergeFormSettings({}).ownerByEventType).toEqual({});
  });
  it("keeps valid emails (lowercased) and drops junk and prototype keys", () => {
    const merged = mergeFormSettings({
      ownerByEventType: { wedding: " Wedding@LREProductions.com ", golf: "not-an-email", corp: 42, __proto__: "x@y.com", constructor: "a@b.com" },
    });
    expect(merged.ownerByEventType).toEqual({ wedding: "wedding@lreproductions.com" });
  });
});

describe("form settings: copies", () => {
  it("defaults to no copies", () => {
    expect(mergeFormSettings({}).copies).toEqual({ ghl: null });
  });
  it("ignores a stray planner copy left in older saved settings", () => {
    const merged = mergeFormSettings({ copies: { legacy: { enabled: true } } });
    expect(merged.copies).toEqual({ ghl: null });
  });
  it("a GoHighLevel copy needs its location, tracking id and form name to stay on; keys get defaults", () => {
    const on = mergeFormSettings({ copies: { ghl: { enabled: true, locationId: "L1", trackingId: "tk_1", formId: "Contact Form", siteUrl: "javascript:alert(1)" } } }).copies.ghl;
    expect(on).toEqual({
      enabled: true,
      locationId: "L1",
      trackingId: "tk_1",
      formId: "Contact Form",
      siteUrl: "",
      notesKey: "contact.event_details",
      notesLabel: "Event Details",
      eventTypeKey: null,
      servicesKey: null,
    });
    expect(mergeFormSettings({ copies: { ghl: { enabled: true, locationId: "L1", formId: "F" } } }).copies.ghl?.enabled).toBe(false);
  });
  it("round-trips (merge of a merge changes nothing)", () => {
    const once = mergeFormSettings({
      ownerByEventType: { wedding: "k@example.com" },
      copies: { ghl: { enabled: false, locationId: "L", trackingId: "T", formId: "F", siteUrl: "https://x.com/" } },
    });
    expect(mergeFormSettings(once)).toEqual(once);
  });
});
