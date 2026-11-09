import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { runMonthlyHubAwards } from "@/lib/points/monthly-awards";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

/**
 * Monthly Hub trophy awards — Overall Leader + Monthly MVP for the prior
 * America/New_York month (recognition only).
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 * Schedule: 09:00 UTC on the 1st (~05:00 ET).
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is required." },
      { status: 503 },
    );
  }

  const periodParam = request.nextUrl.searchParams.get("period");
  const supabase = createServiceClient();
  const result = await runMonthlyHubAwards(
    supabase,
    periodParam?.trim() || undefined,
  );

  return NextResponse.json({
    ok: !result.error,
    ...result,
  });
}
