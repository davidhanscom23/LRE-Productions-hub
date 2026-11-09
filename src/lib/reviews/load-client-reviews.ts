import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attributeReviewToProfiles,
  buildPacketAssigneesByEventId,
  type ReviewStaffProfile,
} from "@/lib/reviews/attribution";
import type { EventExternalReview } from "@/lib/types/event-reviews";

export type ClientReviewListItem = EventExternalReview & {
  creditedStaff: ReviewStaffProfile[];
  packetIds: string[];
};

export type LoadClientReviewsResult = {
  reviews: ClientReviewListItem[];
  staffOptions: ReviewStaffProfile[];
  countsByStaffId: Record<string, number>;
  error: string | null;
};

export async function loadClientReviews(
  supabase: SupabaseClient,
  options: {
    viewerId: string;
    viewerRole: string;
    /** When admin/trainer filters to one person. */
    staffFilterId?: string | null;
  },
): Promise<LoadClientReviewsResult> {
  const canViewAll =
    options.viewerRole === "admin" || options.viewerRole === "trainer";

  // Slim columns (skip sheet blobs) — still enough for list + attribution fallback.
  const reviewSelect =
    "id, sheet_fingerprint, sheet_row, event_id, calendar_uid, reviewer_name, comment, rating, review_date, event_type, services, staff_members, credited_profile_ids, show_on_site, needs_review, source, matched_packet_count, last_synced_at, created_at, updated_at";

  const [{ data: reviews, error: reviewsError }, { data: profiles, error: profilesError }, { data: packets, error: packetsError }] =
    await Promise.all([
      supabase
        .from("event_external_reviews")
        .select(reviewSelect)
        .order("review_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, email, is_active, avatar_url, color")
        .eq("is_active", true)
        .neq("role", "guest")
        .order("full_name", { ascending: true }),
      supabase
        .from("event_packets")
        .select("id, calendar_uid, assignee_id")
        .not("calendar_uid", "is", null),
    ]);

  if (reviewsError) {
    return {
      reviews: [],
      staffOptions: [],
      countsByStaffId: {},
      error: reviewsError.message,
    };
  }
  if (profilesError) {
    return {
      reviews: [],
      staffOptions: [],
      countsByStaffId: {},
      error: profilesError.message,
    };
  }
  if (packetsError) {
    return {
      reviews: [],
      staffOptions: [],
      countsByStaffId: {},
      error: packetsError.message,
    };
  }

  const staff = (profiles ?? []) as ReviewStaffProfile[];
  const byEvent = buildPacketAssigneesByEventId(packets ?? []);
  const packetIdsByEvent = new Map<string, string[]>();
  for (const packet of packets ?? []) {
    const match = String(packet.calendar_uid ?? "").match(/EVENTID:(\d+)/i);
    const eventId = match?.[1];
    if (!eventId) continue;
    const list = packetIdsByEvent.get(eventId) ?? [];
    list.push(String(packet.id));
    packetIdsByEvent.set(eventId, list);
  }

  const enriched: ClientReviewListItem[] = [];
  const countsByStaffId: Record<string, number> = {};

  const staffById = new Map(staff.map((p) => [p.id, p]));

  for (const raw of (reviews ?? []) as EventExternalReview[]) {
    if (!raw.comment?.trim()) continue;
    const storedIds = (raw.credited_profile_ids ?? []).filter(Boolean);
    const creditedStaff = storedIds.length
      ? storedIds
          .map((id) => staffById.get(id))
          .filter((p): p is ReviewStaffProfile => Boolean(p))
      : attributeReviewToProfiles(raw, staff, byEvent);
    for (const person of creditedStaff) {
      countsByStaffId[person.id] = (countsByStaffId[person.id] ?? 0) + 1;
    }

    const eventId =
      raw.event_id?.trim() ||
      (raw.calendar_uid?.match(/EVENTID:(\d+)/i)?.[1] ?? null);
    enriched.push({
      ...raw,
      creditedStaff,
      packetIds: eventId ? (packetIdsByEvent.get(eventId) ?? []) : [],
    });
  }

  const focusId = canViewAll
    ? options.staffFilterId?.trim() || null
    : options.viewerId;

  const filtered = focusId
    ? enriched.filter((review) =>
        review.creditedStaff.some((p) => p.id === focusId),
      )
    : enriched;

  // Staff options: people who have at least one attributed review (plus viewer).
  const withReviews = staff.filter((p) => (countsByStaffId[p.id] ?? 0) > 0);
  const staffOptions = canViewAll
    ? withReviews
    : staff.filter((p) => p.id === options.viewerId);

  return {
    reviews: filtered,
    staffOptions,
    countsByStaffId,
    error: null,
  };
}
