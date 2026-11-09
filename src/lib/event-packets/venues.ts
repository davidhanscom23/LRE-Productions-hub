import {
  folderSlugFromName,
  normalizeVenueKey,
} from "@/lib/event-packets/naming";
import { createClient } from "@/lib/supabase/server";
import type {
  Venue,
  VenueAlias,
  VenueWithAliases,
} from "@/lib/types/event-packets";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { VenueWithAliases };

async function resolveClient(supabase?: SupabaseClient) {
  return supabase ?? (await createClient());
}

export async function listVenuesWithAliases(
  supabase?: SupabaseClient,
): Promise<VenueWithAliases[]> {
  const client = await resolveClient(supabase);
  const { data: venues, error } = await client
    .from("venues")
    .select("*")
    .order("name", { ascending: true });

  if (error || !venues) return [];

  const { data: aliases } = await client.from("venue_aliases").select("*");

  const byVenue = new Map<string, VenueAlias[]>();
  for (const alias of aliases ?? []) {
    const row = alias as VenueAlias;
    const list = byVenue.get(row.venue_id) ?? [];
    list.push(row);
    byVenue.set(row.venue_id, list);
  }

  return (venues as Venue[]).map((venue) => ({
    ...venue,
    aliases: byVenue.get(venue.id) ?? [],
  }));
}

/**
 * Resolve a venue string to a master venue.
 * Exact alias/name match first, then contains match either direction.
 */
export function resolveVenueFromList(
  rawVenue: string | null | undefined,
  venues: VenueWithAliases[],
): VenueWithAliases | null {
  const key = normalizeVenueKey(rawVenue ?? "");
  if (!key) return null;

  for (const venue of venues) {
    if (normalizeVenueKey(venue.name) === key) return venue;
    for (const alias of venue.aliases) {
      if (normalizeVenueKey(alias.alias) === key) return venue;
    }
  }

  // Soft contains match (e.g. "The Treasury" ↔ "The Treasury on the Plaza")
  let best: VenueWithAliases | null = null;
  let bestScore = 0;
  for (const venue of venues) {
    const candidates = [
      normalizeVenueKey(venue.name),
      ...venue.aliases.map((a) => normalizeVenueKey(a.alias)),
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (key.includes(candidate) || candidate.includes(key)) {
        const score = Math.min(key.length, candidate.length);
        if (score > bestScore) {
          bestScore = score;
          best = venue;
        }
      }
    }
  }

  // Require a meaningful overlap (avoid matching on "the")
  if (best && bestScore >= 5) return best;
  return null;
}

/** Find or create a master venue from raw calendar/form text. */
export async function ensureVenueForName(
  rawVenue: string,
  supabase?: SupabaseClient,
): Promise<VenueWithAliases | null> {
  const trimmed = rawVenue.trim();
  if (!trimmed) return null;

  const client = await resolveClient(supabase);
  const venues = await listVenuesWithAliases(client);
  const existing = resolveVenueFromList(trimmed, venues);
  if (existing) return existing;

  const folder_slug = folderSlugFromName(trimmed);
  const { data, error } = await client
    .from("venues")
    .insert({
      name: trimmed,
      folder_slug,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !data) {
    const again = await listVenuesWithAliases(client);
    return resolveVenueFromList(trimmed, again);
  }

  const venue = data as Venue;
  await client.from("venue_aliases").upsert(
    {
      venue_id: venue.id,
      alias: normalizeVenueKey(trimmed),
    },
    { onConflict: "alias", ignoreDuplicates: true },
  );

  return { ...venue, aliases: [] };
}
