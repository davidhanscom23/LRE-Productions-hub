import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { runChecklistAlerts } from "@/lib/event-checklist/alerts";

/**
 * Every 5 minutes: alert (in the Hub, push and text) when a gear checklist is under 100% after its
 * scheduled leave or due-back time. Authorize with `Authorization: Bearer $CRON_SECRET`.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const result = await runChecklistAlerts();
  return NextResponse.json({ ok: !result.error, ...result });
}
