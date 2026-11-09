import "server-only";

import type {
  ContentSlaDraftSummary,
  ContentSlaRow,
} from "@/lib/types/content-sla";
import type { PacketStatus } from "@/lib/types/event-packets";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { ContentSlaRow } from "@/lib/types/content-sla";

function hoursSince(eventDate: string): number {
  const start = new Date(`${eventDate}T00:00:00`);
  const ms = Date.now() - start.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60)));
}

function emptyDrafts(): ContentSlaDraftSummary {
  return {
    total: 0,
    draft: 0,
    ready: 0,
    pending_approval: 0,
    posted: 0,
    rejected: 0,
    other: 0,
  };
}

/**
 * Packets from the last ~21 days with media / consent / draft rollups for SLA.
 */
export async function loadContentSlaBoard(
  supabase: SupabaseClient,
  options?: { days?: number },
): Promise<{ rows: ContentSlaRow[]; error: string | null }> {
  const days = options?.days ?? 21;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceKey = since.toISOString().slice(0, 10);

  const { data: packets, error } = await supabase
    .from("event_packets")
    .select(
      "id, event_date, client_name, venue_raw, status, social_consent",
    )
    .gte("event_date", sinceKey)
    .order("event_date", { ascending: false })
    .limit(200);

  if (error) {
    return { rows: [], error: error.message };
  }

  const list = packets ?? [];
  const ids = list.map((p) => p.id as string);
  const mediaCounts = new Map<string, number>();
  const draftByPacket = new Map<string, ContentSlaDraftSummary>();

  if (ids.length > 0) {
    const [{ data: media }, { data: drafts }] = await Promise.all([
      supabase.from("event_media").select("packet_id").in("packet_id", ids),
      supabase
        .from("social_post_drafts")
        .select("packet_id, status")
        .in("packet_id", ids),
    ]);

    for (const row of media ?? []) {
      const key = row.packet_id as string;
      mediaCounts.set(key, (mediaCounts.get(key) ?? 0) + 1);
    }

    for (const row of drafts ?? []) {
      const key = row.packet_id as string;
      const summary = draftByPacket.get(key) ?? emptyDrafts();
      summary.total += 1;
      const status = String(row.status ?? "");
      if (status === "draft") summary.draft += 1;
      else if (status === "ready") summary.ready += 1;
      else if (status === "pending_approval") summary.pending_approval += 1;
      else if (status === "posted") summary.posted += 1;
      else if (status === "rejected") summary.rejected += 1;
      else summary.other += 1;
      draftByPacket.set(key, summary);
    }
  }

  const rows: ContentSlaRow[] = list.map((p) => {
    const id = p.id as string;
    return {
      id,
      event_date: String(p.event_date),
      client_name: (p.client_name as string) || "Untitled",
      venue_raw: (p.venue_raw as string) || "",
      status: p.status as PacketStatus,
      social_consent: Boolean(p.social_consent),
      hoursSinceEvent: hoursSince(String(p.event_date)),
      mediaCount: mediaCounts.get(id) ?? 0,
      drafts: draftByPacket.get(id) ?? emptyDrafts(),
    };
  });

  return { rows, error: null };
}
