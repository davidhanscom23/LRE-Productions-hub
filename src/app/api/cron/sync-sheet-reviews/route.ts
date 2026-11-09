import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { awardClientReviewMilestones } from "@/lib/reviews/award-milestones";
import { syncExternalReviewsFromSheet } from "@/lib/reviews/sync-sheet";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

/**
 * Sync website testimonials Google Sheet → event_external_reviews.
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const result = await syncExternalReviewsFromSheet();
  let milestonesAwarded = 0;
  if (result.ok && isServiceRoleConfigured()) {
    const awards = await awardClientReviewMilestones(createServiceClient());
    milestonesAwarded = awards.awarded;
  }
  return NextResponse.json(
    { ...result, milestonesAwarded },
    { status: result.ok ? 200 : 500 },
  );
}
