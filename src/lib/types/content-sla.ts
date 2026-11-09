import type { PacketStatus } from "@/lib/types/event-packets";

export type ContentSlaDraftSummary = {
  total: number;
  draft: number;
  ready: number;
  pending_approval: number;
  posted: number;
  rejected: number;
  other: number;
};

export type ContentSlaRow = {
  id: string;
  event_date: string;
  client_name: string;
  venue_raw: string;
  status: PacketStatus;
  social_consent: boolean;
  hoursSinceEvent: number;
  mediaCount: number;
  drafts: ContentSlaDraftSummary;
};

export function formatDraftStatus(d: ContentSlaDraftSummary): string {
  if (d.total === 0) return "No drafts";
  const parts: string[] = [];
  if (d.posted) parts.push(`${d.posted} posted`);
  if (d.pending_approval) parts.push(`${d.pending_approval} pending`);
  if (d.ready) parts.push(`${d.ready} ready`);
  if (d.draft) parts.push(`${d.draft} draft`);
  if (d.rejected) parts.push(`${d.rejected} rejected`);
  if (d.other) parts.push(`${d.other} other`);
  return parts.join(" · ") || `${d.total} drafts`;
}
