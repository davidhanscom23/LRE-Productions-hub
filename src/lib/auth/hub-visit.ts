import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type HubVisit = {
  /** False when the visit tracker is not available yet (migration 174 not run). */
  tracked: boolean;
  /** ISO time of the person's previous visit; null on a first visit. */
  previousVisitAt: string | null;
};

/**
 * Records this page view and returns when the person was last on the Hub
 * before the current visit. Cached per request, so the layout and the Tools
 * page share one database call.
 */
export const touchHubVisit = cache(async (): Promise<HubVisit> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("touch_hub_visit");
    if (error) return { tracked: false, previousVisitAt: null };
    return { tracked: true, previousVisitAt: (data as string | null) ?? null };
  } catch {
    return { tracked: false, previousVisitAt: null };
  }
});
