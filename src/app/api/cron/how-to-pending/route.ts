import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { runPendingHowToVideoReminder } from "@/lib/how-to/remind-pending";

/**
 * Daily admin reminder while any how-to video is owed
 * (PENDING_HOW_TO_VIDEOS in src/lib/how-to/pending.ts).
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const result = await runPendingHowToVideoReminder();

  return NextResponse.json({
    ok: !result.error,
    ran: result.ran,
    pending: result.pending,
    notified: result.notified,
    error: result.error,
  });
}
