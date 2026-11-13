import { describe, expect, it } from "vitest";
import { isAutomationDue, type AutomationProject } from "./automations";

const done: AutomationProject = { stage: "Completed", booked_at: null, project_date: "2026-10-01" };

describe("isAutomationDue", () => {
  it("thank you fires 3 days after the event and for a 14 day catch-up window", () => {
    expect(isAutomationDue("thank_you_review", 3, done, "2026-10-03", null)).toBe(false);
    expect(isAutomationDue("thank_you_review", 3, done, "2026-10-04", null)).toBe(true);
    expect(isAutomationDue("thank_you_review", 3, done, "2026-10-18", null)).toBe(true);
    expect(isAutomationDue("thank_you_review", 3, done, "2026-10-19", null)).toBe(false);
  });
  it("never fires for unbooked, lost, partnership, merged or undated projects", () => {
    expect(isAutomationDue("thank_you_review", 3, { ...done, stage: "Lost" }, "2026-10-05", null)).toBe(false);
    expect(isAutomationDue("thank_you_review", 3, { ...done, stage: "Inquiry" }, "2026-10-05", null)).toBe(false);
    expect(isAutomationDue("thank_you_review", 3, { ...done, record_type: "partnership" }, "2026-10-05", null)).toBe(false);
    expect(isAutomationDue("thank_you_review", 3, { ...done, merged_into: "x" }, "2026-10-05", null)).toBe(false);
    expect(isAutomationDue("thank_you_review", 3, { ...done, project_date: null }, "2026-10-05", null)).toBe(false);
  });
  it("90 day check-in", () => {
    expect(isAutomationDue("followup_90day", 90, done, "2026-12-30", null)).toBe(true);
    expect(isAutomationDue("followup_90day", 90, done, "2026-12-29", null)).toBe(false);
  });
  it("proposal nudge needs the stage and a sent date", () => {
    const sent: AutomationProject = { stage: "_PROPOSAL_SENT_", booked_at: null, project_date: null };
    expect(isAutomationDue("proposal_nudge", 5, sent, "2026-11-06", "2026-11-01T10:00:00Z")).toBe(true);
    expect(isAutomationDue("proposal_nudge", 5, sent, "2026-11-05", "2026-11-01T10:00:00Z")).toBe(false);
    expect(isAutomationDue("proposal_nudge", 5, sent, "2026-11-06", null)).toBe(false);
    expect(isAutomationDue("proposal_nudge", 5, { ...sent, stage: "Contract Sent" }, "2026-11-06", "2026-11-01T00:00:00Z")).toBe(false);
  });
});
