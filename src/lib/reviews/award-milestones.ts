import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attributeReviewToProfiles,
  buildPacketAssigneesByEventId,
  type ReviewStaffProfile,
} from "@/lib/reviews/attribution";
import { CLIENT_REVIEW_MILESTONES } from "@/lib/reviews/milestones";
import { awardAchievementTo } from "@/lib/points/hub-points";
import type { EventExternalReview } from "@/lib/types/event-reviews";

export type AwardClientReviewMilestonesResult = {
  examined: number;
  awarded: number;
  error: string | null;
};

/**
 * Count attributed website reviews per staff member and award any unmet
 * milestone achievements. Safe to call after sheet sync or on page load.
 * Pass `onlyUserId` when the caller cannot award other users (non-admin).
 */
export async function awardClientReviewMilestones(
  supabase: SupabaseClient,
  options: { onlyUserId?: string } = {},
): Promise<AwardClientReviewMilestonesResult> {
  const [{ data: reviews, error: reviewsError }, { data: profiles, error: profilesError }, { data: packets, error: packetsError }] =
    await Promise.all([
      supabase.from("event_external_reviews").select("*"),
      supabase
        .from("profiles")
        .select("id, full_name, email, is_active, avatar_url, color")
        .eq("is_active", true),
      supabase
        .from("event_packets")
        .select("calendar_uid, assignee_id")
        .not("calendar_uid", "is", null),
    ]);

  if (reviewsError) {
    return { examined: 0, awarded: 0, error: reviewsError.message };
  }
  if (profilesError) {
    return { examined: 0, awarded: 0, error: profilesError.message };
  }
  if (packetsError) {
    return { examined: 0, awarded: 0, error: packetsError.message };
  }

  const staff = (profiles ?? []) as ReviewStaffProfile[];
  const allReviews = (reviews ?? []) as EventExternalReview[];
  const byEvent = buildPacketAssigneesByEventId(packets ?? []);

  const counts = new Map<string, number>();
  for (const review of allReviews) {
    if (!review.comment?.trim()) continue;
    const credited = attributeReviewToProfiles(review, staff, byEvent);
    for (const person of credited) {
      counts.set(person.id, (counts.get(person.id) ?? 0) + 1);
    }
  }

  let awarded = 0;
  for (const [userId, count] of counts) {
    if (options.onlyUserId && userId !== options.onlyUserId) continue;
    for (const milestone of CLIENT_REVIEW_MILESTONES) {
      if (count < milestone.count) continue;
      const result = await awardAchievementTo(supabase, userId, milestone.key, {
        review_count: count,
      });
      if (result.awarded) awarded += 1;
    }
  }

  return { examined: counts.size, awarded, error: null };
}
