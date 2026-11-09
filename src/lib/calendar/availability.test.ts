import { describe, expect, it } from "vitest";
import {
  DEFAULT_AVAILABLE_DAYS,
  normalizeAvailableDays,
} from "./availability";
import { applyHubAssignments } from "./assignments";
import type { CalendarEvent } from "./events";

function baseEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    uid: "honeybook-1",
    source: "honeybook",
    title: "Test Event",
    start: "2026-08-12T16:00:00.000Z",
    end: null,
    allDay: false,
    status: "Booked",
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
    ...overrides,
  };
}

describe("normalizeAvailableDays", () => {
  it("defaults empty to all weekdays", () => {
    expect(normalizeAvailableDays([])).toEqual([...DEFAULT_AVAILABLE_DAYS]);
    expect(normalizeAvailableDays(null)).toEqual([...DEFAULT_AVAILABLE_DAYS]);
  });

  it("keeps explicit days", () => {
    expect(normalizeAvailableDays(["mon", "wed"])).toEqual(["mon", "wed"]);
  });
});

describe("applyHubAssignments", () => {
  it("merges Hub assignee names into assignedStaff", () => {
    const names = new Map([
      ["p1", "David Hanscom"],
      ["p2", "Alex Rivera"],
    ]);
    const enriched = applyHubAssignments(baseEvent(), ["p1", "p2"], names);
    expect(enriched.assignedStaff).toContain("David Hanscom");
    expect(enriched.assignedStaff).toContain("Alex Rivera");
    expect(enriched.assignedProfileIds).toEqual(["p1", "p2"]);
  });
});
