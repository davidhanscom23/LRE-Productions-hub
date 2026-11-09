import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { runFieldDigestEmails } from "@/lib/for-you/field-digest";

/**
 * Daily Field digest — emails staff with actionable For You items.
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const result = await runFieldDigestEmails();

  return NextResponse.json({
    ok: !result.error,
    ran: result.ran,
    examined: result.examined,
    emailed: result.emailed,
    skipped: result.skipped,
    error: result.error,
  });
}
