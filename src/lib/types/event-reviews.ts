/** Client testimonial synced from the website Google Sheet. */
export type EventExternalReview = {
  id: string;
  sheet_fingerprint: string;
  sheet_row: number | null;
  event_id: string | null;
  calendar_uid: string | null;
  reviewer_name: string;
  comment: string;
  rating: number | null;
  review_date: string | null;
  event_type: string;
  services: string;
  staff_members: string;
  /** Hub profile IDs credited for this review (migration 091). */
  credited_profile_ids?: string[];
  show_on_site: boolean | null;
  needs_review: boolean | null;
  source: string;
  matched_packet_count: number;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
};

export type EventExternalReviewSyncResult = {
  ok: boolean;
  ran: boolean;
  rowsRead: number;
  upserted: number;
  matched: number;
  unmatched: number;
  /** Rows that had a parseable Event_ID in the sheet/CSV. */
  withEventId: number;
  /** Rows missing Event_ID. */
  missingEventId: number;
  /** Packets created from the calendar while linking reviews. */
  packetsCreated: number;
  /** Calendar feeds scanned while bridging reviews → packets. */
  calendarFeedsScanned: number;
  /** Work events loaded from those feeds. */
  calendarEventsLoaded: number;
  /** Distinct planner Event IDs found on the calendar feeds. */
  calendarEventIdsFound: number;
  /** Review Event_IDs that also appeared on a calendar feed. */
  reviewIdsOnCalendar: number;
  /** Packets built from review sheet fields when the event wasn't on a feed. */
  packetsFromReviewsOnly: number;
  /** Reviews skipped because no Hub profile matched Staff Member(s). */
  skippedNoStaff: number;
  skippedNoComment: number;
  /** Rows removed because they are no longer in the sheet (unlink / prune). */
  pruned: number;
  source: "published_csv" | "sheets_api" | null;
  error: string | null;
};

/** Normalize sheet Event_ID / packet calendar_uid to digits-only planner id. */
export function normalizeExternalEventId(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const fromPrefix = trimmed.match(/EVENTID:(\d+)/i);
  if (fromPrefix) return fromPrefix[1]!;
  const fromHost = trimmed.match(/^(\d{4,})(?:@\S+)?$/);
  if (fromHost) return fromHost[1]!;
  const digits = trimmed.match(/^(\d+)$/);
  return digits ? digits[1]! : null;
}

export function calendarUidFromEventId(eventId: string): string {
  return `EVENTID:${eventId}`;
}

/** True when a packet calendar_uid refers to the same planner event id. */
export function calendarUidMatchesEventId(
  calendarUid: string | null | undefined,
  eventId: string,
): boolean {
  const normalized = normalizeExternalEventId(calendarUid);
  return normalized != null && normalized === eventId;
}
