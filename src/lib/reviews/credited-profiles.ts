import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attributeReviewToProfiles,
  buildPacketAssigneesByEventId,
  type ReviewStaffProfile,
} from "@/lib/reviews/attribution";

/**
 * Recompute and persist credited_profile_ids for all external reviews.
 * Safe to call after sheet sync / packet bridge (service role or admin).
 */
export async function refreshAllReviewCredits(
  supabase: SupabaseClient,
): Promise<{ updated: number; error: string | null }> {
  const [{ data: reviews, error: reviewsError }, { data: profiles }, { data: packets }] =
    await Promise.all([
      supabase
        .from("event_external_reviews")
        .select("id, staff_members, calendar_uid, event_id"),
      supabase
        .from("profiles")
        .select("id, full_name, email, is_active")
        .eq("is_active", true)
        .neq("role", "guest"),
      supabase
        .from("event_packets")
        .select("calendar_uid, assignee_id")
        .not("calendar_uid", "is", null),
    ]);

  if (reviewsError) {
    if (/credited_profile_ids|column/i.test(reviewsError.message)) {
      return {
        updated: 0,
        error: "Run migration 097_event_reviews_credited_profiles.sql in Supabase.",
      };
    }
    return { updated: 0, error: reviewsError.message };
  }

  const staff = (profiles ?? []) as ReviewStaffProfile[];
  const byEvent = buildPacketAssigneesByEventId(packets ?? []);
  let updated = 0;

  for (const row of reviews ?? []) {
    const credited = attributeReviewToProfiles(
      {
        staff_members: String(row.staff_members ?? ""),
        calendar_uid: row.calendar_uid ? String(row.calendar_uid) : null,
        event_id: row.event_id ? String(row.event_id) : null,
      },
      staff,
      byEvent,
    );
    const ids = credited.map((p) => p.id);
    const { error } = await supabase
      .from("event_external_reviews")
      .update({ credited_profile_ids: ids })
      .eq("id", row.id);
    if (!error) updated += 1;
  }

  return { updated, error: null };
}
