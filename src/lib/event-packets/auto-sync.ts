import "server-only";

import {
  COMPANY_ICAL_SETTING_KEY,
  WORK_ICAL_SETTING_KEY,
  getCachedDjepCalendarEvents,
} from "@/lib/calendar/events";
import { withHubAssignments } from "@/lib/calendar/load-assignments";
import {
  syncPacketsFromEvents,
  type SyncPacketsResult,
} from "@/lib/event-packets/sync";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

export const PACKET_SYNC_LAST_KEY = "event_packets_last_auto_sync";
export const PACKET_SYNC_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function runCompanyPacketAutoSync(options?: {
  force?: boolean;
}): Promise<SyncPacketsResult & { ran: boolean }> {
  if (!isServiceRoleConfigured()) {
    return {
      ran: false,
      created: 0,
      updated: 0,
      skipped: 0,
      unmatchedStaff: [],
      error:
        "SUPABASE_SERVICE_ROLE_KEY is not configured — cron auto-sync cannot run.",
    };
  }

  const supabase = createServiceClient();

  if (!options?.force) {
    const { data: last } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", PACKET_SYNC_LAST_KEY)
      .maybeSingle();
    const lastMs = Date.parse(String(last?.value ?? ""));
    if (
      Number.isFinite(lastMs) &&
      Date.now() - lastMs < PACKET_SYNC_MIN_INTERVAL_MS
    ) {
      return {
        ran: false,
        created: 0,
        updated: 0,
        skipped: 0,
        unmatchedStaff: [],
        error: null,
      };
    }
  }

  let icalUrl = "";
  for (const key of [WORK_ICAL_SETTING_KEY, COMPANY_ICAL_SETTING_KEY]) {
    const { data: icalRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    icalUrl = String(icalRow?.value ?? "").trim();
    if (icalUrl) break;
  }

  if (!icalUrl) {
    return {
      ran: false,
      created: 0,
      updated: 0,
      skipped: 0,
      unmatchedStaff: [],
      error: "Team / company calendar iCal URL is not configured.",
    };
  }

  try {
    const rawEvents = await getCachedDjepCalendarEvents(icalUrl);
    const events = await withHubAssignments(supabase, rawEvents);
    const result = await syncPacketsFromEvents({
      supabase,
      events,
      canCreateVenues: true,
    });

    await supabase.from("app_settings").upsert(
      {
        key: PACKET_SYNC_LAST_KEY,
        value: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

    return { ...result, ran: true };
  } catch (error) {
    return {
      ran: false,
      created: 0,
      updated: 0,
      skipped: 0,
      unmatchedStaff: [],
      error: error instanceof Error ? error.message : "Auto-sync failed.",
    };
  }
}
