import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeDjepEventId,
  type EventExternalReview,
} from "@/lib/types/event-reviews";

/** Reviews matched to a packet via DJEP Event_ID / calendar_uid. */
export async function getReviewsForPacket(
  supabase: SupabaseClient,
  calendarUid: string | null | undefined,
): Promise<EventExternalReview[]> {
  const eventId = normalizeDjepEventId(calendarUid);
  if (!eventId) return [];

  const calendarUidNorm = `EVENTID:${eventId}`;
  const { data, error } = await supabase
    .from("event_external_reviews")
    .select("*")
    .or(`event_id.eq.${eventId},calendar_uid.eq.${calendarUidNorm}`)
    .order("review_date", { ascending: false, nullsFirst: false });

  if (error || !data?.length) {
    if (error && !/event_external_reviews|relation|does not exist/i.test(error.message)) {
      console.error("[reviews] load for packet failed", error.message);
    }
    return [];
  }

  return data as EventExternalReview[];
}

/** Compact text block for Social Studio caption prompts. */
export function formatReviewsForCaptions(
  reviews: EventExternalReview[],
): string {
  const usable = reviews.filter(
    (r) => r.comment.trim() && r.show_on_site !== false,
  );
  if (!usable.length) return "";

  return usable
    .slice(0, 3)
    .map((r, i) => {
      const who = r.reviewer_name.trim() || "Client";
      const stars = r.rating != null ? ` (${r.rating}/5)` : "";
      return `${i + 1}. ${who}${stars}: “${r.comment.trim()}”`;
    })
    .join("\n");
}
