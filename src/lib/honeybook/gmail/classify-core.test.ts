import { describe, expect, it } from "vitest";

import { buildPrompt, parseClassification } from "@/lib/honeybook/gmail/classify-core";
import type { ParsedMessage } from "@/lib/honeybook/gmail/parse";

const message: ParsedMessage = {
  gmailId: "g1",
  threadId: "t1",
  messageKey: "rfc:abc",
  mailbox: "hello@lreproductions.com",
  from: "jane@example.com",
  to: ["hello@lreproductions.com"],
  cc: [],
  subject: "Wedding in June",
  internalMs: Date.UTC(2026, 10, 6, 15, 0, 0),
  direction: "inbound",
  body: "Hi! We are planning a wedding for 120 guests on 2027-06-12.",
  headers: {},
};

describe("parseClassification", () => {
  it("parses a clean inquiry", () => {
    const out = parseClassification(
      JSON.stringify({
        is_event_inquiry: true,
        confidence: 0.92,
        client: { name: "Jane Doe", email: "JANE@example.com", phone: "555-1234" },
        event: { type: "Wedding", date: "2027-06-12", location: "Ponte Vedra", guest_count: "120", budget: "$8,000" },
        note: "Jane is asking about wedding AV for 120 guests.",
        changes: ["Guest count 120"],
        needs_action: true,
        action: "Reply with package options.",
      }),
    );
    expect(out).not.toBeNull();
    expect(out?.isEventInquiry).toBe(true);
    expect(out?.client.email).toBe("jane@example.com");
    expect(out?.event.guestCount).toBe(120);
    expect(out?.event.budget).toBe(8000);
    expect(out?.action).toBe("Reply with package options.");
  });

  it("strips markdown fences and clamps confidence", () => {
    const out = parseClassification('```json\n{"is_event_inquiry":false,"confidence":4}\n```');
    expect(out?.confidence).toBe(1);
    expect(out?.isEventInquiry).toBe(false);
  });

  it("rejects bad dates and drops action text when no action is needed", () => {
    const out = parseClassification(
      JSON.stringify({ event: { date: "June 12" }, needs_action: false, action: "ignore me" }),
    );
    expect(out?.event.date).toBeNull();
    expect(out?.action).toBe("");
  });

  it("returns null for garbage", () => {
    expect(parseClassification("not json")).toBeNull();
  });
});

describe("buildPrompt", () => {
  it("asks for an inquiry decision when no project is linked", () => {
    const p = buildPrompt({ message, staffName: "Kallie Sango", project: null });
    expect(p).toContain("NOT yet linked");
    expect(p).toContain("received BY the staff member");
    expect(p).toContain("Wedding in June");
  });

  it("includes project context and recent notes for an existing project", () => {
    const p = buildPrompt({
      message: { ...message, direction: "outbound" },
      staffName: "Kallie Sango",
      project: {
        name: "Wedding – Jane Doe",
        stage: "Proposal Sent",
        projectDate: "2027-06-12",
        location: "Ponte Vedra",
        recentNotes: ["Sent proposal on Nov 3."],
        openActions: ["Send the revised quote."],
      },
    });
    expect(p).toContain("EXISTING project");
    expect(p).toContain("Proposal Sent");
    expect(p).toContain("Sent proposal on Nov 3.");
    expect(p).toContain("sent BY the staff member");
    expect(p).toContain("ALREADY open");
    expect(p).toContain("Send the revised quote.");
  });

  it("tells the model vendors and partnership requests are not inquiries", () => {
    const p = buildPrompt({ message, staffName: "Kallie Sango", project: null });
    expect(p).toContain("HIRE LRE");
    expect(p).toContain("NOT inquiries");
    expect(p).not.toContain("previously marked");
  });

  it("shows past not-a-lead examples when there are any", () => {
    const p = buildPrompt({
      message,
      staffName: "Kallie Sango",
      project: null,
      notLeadExamples: ["A mobile gaming vendor asking to join our events."],
    });
    expect(p).toContain("previously marked");
    expect(p).toContain("mobile gaming vendor");
  });

  it("warns the model when mail comes through a lead marketplace", () => {
    const p = buildPrompt({
      message: { ...message, from: "yourfriends@gigsalad.com" },
      staffName: "Kallie Sango",
      project: null,
    });
    expect(p).toContain("lead marketplace");
    const plain = buildPrompt({ message, staffName: "Kallie Sango", project: null });
    expect(plain).not.toContain("lead marketplace");
  });
});
