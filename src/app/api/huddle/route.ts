import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getActiveHuddle, getScheduledHuddle } from "@/lib/huddle/store";

/** Current live + upcoming huddle for the banner (any signed-in user). */
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Reminders are owned by /api/cron/huddle-reminders — keep this poll read-only.
  const [huddle, scheduled] = await Promise.all([
    getActiveHuddle(),
    getScheduledHuddle(),
  ]);
  return NextResponse.json({ huddle, scheduled });
}
