/** Day-of reference checklist for Wedding Event Packets (informational). */
export const WEDDING_DAY_OF_CHECKLIST = [
  "Confirm ceremony / cocktail / reception start times with planner",
  "Check power, rain plan, and vendor meal windows",
  "Mic check: officiant, vows, toasts",
  "Confirm playlist contact and special dances",
  "Capture memorable moment notes during the event",
  "Before leaving: client feedback prompt + photo consent reminder",
] as const;

export function isWeddingEventType(eventType: string | null | undefined): boolean {
  return (eventType ?? "").trim().toLowerCase() === "wedding";
}
