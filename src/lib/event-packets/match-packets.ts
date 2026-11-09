import type { EventPacket } from "@/lib/types/event-packets";
import { formatPacketEventType } from "@/lib/event-packets/format-event-type";

/** Client-side filter for Event Packets lists (My packets + Tracking). */
export function packetMatchesQuery(packet: EventPacket, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    packet.client_name,
    packet.venue?.name,
    packet.venue_raw,
    packet.dj_name,
    packet.assignee?.full_name,
    packet.assignee?.email,
    packet.event_type,
    packet.event_type_other,
    formatPacketEventType(packet),
    packet.event_date,
    packet.follow_up_notes,
    packet.status,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase()
    .includes(q);
}
