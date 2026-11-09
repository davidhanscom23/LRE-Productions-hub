/**
 * Extract a DJEP numeric event id from common ICS shapes:
 * - UID `EVENTID:146284`
 * - UID `146284@youreventplanningsite.com`
 * - DESCRIPTION line `Event ID: 146284` / `Event_ID: 146284`
 * - URL `...use_event=146284`
 */
export function extractDjepEventId(
  ...parts: Array<string | null | undefined>
): string | null {
  for (const part of parts) {
    if (!part?.trim()) continue;
    const text = part.trim();

    const fromEventIdToken = text.match(/EVENTID:(\d+)/i);
    if (fromEventIdToken) return fromEventIdToken[1]!;

    const fromUseEvent = text.match(/[?&]use_event=(\d+)\b/i);
    if (fromUseEvent) return fromUseEvent[1]!;

    const fromLabeledLine = text.match(
      /(?:^|\n)\s*Event[\s_]*ID\s*:\s*(\d+)\b/i,
    );
    if (fromLabeledLine) return fromLabeledLine[1]!;

    // Bare numeric UID (optionally with email-like host suffix).
    const bare = text.match(/^(\d{4,})(?:@\S+)?\s*$/);
    if (bare) return bare[1]!;
  }
  return null;
}

export function canonicalDjepCalendarUid(eventId: string): string {
  return `EVENTID:${eventId}`;
}
