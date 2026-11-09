import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { runForYouCleanStreak } from "@/lib/points/foryou-clean-streak";

/**
 * Daily For You clean streak — evaluates prior America/New_York day.
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 * Schedule: 05:00 UTC (after NY end-of-day).
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const result = await runForYouCleanStreak();

  return NextResponse.json({
    ok: !result.error,
    ...result,
  });
}
