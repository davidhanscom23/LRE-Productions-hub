import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { processHuddleReminders } from "@/lib/huddle/store";

/**
 * Fire due Zoom huddle reminders (10-minute + start).
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 * Schedule frequently so reminders stay timely without hitching on client polls.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  try {
    await processHuddleReminders();
    return NextResponse.json({ ok: true, ran: true, error: null });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      ran: true,
      error: err instanceof Error ? err.message : "Huddle reminders failed.",
    });
  }
}
