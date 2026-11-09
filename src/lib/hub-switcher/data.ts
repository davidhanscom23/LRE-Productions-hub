import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";
import { tilesForPerson, type HubLinkRow, type HubTile } from "./tiles";

/** Tiles for the top-bar switcher. Quietly returns none if the tables are not there yet. */
export async function loadHubTiles(profile: Profile): Promise<HubTile[]> {
  try {
    const supabase = await createClient();
    const { data: hubs, error } = await supabase
      .from("hub_links")
      .select("slug, name, url, logo_url, sort_order, enabled");
    if (error || !hubs) return [];
    const { data: me } = await supabase.from("profiles").select("is_owner").eq("id", profile.id).single();
    const isOwner = Boolean(me?.is_owner);
    let allowed = new Set<string>();
    if (!isOwner) {
      const { data } = await supabase
        .from("hub_link_access")
        .select("hub_slug")
        .eq("profile_id", profile.id);
      allowed = new Set((data ?? []).map((r) => String(r.hub_slug)));
    }
    return tilesForPerson({ isOwner, hubs: hubs as HubLinkRow[], allowedSlugs: allowed });
  } catch {
    return [];
  }
}
