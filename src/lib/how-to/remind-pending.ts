import "server-only";

import { PENDING_HOW_TO_VIDEOS } from "@/lib/how-to/pending";
import { notifyAdmins } from "@/lib/notifications/notify";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

export type PendingHowToReminderResult = {
  ran: boolean;
  pending: number;
  notified: number;
  error: string | null;
};

/**
 * Daily: if PENDING_HOW_TO_VIDEOS is not empty, notify admins which routes
 * are owed a video. Skips if an admin note went out in the last 20 hours.
 */
export async function runPendingHowToVideoReminder(): Promise<PendingHowToReminderResult> {
  const pending = PENDING_HOW_TO_VIDEOS.length;
  if (pending === 0) {
    return { ran: true, pending: 0, notified: 0, error: null };
  }
  if (!isServiceRoleConfigured()) {
    return {
      ran: false,
      pending,
      notified: 0,
      error: "SUPABASE_SERVICE_ROLE_KEY is required for how-to video reminders.",
    };
  }

  const supabase = createServiceClient();
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("hub_notifications")
    .select("id")
    .eq("kind", "howto_pending")
    .gte("created_at", since)
    .limit(1);
  if (recent && recent.length > 0) {
    return { ran: true, pending, notified: 0, error: null };
  }

  const routes = PENDING_HOW_TO_VIDEOS.map((p) => p.route).join(", ");
  const notified = await notifyAdmins(supabase, {
    kind: "howto_pending",
    title: `How-to video${pending === 1 ? "" : "s"} owed`,
    body: `${pending} staff-facing change${pending === 1 ? "" : "s"} shipped without an updated how-to video: ${routes}. Ask Claude to make the pending videos.`,
    href: "/training-portal",
  });
  return { ran: true, pending, notified, error: null };
}
