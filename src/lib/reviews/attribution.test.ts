import { describe, expect, it } from "vitest";
import {
  attributeReviewToProfiles,
  buildPacketAssigneesByEventId,
  countReviewsForStaff,
} from "./attribution";
import type { EventExternalReview } from "@/lib/types/event-reviews";

const profiles = [
  {
    id: "a",
    full_name: "Alex Rivera",
    email: "alex@example.com",
    is_active: true,
  },
  {
    id: "b",
    full_name: "Jordan Lee",
    email: "jordan@example.com",
    is_active: true,
  },
];

function review(
  partial: Partial<EventExternalReview> & { id: string },
): EventExternalReview {
  return {
    sheet_fingerprint: partial.id,
    sheet_row: 1,
    event_id: null,
    calendar_uid: null,
    reviewer_name: "Client",
    comment: "Great night",
    rating: 5,
    review_date: "2026-01-01",
    event_type: "Wedding",
    services: "Audiovisual",
    staff_members: "",
    show_on_site: true,
    needs_review: false,
    source: "google_sheet",
    matched_packet_count: 0,
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

describe("attributeReviewToProfiles", () => {
  it("matches sheet staff names", () => {
    const credited = attributeReviewToProfiles(
      review({ id: "1", staff_members: "Alex Rivera & Guest MC" }),
      profiles,
      new Map(),
    );
    expect(credited.map((p) => p.id)).toEqual(["a"]);
  });

  it("credits packet assignees by Event ID", () => {
    const byEvent = buildPacketAssigneesByEventId([
      { calendar_uid: "EVENTID:42", assignee_id: "b" },
    ]);
    const credited = attributeReviewToProfiles(
      review({
        id: "2",
        event_id: "42",
        calendar_uid: "EVENTID:42",
      }),
      profiles,
      byEvent,
    );
    expect(credited.map((p) => p.id)).toEqual(["b"]);
  });

  it("unions sheet names and packet assignees", () => {
    const byEvent = buildPacketAssigneesByEventId([
      { calendar_uid: "EVENTID:9", assignee_id: "b" },
    ]);
    const credited = attributeReviewToProfiles(
      review({
        id: "3",
        event_id: "9",
        calendar_uid: "EVENTID:9",
        staff_members: "Alex",
      }),
      profiles,
      byEvent,
    );
    expect(credited.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("counts reviews per staff", () => {
    const byEvent = new Map<string, string[]>();
    const reviews = [
      review({ id: "1", staff_members: "Alex Rivera" }),
      review({ id: "2", staff_members: "Jordan Lee" }),
      review({ id: "3", staff_members: "Alex Rivera, Jordan Lee" }),
    ];
    expect(countReviewsForStaff(reviews, "a", profiles, byEvent)).toBe(2);
    expect(countReviewsForStaff(reviews, "b", profiles, byEvent)).toBe(2);
  });
});
