import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { runOverdueInvoiceReminders } from "@/lib/av-erp/remind-overdue-invoices";

/**
 * Daily nudge for customers with overdue unpaid Hub invoices.
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const result = await runOverdueInvoiceReminders();

  return NextResponse.json({
    ok: !result.error,
    ran: result.ran,
    examined: result.examined,
    emailed: result.emailed,
    notified: result.notified,
    skipped: result.skipped,
    error: result.error,
  });
}
