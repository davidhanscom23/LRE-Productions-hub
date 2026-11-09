"use server";

import { runCompanyPacketAutoSync } from "@/lib/event-packets/auto-sync";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

/**
 * Best-effort throttled sync when an admin opens Event Packets.
 * Uses service role when available; no-ops otherwise (manual Sync / cron still work).
 */
export async function maybeAutoSyncPacketsAction(): Promise<void> {
  if (!isServiceRoleConfigured()) return;
  try {
    await runCompanyPacketAutoSync({ force: false });
  } catch {
    // Page should still load if sync fails.
  }
}
