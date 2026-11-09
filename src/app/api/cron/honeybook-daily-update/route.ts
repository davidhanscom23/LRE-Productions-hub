import { NextResponse, type NextRequest } from "next/server";

import { authorizeCronRequest } from "@/lib/cron/auth";
import { runHoneyBookDailyUpdate } from "@/lib/honeybook/daily-update";

export const maxDuration = 120;

/**
 * Daily HoneyBook update: one email per staff member about their own projects, and ONE combined
 * email to the admins. Runs once per Eastern calendar day (extra calls are skipped).
 * Add `?force=1` to resend on the same day while testing.
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const force = request.nextUrl.searchParams.get("force") === "1";
  const result = await runHoneyBookDailyUpdate({ force });
  return NextResponse.json({ ok: result.errors.length === 0, ...result });
}
