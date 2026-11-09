import type { SupabaseClient } from "@supabase/supabase-js";

/** Stable For You dismissal keys. */

export function monthlyTrophiesDismissKey(period: string): string {
  return `monthly_trophies:${period}`;
}

/** True when the user has dismissed this For You key (migration 087). */
export async function isForYouKeyDismissed(
  supabase: SupabaseClient,
  userId: string,
  dismissKey: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("hub_foryou_dismissals")
    .select("dismiss_key")
    .eq("user_id", userId)
    .eq("dismiss_key", dismissKey)
    .maybeSingle();

  if (error) {
    // Table may not exist yet — treat as not dismissed.
    return false;
  }
  return Boolean(data);
}
