import "server-only";

import { isPacketOverdue } from "@/lib/event-packets/overdue";
import { insertNotifications } from "@/lib/notifications/notify";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

export type RemindOverdueResult = {
  ran: boolean;
  examined: number;
  notified: number;
  skipped: number;
  error: string | null;
};

/**
 * Notify assignees about overdue incomplete Event Packets.
 * Dedupes: skip if a packet_overdue notification for that packet
 * was created in the last 20 hours.
 */
export async function runOverduePacketReminders(): Promise<RemindOverdueResult> {
  if (!isServiceRoleConfigured()) {
    return {
      ran: false,
      examined: 0,
      notified: 0,
      skipped: 0,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is required for overdue packet reminders.",
    };
  }

  const supabase = createServiceClient();
  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - 1);
  const cutoffIso = cutoffDate.toISOString().slice(0, 10);

  const { data: packets, error } = await supabase
    .from("event_packets")
    .select(
      "id, assignee_id, client_name, venue_raw, event_date, status, dj_name, completion_optional",
    )
    .neq("status", "completed")
    .eq("completion_optional", false)
    .lte("event_date", cutoffIso)
    .not("assignee_id", "is", null)
    .order("event_date", { ascending: true })
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

  const overdue = (packets ?? []).filter((row) =>
    isPacketOverdue(
      {
        status: row.status as "needs_completion" | "in_progress" | "completed",
        event_date: String(row.event_date),
        completion_optional: Boolean(row.completion_optional),
      },
      now,
    ),
  );

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
  const hrefs = overdue.map((row) => `/event-packets/${row.id}`);

  const { data: recent } = await supabase
    .from("hub_notifications")
    .select("href")
    .eq("kind", "packet_overdue")
    .gte("created_at", since)
    .in("href", hrefs);

  const already = new Set(
    (recent ?? []).map((row) => String(row.href ?? "")),
  );

  const rows = overdue
    .filter((row) => {
      const href = `/event-packets/${row.id}`;
      return !already.has(href) && Boolean(row.assignee_id);
    })
    .map((row) => {
      const client = String(row.client_name || "Event");
      const venue = String(row.venue_raw || "venue");
      return {
        userId: row.assignee_id as string,
        kind: "packet_overdue",
        title: "Event Packet overdue",
        body: `${client} · ${venue} · ${row.event_date} still needs completion.`,
        href: `/event-packets/${row.id}`,
      };
    });

  await insertNotifications(supabase, rows);

  return {
    ran: true,
    examined: overdue.length,
    notified: rows.length,
    skipped: overdue.length - rows.length,
    error: null,
  };
}
