import type { NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { jsonResponse } from "@/lib/inquiry-forms/server/http-core";
import { runSweep } from "@/lib/inquiry-forms/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Inquiry Forms sweep (every 5 minutes): marks idle reachable submissions abandoned and alerts
 * staff once (kind web_inquiry_unfinished), retries failed alerts, re-drives completions whose
 * Leads card or staff alert never logged success (max 3 attempts), and prunes old rate-limit rows.
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 */
async function handle(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;
  const summary = await runSweep();
  return jsonResponse(summary.ok ? 200 : 500, summary);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
