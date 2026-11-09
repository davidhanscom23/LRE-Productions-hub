import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COMPANY_ICAL_SETTING_KEY,
  HONEYBOOK_ICAL_SETTING_KEY,
  fetchCompanyCalendarEvents,
  type CalendarEvent,
} from "@/lib/calendar/events";
import { extractDjepEventId } from "@/lib/calendar/djep-event-id";

export type CollectedCalendarFeeds = {
  feedsScanned: number;
  events: CalendarEvent[];
  eventIds: Set<string>;
};

/**
 * Load the shared Vident work calendar only (HoneyBook→Google iCal, with
 * legacy company_ical_url as fallback). Personal DJEP feeds are intentionally
 * ignored — Vident does not use DJEP / Y Entertainment calendars.
 */
export async function collectAllDjepWorkEvents(
  supabase: SupabaseClient,
): Promise<CollectedCalendarFeeds> {
  let icalUrl = "";
  for (const key of [HONEYBOOK_ICAL_SETTING_KEY, COMPANY_ICAL_SETTING_KEY]) {
    const { data: row } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    icalUrl = String(row?.value ?? "").trim();
    if (icalUrl) break;
  }

  if (!icalUrl) {
    return { feedsScanned: 0, events: [], eventIds: new Set() };
  }

  const byUid = new Map<string, CalendarEvent>();
  let feedsScanned = 0;

  try {
    const events = await fetchCompanyCalendarEvents(icalUrl);
    feedsScanned = 1;
    for (const event of events) {
      if (!event.uid?.trim()) continue;
      byUid.set(event.uid.trim(), event);
    }
  } catch (err) {
    console.warn(
      "[calendar] shared feed fetch failed",
      err instanceof Error ? err.message : err,
    );
  }

  const events = [...byUid.values()];
  const eventIds = new Set<string>();
  for (const event of events) {
    const id = extractDjepEventId(event.uid);
    if (id) eventIds.add(id);
  }

  return { feedsScanned, events, eventIds };
}
