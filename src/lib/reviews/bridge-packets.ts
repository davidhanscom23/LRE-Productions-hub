import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { collectAllWorkEvents } from "@/lib/calendar/collect-feeds";
import {
  canonicalCalendarUid,
  extractExternalEventId,
} from "@/lib/calendar/external-event-id";
import type { CalendarEvent } from "@/lib/calendar/events";
import { matchAssignedStaffProfiles } from "@/lib/event-packets/match-staff";
import { createPacketFromCalendarEvent } from "@/lib/event-packets/sync";
import { MANUAL_PACKET_LOOKBACK_DAYS } from "@/lib/event-packets/eligibility";

export type ReviewBridgeRow = {
  eventId: string | null;
  calendarUid: string | null;
  reviewerName: string;
  reviewDate: string | null;
  eventType: string;
  staffMembers: string;
};

export type ReviewBridgeResult = {
  packetsCreated: number;
  calendarFeedsScanned: number;
  calendarEventsLoaded: number;
  calendarEventIdsFound: number;
  reviewIdsOnCalendar: number;
  /** Packets created from review sheet fields when the event wasn't on a feed. */
  packetsFromReviewsOnly: number;
  skippedNoStaff: number;
  skippedNoDate: number;
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function syntheticEventFromReview(row: ReviewBridgeRow): CalendarEvent | null {
  if (!row.eventId || !row.reviewDate) return null;
  const start = `${row.reviewDate}T12:00:00.000Z`;
  return {
    uid: row.calendarUid || canonicalCalendarUid(row.eventId),
    source: "work",
    title: row.reviewerName || "Event",
    start,
    end: null,
    allDay: true,
    status: "Booked",
    eventType: row.eventType || "Other",
    assignedStaff: row.staffMembers || null,
    venue: null,
    clientName: row.reviewerName || null,
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

/**
 * Create Event Packets for website-review Event_IDs.
 *
 * 1) Prefer live shared Pipeline calendar events.
 * 2) Fall back to the review row itself (date + staff names) for Event_IDs
 *    within the last 24 months when the event isn't on the feed.
 * Assignees come from calendar assigned-staff and/or sheet Staff Member(s).
 */
export async function bridgeReviewsToPackets(
  supabase: SupabaseClient,
  rows: ReviewBridgeRow[],
): Promise<ReviewBridgeResult> {
  const empty: ReviewBridgeResult = {
    packetsCreated: 0,
    calendarFeedsScanned: 0,
    calendarEventsLoaded: 0,
    calendarEventIdsFound: 0,
    reviewIdsOnCalendar: 0,
    packetsFromReviewsOnly: 0,
    skippedNoStaff: 0,
    skippedNoDate: 0,
  };

  const withIds = rows.filter((r) => r.eventId);
  if (!withIds.length) return empty;

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("is_active", true);
  const profiles = (profileRows ?? []).map((p) => ({
    id: String(p.id),
    full_name: String(p.full_name ?? ""),
    email: String(p.email ?? ""),
    is_active: Boolean(p.is_active),
  }));

  let collected;
  try {
    collected = await collectAllWorkEvents(supabase);
  } catch (err) {
    console.error(
      "[reviews] calendar bridge fetch failed",
      err instanceof Error ? err.message : err,
    );
    collected = {
      feedsScanned: 0,
      events: [] as CalendarEvent[],
      eventIds: new Set<string>(),
    };
  }

  const eventsById = new Map<string, CalendarEvent>();
  for (const event of collected.events) {
    const id = extractExternalEventId(event.uid);
    if (id) eventsById.set(id, event);
  }

  const minDate = daysAgoIso(MANUAL_PACKET_LOOKBACK_DAYS);
  const today = new Date().toISOString().slice(0, 10);

  let packetsCreated = 0;
  let packetsFromReviewsOnly = 0;
  let reviewIdsOnCalendar = 0;
  let skippedNoStaff = 0;
  let skippedNoDate = 0;
  const seenReviewIds = new Set<string>();

  for (const row of withIds) {
    const eventId = row.eventId!;
    if (seenReviewIds.has(eventId)) continue;
    seenReviewIds.add(eventId);

    const onCalendar = eventsById.get(eventId) ?? null;
    if (onCalendar) reviewIdsOnCalendar += 1;

    let event = onCalendar;
    let fromReviewOnly = false;

    if (!event) {
      // planner feeds are thin on history — synthesize from the review row when
      // the review date falls inside the 24-month packet window.
      if (!row.reviewDate) {
        skippedNoDate += 1;
        continue;
      }
      if (row.reviewDate < minDate || row.reviewDate > today) {
        continue;
      }
      event = syntheticEventFromReview(row);
      fromReviewOnly = true;
    }

    if (!event) continue;

    // Prefer calendar staff; always union sheet staff (ICS often omits assignee).
    const assignees = new Map<string, (typeof profiles)[number]>();
    for (const person of matchAssignedStaffProfiles(
      event.assignedStaff,
      profiles,
    )) {
      const full = profiles.find((p) => p.id === person.id);
      if (full) assignees.set(full.id, full);
    }
    for (const person of matchAssignedStaffProfiles(
      row.staffMembers,
      profiles,
    )) {
      const full = profiles.find((p) => p.id === person.id);
      if (full) assignees.set(full.id, full);
    }

    if (assignees.size === 0) {
      skippedNoStaff += 1;
      continue;
    }

    // If calendar event had no assigned staff, stamp sheet staff onto a copy
    // so createPacketFromCalendarEvent eligibility still sees a booked event.
    const eventForCreate: CalendarEvent = {
      ...event,
      assignedStaff:
        event.assignedStaff?.trim() || row.staffMembers.trim() || null,
      clientName:
        event.clientName?.trim() || row.reviewerName.trim() || null,
      eventType: event.eventType?.trim() || row.eventType.trim() || "Other",
      uid: extractExternalEventId(event.uid)
        ? canonicalCalendarUid(extractExternalEventId(event.uid)!)
        : event.uid,
    };

    for (const person of assignees.values()) {
      const result = await createPacketFromCalendarEvent({
        supabase,
        event: eventForCreate,
        assignee: person,
        canCreateVenues: true,
        // Review-bridged packets are optional archive work only.
        completionOptional: true,
      });
      if (result.created) {
        packetsCreated += 1;
        if (fromReviewOnly) packetsFromReviewsOnly += 1;
      }
    }
  }

  return {
    packetsCreated,
    calendarFeedsScanned: collected.feedsScanned,
    calendarEventsLoaded: collected.events.length,
    calendarEventIdsFound: collected.eventIds.size,
    reviewIdsOnCalendar,
    packetsFromReviewsOnly,
    skippedNoStaff,
    skippedNoDate,
  };
}
