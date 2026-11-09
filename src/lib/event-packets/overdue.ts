import type { EventPacket } from "@/lib/types/event-packets";

/** Incomplete packets become overdue the calendar day after the event. */
export function isPacketOverdue(
  packet: Pick<EventPacket, "status" | "event_date" | "completion_optional">,
  now = new Date(),
): boolean {
  if (packet.status === "completed") return false;
  // Archive / review-backfill packets are available but never overdue.
  if (packet.completion_optional) return false;
  const eventDay = new Date(`${packet.event_date}T12:00:00`);
  const cutoff = new Date(now);
  cutoff.setHours(12, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 1);
  return eventDay < cutoff;
}
