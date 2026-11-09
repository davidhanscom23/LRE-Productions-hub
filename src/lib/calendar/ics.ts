/**
 * Minimal RFC 5545 iCalendar builder for the per-staff subscription feed.
 * Produces a VCALENDAR of the events assigned to one staff member, which Google
 * Calendar ("From URL") and Apple Calendar ("New Calendar Subscription") can
 * subscribe to. Read-only — subscribers can view but never edit hub data.
 */

export type IcsEvent = {
  uid: string;
  title: string;
  start: string; // ISO
  end: string | null; // ISO
  allDay: boolean;
  location?: string | null;
  description?: string | null;
  url?: string | null;
};

function escapeText(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold lines to <=74 octets per RFC 5545; continuation lines start with a space. */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const out: string[] = [line.slice(0, 74)];
  let rest = line.slice(74);
  while (rest.length > 73) {
    out.push(" " + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  if (rest.length) out.push(" " + rest);
  return out.join("\r\n");
}

function stampUTC(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function dateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function eventBlock(e: IcsEvent, dtstamp: string): string[] {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(`UID:${escapeText(e.uid)}`);
  lines.push(`DTSTAMP:${dtstamp}`);

  const start = new Date(e.start);
  if (Number.isNaN(start.getTime())) return []; // skip unparseable

  if (e.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(start)}`);
    const end = e.end ? new Date(e.end) : new Date(start.getTime() + 86400000);
    lines.push(`DTEND;VALUE=DATE:${dateOnly(end)}`);
  } else {
    lines.push(`DTSTART:${stampUTC(start)}`);
    const end =
      e.end && !Number.isNaN(new Date(e.end).getTime())
        ? new Date(e.end)
        : new Date(start.getTime() + 3 * 3600 * 1000); // default 3h
    lines.push(`DTEND:${stampUTC(end)}`);
  }

  lines.push(`SUMMARY:${escapeText(e.title || "Event")}`);
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  if (e.url) lines.push(`URL:${escapeText(e.url)}`);
  lines.push("END:VEVENT");
  return lines;
}

/** Build a full VCALENDAR document (CRLF-terminated, folded) for a subscription. */
export function buildIcs(events: IcsEvent[], calendarName: string): string {
  const dtstamp = stampUTC(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vident Productions Hub//Staff Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "X-PUBLISHED-TTL:PT30M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
  ];
  for (const e of events) lines.push(...eventBlock(e, dtstamp));
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
