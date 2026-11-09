import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { runOverduePacketReminders } from "@/lib/event-packets/remind-overdue";

/**
 * Daily reminder for assignees with overdue incomplete Event Packets.
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const result = await runOverduePacketReminders();

  return NextResponse.json({
    ok: !result.error,
    ran: result.ran,
    examined: result.examined,
    notified: result.notified,
    skipped: result.skipped,
    error: result.error,
  });
}
