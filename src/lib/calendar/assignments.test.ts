import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/lib/calendar/events";
import {
  applyHubAssignmentsToEvents,
  mergeBoardAssignees,
} from "./assignments";

function ev(uid: string, crmProjectId?: string): CalendarEvent {
  return {
    uid,
    source: "pipeline",
    title: uid,
    start: "2026-12-01T12:00:00Z",
    end: "2026-12-01T12:00:00Z",
    allDay: true,
    status: "Retainer Paid",
    eventType: null,
    assignedStaff: null,
    venue: null,
    clientName: null,
    organization: null,
    clientContact: null,
    clientPhone: null,
    clientEmail: null,
    relatedFiles: [],
    planningFormUrl: null,
    eventUrl: null,
    descriptionStartTime: null,
    descriptionEndTime: null,
    crmProjectId,
  };
}

describe("mergeBoardAssignees", () => {
  it("adds board staff to events backed by a CRM card", () => {
    const events = [ev("a", "p1"), ev("b")];
    const merged = mergeBoardAssignees(
      events,
      [{ project_id: "p1", profile_id: "u1" }],
      new Map(),
    );
    expect(merged.get("a")).toEqual(["u1"]);
    expect(merged.has("b")).toBe(false);
  });

  it("unions with calendar-only assignments without duplicates", () => {
    const merged = mergeBoardAssignees(
      [ev("a", "p1")],
      [
        { project_id: "p1", profile_id: "u1" },
        { project_id: "p1", profile_id: "u2" },
      ],
      new Map([["a", ["u2", "u3"]]]),
    );
    expect(merged.get("a")?.sort()).toEqual(["u1", "u2", "u3"]);
  });

  it("shows board staff names on the event", () => {
    const events = [ev("a", "p1")];
    const byUid = mergeBoardAssignees(
      events,
      [{ project_id: "p1", profile_id: "u1" }],
      new Map(),
    );
    const [out] = applyHubAssignmentsToEvents(
      events,
      byUid,
      new Map([["u1", "Jordan Lee"]]),
    );
    expect(out.assignedStaff).toBe("Jordan Lee");
    expect(out.assignedProfileIds).toEqual(["u1"]);
  });
});
