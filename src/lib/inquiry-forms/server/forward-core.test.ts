import { describe, expect, it } from "vitest";
import type { CrmSummary, FormDefinition, GhlCopySettings } from "../types";
import {
  buildGhlPayload,
  ownerFor,
  readGhlResult,
  splitName,
  staffRecipients,
} from "./forward-core";

function summary(over: Partial<CrmSummary> = {}): CrmSummary {
  return {
    name: "Ann Lee Smith",
    email: "ann@example.com",
    phone: "(904) 555-0100",
    company: null,
    eventType: "Wedding",
    eventDate: "2027-11-07",
    eventTimeStart: "19:30",
    eventTimeEnd: "23:00",
    eventLocation: "Casa Monica, St. Augustine",
    guestCount: 120,
    guestLabel: null,
    services: ["DJ / MC", "Lighting & Uplighting", "Photo Booth", "Silent Disco"],
    budgetLabel: "$1,500 - $2,500",
    budgetLow: 1500,
    referral: "Google",
    contactPreference: null,
    notes: null,
    scoreLabel: "high",
    ending: "completed",
    ...over,
  };
}

const definition: FormDefinition = {
  version: 1,
  steps: [
    {
      id: "s1",
      kind: "fields",
      title: "Event",
      fields: [
        {
          id: "f-type",
          key: "event_type",
          type: "radio",
          role: "event_type",
          label: "Event type",
          required: true,
          width: "full",
          choices: [
            { value: "corporate-event", label: "Corporate Event" },
            { value: "wedding", label: "Wedding" },
            { value: "other", label: "Other", isOther: true },
          ],
        },
      ],
    },
  ],
};

describe("ownerFor", () => {
  const settings = { ownerByEventType: { "corporate-event": "Natalie@VidentProductions.com", wedding: "kallie@videntproductions.com" } };
  it("routes the chosen event type to its owner, lowercased", () => {
    expect(ownerFor(settings, definition, { event_type: "corporate-event" })).toBe("natalie@videntproductions.com");
    expect(ownerFor(settings, definition, { event_type: "wedding" })).toBe("kallie@videntproductions.com");
  });
  it("leaves unmapped types, no answer and an empty map with the admins (null)", () => {
    expect(ownerFor(settings, definition, { event_type: "other" })).toBeNull();
    expect(ownerFor(settings, definition, {})).toBeNull();
    expect(ownerFor({ ownerByEventType: {} }, definition, { event_type: "wedding" })).toBeNull();
  });
  it("ignores a stored owner that is not an email", () => {
    expect(ownerFor({ ownerByEventType: { wedding: "not an email" } }, definition, { event_type: "wedding" })).toBeNull();
  });
  it("never resolves prototype keys", () => {
    expect(ownerFor(settings, definition, { event_type: "constructor" })).toBeNull();
  });
});

describe("staffRecipients", () => {
  it("adds the routed owner once and keeps the form's recipients first", () => {
    expect(staffRecipients(["hello@videntproductions.com", "david@videntproductions.com"], "natalie@videntproductions.com")).toEqual([
      "hello@videntproductions.com",
      "david@videntproductions.com",
      "natalie@videntproductions.com",
    ]);
    expect(staffRecipients(["david@videntproductions.com"], "David@VidentProductions.com")).toEqual(["david@videntproductions.com"]);
    expect(staffRecipients([], null)).toEqual([]);
  });
});

describe("helpers", () => {
  it("splitName keeps the first word as the first name", () => {
    expect(splitName("Ann Lee Smith")).toEqual({ first: "Ann", last: "Lee Smith" });
    expect(splitName("Cher")).toEqual({ first: "Cher", last: "" });
    expect(splitName("  ")).toEqual({ first: "", last: "" });
  });
});

describe("buildGhlPayload", () => {
  const h5: GhlCopySettings = {
    enabled: true,
    locationId: "loc-h5",
    trackingId: "tk_h5",
    formId: "High 5 Contact Form",
    siteUrl: "https://partner-brand.com/",
    notesKey: "contact.event_details",
    notesLabel: "Event Details",
    eventTypeKey: null,
    servicesKey: null,
  };
  const base = {
    formName: "Book Partner Brand",
    hubLink: "https://hub.example.com/leads",
    lines: ["Event type: Holiday Party"],
    sessionId: "00000000-0000-4000-8000-000000000000",
    now: new Date("2026-11-05T12:00:00Z"),
  };

  it("matches the keys partner-brand.com's own form sends", () => {
    const p = buildGhlPayload({ ...base, settings: h5, summary: summary({ company: "Acme" }), pageUrl: null });
    expect(p.type).toBe("external_form_submission");
    expect(p.formId).toBe("High 5 Contact Form");
    expect(p.locationId).toBe("loc-h5");
    expect(p.trackingId).toBe("tk_h5");
    expect(Object.keys(p.formData as object)).toEqual(["first_name", "last_name", "email", "phone", "organization", "contact.event_details"]);
    expect(Object.keys(p.formLabels as object)).toEqual(Object.keys(p.formData as object));
    expect(p.url).toBe("https://partner-brand.com/");
    expect(p.path).toBe("/");
    expect(p.timestamp).toBe(base.now.getTime());
    expect((p.formData as Record<string, string>)["contact.event_details"]).toContain("Event type: Holiday Party");
  });

  it("adds the event type and services fields videntproductions.com sends, and the real page when known", () => {
    const vp: GhlCopySettings = { ...h5, formId: "Contact Form", eventTypeKey: "contact.event_type", servicesKey: "contact.services_needed" };
    const p = buildGhlPayload({
      ...base,
      settings: vp,
      summary: summary({ eventType: "Golf Experience", services: ["Planning", "Venues"] }),
      pageUrl: "https://videntproductions.com/contact?utm_source=google",
    });
    const data = p.formData as Record<string, string>;
    expect(data["contact.event_type"]).toBe("Golf Experience");
    expect(data["contact.services_needed"]).toBe("Planning, Venues");
    expect(p.url).toBe("https://videntproductions.com/contact?utm_source=google");
    expect(p.path).toBe("/contact");
  });

  it("leaves organization out when there is no company", () => {
    const p = buildGhlPayload({ ...base, settings: h5, summary: summary({ company: null }), pageUrl: null });
    expect(Object.keys(p.formData as object)).not.toContain("organization");
  });
});

describe("readGhlResult", () => {
  it('accepts 200 {"status":"ok"} (what GoHighLevel answered on 05-Nov-26)', () => {
    expect(readGhlResult(200, '{"status":"ok"}').ok).toBe(true);
  });
  it("refuses an error status or a non-ok body", () => {
    expect(readGhlResult(400, '{"message":"bad"}').ok).toBe(false);
    expect(readGhlResult(200, '{"status":"error"}').ok).toBe(false);
  });
});
