import { NextResponse, type NextRequest } from "next/server";

import { authorizeCronRequest } from "@/lib/cron/auth";
import { runHoneyBookGmailSync } from "@/lib/honeybook/gmail/sync";

export const maxDuration = 300;

/**
 * Reads new mail in staff Gmail mailboxes (read-only), creates HoneyBook inquiry cards, and
 * adds notes to each project's trail. Off until HONEYBOOK_GMAIL_ENABLED=true.
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const summary = await runHoneyBookGmailSync();
  return NextResponse.json({ ok: summary.errors.length === 0, ...summary });
}
