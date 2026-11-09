/** Label for event type; when Other, use only the free-text description. */
export function formatEventTypeLabel(input: {
  event_type: string;
  event_type_other?: string | null;
}): string {
  const type = input.event_type?.trim() || "Other";
  const other = input.event_type_other?.trim() ?? "";
  if (type === "Other" && other) return other;
  return type;
}

/** @deprecated Prefer formatEventTypeLabel */
export function formatPacketEventType(packet: {
  event_type: string;
  event_type_other?: string | null;
}): string {
  return formatEventTypeLabel(packet);
}
