import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { runOverdueActionItemReminders } from "@/lib/action-center/remind-overdue";

/**
 * Daily reminder for assignees with overdue open Action Center tasks.
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const result = await runOverdueActionItemReminders();

  return NextResponse.json({
    ok: !result.error,
    ran: result.ran,
    examined: result.examined,
    notified: result.notified,
    skipped: result.skipped,
    error: result.error,
  });
}
