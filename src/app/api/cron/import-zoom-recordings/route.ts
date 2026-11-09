import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isZoomConfigured } from "@/lib/zoom/client";
import { importZoomRecordings } from "@/lib/zoom/import-recordings";

/**
 * Daily import of the host's Zoom cloud recordings into Video Archives.
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  if (!isZoomConfigured()) {
    return NextResponse.json({ ok: false, error: "Zoom not configured." });
  }
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({
      ok: false,
      error: "Service role not configured.",
    });
  }

  const daysParam = Number(request.nextUrl.searchParams.get("days") ?? 2);
  const days = Number.isFinite(daysParam) ? daysParam : 2;

  const supabase = createServiceClient();
  const result = await importZoomRecordings(supabase, { days, createdBy: null });

  return NextResponse.json({ ok: !result.error, ...result });
}
