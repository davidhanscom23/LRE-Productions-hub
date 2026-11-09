import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { runDueSocialAutoPublish } from "@/lib/marketing/auto-publish-due";

/**
 * Vercel Cron / external scheduler entrypoint.
 * Publishes due ready social drafts (Meta / LinkedIn / TikTok / X) when APIs are configured.
 * Scheduled several times per day in vercel.json (Hobby forbids true hourly expressions).
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const result = await runDueSocialAutoPublish();

  return NextResponse.json({
    ok: !result.error,
    ran: result.ran,
    examined: result.examined,
    published: result.published,
    failed: result.failed,
    skipped: result.skipped,
    error: result.error,
    failures: result.failures,
  });
}
