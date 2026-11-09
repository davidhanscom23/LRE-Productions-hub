import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";
import { pickCheckinKind, daysUntil, todayInEastern } from "./cadence";
import { fetchPortalState, sendPortalEmail, type PortalRow } from "./server";

export type CheckinRunResult = {
  examined: number;
  sent: number;
  skipped: number;
  failed: number;
  error?: string;
};

/** Daily job: send whichever scheduled check-in is due for each active show. */
export async function runAvPortalCheckins(): Promise<CheckinRunResult> {
  const result: CheckinRunResult = { examined: 0, sent: 0, skipped: 0, failed: 0 };
  const supabase = createServiceClient();
  const today = todayInEastern();

  const { data, error } = await supabase
    .from("av_event_portals")
    .select("*")
    .eq("is_active", true)
    .gte("event_date", today);
  if (error) return { ...result, error: error.message };

  for (const portal of (data ?? []) as PortalRow[]) {
    result.examined += 1;
    const days = daysUntil(portal.event_date, today);
    if (days < 1 || days > 30) {
      result.skipped += 1;
      continue;
    }
    const { data: log } = await supabase
      .from("av_event_portal_emails")
      .select("kind")
      .eq("portal_id", portal.id);
    const sent = new Set((log ?? []).map((r: { kind: string }) => r.kind));
    const kind = pickCheckinKind(days, sent);
    if (!kind) {
      result.skipped += 1;
      continue;
    }
    const { status } = await fetchPortalState(portal.id);
    if (status.allComplete) {
      result.skipped += 1; // nothing outstanding; the thank-you already went out
      continue;
    }
    const res = await sendPortalEmail(portal, kind, status);
    if (res.ok && !res.skipped) result.sent += 1;
    else if (res.ok) result.skipped += 1;
    else result.failed += 1;
  }
  return result;
}
