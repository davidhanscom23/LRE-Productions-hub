import "server-only";

import { insertNotifications } from "@/lib/notifications/notify";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

export type RemindOverdueActionsResult = {
  ran: boolean;
  examined: number;
  notified: number;
  skipped: number;
  error: string | null;
};

/**
 * Notify assignees about overdue open Action Center tasks.
 * Dedupes: skip if an action_overdue notification for that item
 * was created in the last 20 hours.
 */
export async function runOverdueActionItemReminders(): Promise<RemindOverdueActionsResult> {
  if (!isServiceRoleConfigured()) {
    return {
      ran: false,
      examined: 0,
      notified: 0,
      skipped: 0,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is required for overdue Action Center reminders.",
    };
  }

  const supabase = createServiceClient();
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  const { data: items, error } = await supabase
    .from("action_items")
    .select(
      "id, title, assigned_to, due_date, status, action_item_assignees(user_id, done_at)",
    )
    .eq("status", "open")
    .not("due_date", "is", null)
    .lt("due_date", todayKey)
    .order("due_date", { ascending: true })
    .limit(200);

  if (error) {
    return {
      ran: false,
      examined: 0,
      notified: 0,
      skipped: 0,
      error: error.message,
    };
  }

  const overdue = items ?? [];
  if (!overdue.length) {
    return {
      ran: true,
      examined: 0,
      notified: 0,
      skipped: 0,
      error: null,
    };
  }

  const since = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();
  const hrefs = overdue.map((row) => `/action-center?item=${row.id}`);

  const { data: recent } = await supabase
    .from("hub_notifications")
    .select("href, user_id")
    .eq("kind", "action_overdue")
    .gte("created_at", since)
    .in("href", hrefs);

  const already = new Set(
    (recent ?? []).map((row) => `${row.user_id}:${String(row.href ?? "")}`),
  );

  // Remind every assignee who hasn't checked off their part yet
  // (fall back to the legacy single assignee pre-migration-131).
  let candidates = 0;
  const rows: {
    userId: string;
    kind: string;
    title: string;
    body: string;
    href: string;
  }[] = [];
  for (const row of overdue) {
    const href = `/action-center?item=${row.id}`;
    const junction = (row as { action_item_assignees?: { user_id: string; done_at: string | null }[] })
      .action_item_assignees;
    const pendingUsers =
      junction && junction.length > 0
        ? junction.filter((a) => !a.done_at).map((a) => a.user_id)
        : row.assigned_to
          ? [row.assigned_to as string]
          : [];
    for (const userId of pendingUsers) {
      candidates += 1;
      if (already.has(`${userId}:${href}`)) continue;
      rows.push({
        userId,
        kind: "action_overdue",
        title: "Action Center task overdue",
        body: `${row.title} was due ${row.due_date}.`,
        href,
      });
    }
  }

  await insertNotifications(supabase, rows);

  return {
    ran: true,
    examined: overdue.length,
    notified: rows.length,
    skipped: candidates - rows.length,
    error: null,
  };
}
