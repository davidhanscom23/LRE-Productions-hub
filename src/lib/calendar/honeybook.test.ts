import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/lib/calendar/events";
import {
  enrichHoneybookIcalEventFromCrm,
  honeybookNameOverlapScore,
  mergeHoneybookIcalWithCrm,
  scoreHoneybookIcalCrmMatch,
  type HoneyBookCalendarRow,
} from "./honeybook";

function icalEvent(
  overrides: Partial<CalendarEvent> & Pick<CalendarEvent, "title" | "start">,
): CalendarEvent {
  return {
    uid: "honeybook-ics-1",
    source: "honeybook",
    end: null,
    allDay: false,
    status: "CONFIRMED",
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
    eventUrl: "https://calendar.google.com/event?eid=abc",
    descriptionStartTime: null,
    descriptionEndTime: null,
    ...overrides,
  };
}

function crmRow(
  overrides: Partial<HoneyBookCalendarRow> &
    Pick<HoneyBookCalendarRow, "id" | "name" | "project_date">,
): HoneyBookCalendarRow {
  return {
    stage: "Booked",
    project_type: "Wedding",
    location: "Main Hall",
    client_id: "c1",
    client_name: "Alex Rivera",
    client_email: "alex@example.com",
    client_phone: "555-0100",
    ...overrides,
  };
}

describe("honeybookNameOverlapScore", () => {
  it("scores exact and contained names highly", () => {
    expect(honeybookNameOverlapScore("Wheels & Worship 3", "Wheels & Worship 3")).toBe(1);
    expect(
      honeybookNameOverlapScore(
        "Alex Rivera · Wheels & Worship 3",
        "Wheels & Worship 3",
      ),
    ).toBeGreaterThanOrEqual(0.72);
  });
});

describe("scoreHoneybookIcalCrmMatch", () => {
  it("requires the same calendar day", () => {
    const event = icalEvent({
      title: "Wheels & Worship 3",
      start: "2026-09-12T16:00:00.000Z",
    });
    const row = crmRow({
      id: "p1",
      name: "Wheels & Worship 3",
      project_date: "2026-09-13",
    });
    expect(scoreHoneybookIcalCrmMatch(event, row)).toBe(0);
  });

  it("matches same-day project names", () => {
    const event = icalEvent({
      title: "Wheels & Worship 3",
      start: "2026-09-12T16:00:00.000Z",
    });
    const row = crmRow({
      id: "p1",
      name: "Wheels & Worship 3",
      project_date: "2026-09-12",
    });
    expect(scoreHoneybookIcalCrmMatch(event, row)).toBeGreaterThanOrEqual(0.9);
  });
});

describe("enrichHoneybookIcalEventFromCrm", () => {
  it("uses CRM stage as status, keeps iCal timing and URL", () => {
    const event = icalEvent({
      title: "Wheels & Worship 3",
      start: "2026-09-12T16:00:00.000Z",
      end: "2026-09-12T20:00:00.000Z",
      status: "CONFIRMED",
      venue: "Google Venue",
    });
    const row = crmRow({
      id: "p1",
      name: "Wheels & Worship 3",
      project_date: "2026-09-12",
      stage: "In Progress",
    });
    const enriched = enrichHoneybookIcalEventFromCrm(event, row);
    expect(enriched.status).toBe("In Progress");
    expect(enriched.start).toBe(event.start);
    expect(enriched.end).toBe(event.end);
    expect(enriched.eventUrl).toBe(event.eventUrl);
    expect(enriched.clientName).toBe("Alex Rivera");
    expect(enriched.clientEmail).toBe("alex@example.com");
    expect(enriched.clientPhone).toBe("555-0100");
    expect(enriched.eventType).toBe("Wedding");
    expect(enriched.venue).toBe("Google Venue");
  });
});

describe("mergeHoneybookIcalWithCrm", () => {
  it("enriches matched iCal events and appends unmatched CRM projects", () => {
    const ical = [
      icalEvent({
        uid: "honeybook-a",
        title: "Wheels & Worship 3",
        start: "2026-09-12T16:00:00.000Z",
        status: "CONFIRMED",
      }),
    ];
    const crm = [
      crmRow({
        id: "p1",
        name: "Wheels & Worship 3",
        project_date: "2026-09-12",
        stage: "Booked",
      }),
      crmRow({
        id: "p2",
        name: "Only In CRM",
        project_date: "2026-10-01",
        stage: "Proposal Sent",
        client_name: "Pat Lee",
      }),
    ];

    const { events, matchedCrmIds } = mergeHoneybookIcalWithCrm(ical, crm);
    expect(matchedCrmIds).toEqual(["p1"]);
    expect(events).toHaveLength(2);

    const merged = events.find((e) => e.uid === "honeybook-a");
    expect(merged?.status).toBe("Booked");
    expect(merged?.clientName).toBe("Alex Rivera");
    expect(merged?.start).toBe("2026-09-12T16:00:00.000Z");
    expect(merged?.allDay).toBe(false);

    const overlay = events.find((e) => e.uid === "honeybook-p2");
    expect(overlay?.status).toBe("Proposal Sent");
  });

  it("does not double-count a CRM row across two iCal events", () => {
    const ical = [
      icalEvent({
        uid: "honeybook-a",
        title: "Shared Name",
        start: "2026-09-12T14:00:00.000Z",
      }),
      icalEvent({
        uid: "honeybook-b",
        title: "Shared Name",
        start: "2026-09-12T18:00:00.000Z",
      }),
    ];
    const crm = [
      crmRow({
        id: "p1",
        name: "Shared Name",
        project_date: "2026-09-12",
        stage: "Booked",
      }),
    ];
    const { events, matchedCrmIds } = mergeHoneybookIcalWithCrm(ical, crm);
    expect(matchedCrmIds).toEqual(["p1"]);
    expect(events.filter((e) => e.status === "Booked")).toHaveLength(1);
    expect(events.filter((e) => e.status === "CONFIRMED")).toHaveLength(1);
  });
});
