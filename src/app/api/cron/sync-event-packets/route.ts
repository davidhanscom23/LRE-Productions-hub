import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { runCompanyPacketAutoSync } from "@/lib/event-packets/auto-sync";

/**
 * Vercel Cron / external scheduler entrypoint.
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const force = request.nextUrl.searchParams.get("force") === "1";
  const result = await runCompanyPacketAutoSync({ force });

  return NextResponse.json({
    ok: !result.error,
    ran: result.ran,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    unmatchedStaff: result.unmatchedStaff,
    error: result.error,
  });
}
