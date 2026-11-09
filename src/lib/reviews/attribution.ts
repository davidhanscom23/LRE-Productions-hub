import { matchAssignedStaffProfiles } from "@/lib/event-packets/match-staff";
import type { EventExternalReview } from "@/lib/types/event-reviews";

export type ReviewStaffProfile = {
  id: string;
  full_name: string;
  email: string;
  is_active?: boolean;
  avatar_url?: string | null;
  color?: string | null;
};

export type PacketAssigneeLink = {
  calendar_uid: string | null;
  assignee_id: string;
};

/**
 * Profiles credited for a review: sheet "Staff Member(s)" names, plus
 * Event Packet assignees when the review is matched by Event ID.
 */
export function attributeReviewToProfiles(
  review: Pick<EventExternalReview, "staff_members" | "calendar_uid" | "event_id">,
  profiles: ReviewStaffProfile[],
  packetAssigneesByEventId: Map<string, string[]>,
): ReviewStaffProfile[] {
  const matched = new Map<string, ReviewStaffProfile>();
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  for (const person of matchAssignedStaffProfiles(
    review.staff_members,
    profiles,
  )) {
    matched.set(person.id, person);
  }

  const eventId =
    review.event_id?.trim() ||
    (review.calendar_uid?.match(/EVENTID:(\d+)/i)?.[1] ?? null);
  if (eventId) {
    for (const assigneeId of packetAssigneesByEventId.get(eventId) ?? []) {
      const person = profileById.get(assigneeId);
      if (person) matched.set(person.id, person);
    }
  }

  return Array.from(matched.values());
}

export function buildPacketAssigneesByEventId(
  packets: PacketAssigneeLink[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const packet of packets) {
    const match = packet.calendar_uid?.match(/EVENTID:(\d+)/i);
    const eventId = match?.[1];
    if (!eventId || !packet.assignee_id) continue;
    const list = map.get(eventId) ?? [];
    if (!list.includes(packet.assignee_id)) list.push(packet.assignee_id);
    map.set(eventId, list);
  }
  return map;
}

/** Distinct reviews attributed to a staff member. */
export function countReviewsForStaff(
  reviews: EventExternalReview[],
  staffId: string,
  profiles: ReviewStaffProfile[],
  packetAssigneesByEventId: Map<string, string[]>,
): number {
  let count = 0;
  for (const review of reviews) {
    const credited = attributeReviewToProfiles(
      review,
      profiles,
      packetAssigneesByEventId,
    );
    if (credited.some((p) => p.id === staffId)) count += 1;
  }
  return count;
}
