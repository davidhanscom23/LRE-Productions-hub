import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/lib/calendar/events";
import {
  findHuddleCalendarConflicts,
  huddleWindow,
} from "@/lib/huddle/calendar-conflict";

function ev(partial: Partial<CalendarEvent> & { start: string }): CalendarEvent {
  return {
    uid: partial.uid ?? "1",
    source: partial.source ?? "pipeline",
    title: partial.title ?? "Event",
    start: partial.start,
    end: partial.end ?? null,
    allDay: partial.allDay ?? false,
    status: null,
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
  };
}

describe("huddleWindow", () => {
  it("uses a 60-minute default window", () => {
    const { start, end } = huddleWindow("2026-08-20T15:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(60 * 60_000);
  });
});

describe("findHuddleCalendarConflicts", () => {
  it("detects overlapping timed events", () => {
    const conflicts = findHuddleCalendarConflicts("2026-08-20T15:00:00.000Z", [
      ev({
        title: "Smith Wedding",
        start: "2026-08-20T14:30:00.000Z",
        end: "2026-08-20T15:30:00.000Z",
      }),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.title).toBe("Smith Wedding");
  });

  it("ignores non-overlapping events", () => {
    const conflicts = findHuddleCalendarConflicts("2026-08-20T15:00:00.000Z", [
      ev({
        title: "Later",
        start: "2026-08-20T17:00:00.000Z",
        end: "2026-08-20T18:00:00.000Z",
      }),
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it("skips all-day events by default", () => {
    const conflicts = findHuddleCalendarConflicts("2026-08-20T15:00:00.000Z", [
      ev({
        title: "CRM day",
        start: "2026-08-20T12:00:00.000Z",
        end: "2026-08-20T12:00:00.000Z",
        allDay: true,
      }),
    ]);
    expect(conflicts).toHaveLength(0);
  });
});
