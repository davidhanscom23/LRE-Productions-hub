import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { runAvPortalCheckins } from "@/lib/av-portals/run-checkins";

/**
 * Daily AV event portal check-ins (30 / 14 / 7 / 3 days before each show).
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const result = await runAvPortalCheckins();
  return NextResponse.json({ ok: !result.error, ...result });
}
