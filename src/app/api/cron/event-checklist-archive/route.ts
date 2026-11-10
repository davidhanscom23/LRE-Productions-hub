import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { runChecklistArchive } from "@/lib/event-checklist/archive/run";

/**
 * Daily: on Dec 31 (and the first week of January as a catch-up) zip the gear-checklist history and
 * photos to the LRE Hub Backup shared drive; every day remove photos that are archived and past
 * the 90-day live window. Add `?force=1` to archive outside that window.
 * Authorize with `Authorization: Bearer $CRON_SECRET`.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const force = request.nextUrl.searchParams.get("force") === "1";
  const result = await runChecklistArchive(new Date(), { force });
  return NextResponse.json({ ok: !result.error, ...result }, { status: result.error ? 500 : 200 });
}
