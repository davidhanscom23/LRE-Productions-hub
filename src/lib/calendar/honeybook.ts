import type { CalendarEvent } from "@/lib/calendar/events";
import { eventDayKey } from "@/lib/calendar/format";

export type HoneyBookCalendarRow = {
  id: string;
  name: string;
  stage: string;
  project_type: string;
  project_date: string | null;
  location: string;
  client_id: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
};

/**
 * Map HoneyBook projects with a project_date onto CalendarEvents (all-day).
 * Same noon-UTC pattern as Hub time off so day keys stay stable in ET.
 */
export function honeybookProjectsToEvents(
  rows: HoneyBookCalendarRow[],
): CalendarEvent[] {
  return (rows ?? [])
    .filter((r) => Boolean(r.project_date && /^\d{4}-\d{2}-\d{2}/.test(r.project_date)))
    .map((r) => crmRowToEvent(r));
}

function crmRowToEvent(r: HoneyBookCalendarRow): CalendarEvent {
  const date = (r.project_date as string).slice(0, 10);
  const client = (r.client_name ?? "").trim() || null;
  const type = (r.project_type ?? "").trim() || null;
  const projectName = r.name.trim() || "HoneyBook project";
  // Prefer "Client · Project" when both differ; otherwise just the project name.
  const title =
    client && client !== projectName
      ? `${client} · ${projectName}`
      : projectName;

  return {
    uid: `honeybook-${r.id}`,
    source: "honeybook",
    title,
    start: `${date}T12:00:00Z`,
    end: `${date}T12:00:00Z`,
    allDay: true,
    status: (r.stage ?? "").trim() || "HoneyBook",
    eventType: type,
    assignedStaff: null,
    crmProjectId: r.id,
    venue: (r.location ?? "").trim() || null,
    clientName: client,
    organization: null,
    clientContact: null,
    clientPhone: (r.client_phone ?? "").trim() || null,
    clientEmail: (r.client_email ?? "").trim() || null,
    relatedFiles: [],
    planningFormUrl: null,
    // Don't deep-link to /honeybook here — that module is admin-only.
    eventUrl: null,
    descriptionStartTime: null,
    descriptionEndTime: null,
  };
}

function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeMatchText(value)
      .split(" ")
      .filter((token) => token.length > 1),
  );
}

/** 0–1 overlap score between two freeform titles / names. */
export function honeybookNameOverlapScore(a: string, b: string): number {
  const left = normalizeMatchText(a);
  const right = normalizeMatchText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    const shorter = Math.min(left.length, right.length);
    const longer = Math.max(left.length, right.length);
    return Math.max(0.72, shorter / longer);
  }

  const aTokens = tokenSet(left);
  const bTokens = tokenSet(right);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let shared = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) shared += 1;
  }
  return shared / Math.max(aTokens.size, bTokens.size);
}

function crmMatchCandidates(row: HoneyBookCalendarRow): string[] {
  const projectName = (row.name ?? "").trim();
  const client = (row.client_name ?? "").trim();
  const out = [projectName];
  if (client) {
    out.push(client);
    if (projectName) {
      out.push(`${client} ${projectName}`);
      out.push(`${client} · ${projectName}`);
      out.push(`${client} - ${projectName}`);
    }
  }
  return out.filter(Boolean);
}

/**
 * Score how well an iCal event matches a CRM project row (same-day required).
 * Day comparison uses America/New_York (LRE events are timed, not all-day).
 * Returns 0 when the day differs or names do not overlap enough.
 */
export function scoreHoneybookIcalCrmMatch(
  event: CalendarEvent,
  row: HoneyBookCalendarRow,
): number {
  const crmDate = (row.project_date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(crmDate)) return 0;
  if (eventDayKey(event.start) !== crmDate) return 0;

  let best = 0;
  for (const candidate of crmMatchCandidates(row)) {
    best = Math.max(best, honeybookNameOverlapScore(event.title, candidate));
  }
  if (row.location?.trim() && event.venue?.trim()) {
    const loc = honeybookNameOverlapScore(event.venue, row.location);
    if (loc >= 0.7) best = Math.min(1, best + 0.08);
  }
  return best;
}

const MATCH_THRESHOLD = 0.45;

/**
 * Enrich a live HoneyBook→Google iCal event with CRM fields.
 * Status / stage always comes from Zapier CRM when matched — never keep the
 * ICS STATUS (CONFIRMED, etc.). Timing and event URL stay from iCal.
 */
export function enrichHoneybookIcalEventFromCrm(
  event: CalendarEvent,
  row: HoneyBookCalendarRow,
): CalendarEvent {
  const crm = crmRowToEvent(row);
  const client = crm.clientName;
  const projectName = (row.name ?? "").trim();

  // Prefer CRM "Client · Project" when iCal title is thin or matches the
  // project/client alone; keep a richer Google title otherwise.
  const titleNorm = normalizeMatchText(event.title);
  const preferCrmTitle =
    !titleNorm ||
    (projectName && titleNorm === normalizeMatchText(projectName)) ||
    (client && titleNorm === normalizeMatchText(client)) ||
    honeybookNameOverlapScore(event.title, crm.title) >= 0.85;

  return {
    ...event,
    source: "honeybook",
    title: preferCrmTitle ? crm.title : event.title,
    // Required: Zapier/CRM stage wins over ICS STATUS.
    status: crm.status,
    crmProjectId: row.id,
    eventType: crm.eventType ?? event.eventType,
    venue: event.venue?.trim() || crm.venue,
    clientName: crm.clientName ?? event.clientName,
    clientPhone: crm.clientPhone ?? event.clientPhone,
    clientEmail: crm.clientEmail ?? event.clientEmail,
    // Keep iCal deep link when present.
    eventUrl: event.eventUrl ?? crm.eventUrl,
  };
}

export type MergeHoneybookIcalWithCrmResult = {
  events: CalendarEvent[];
  matchedCrmIds: string[];
};

/**
 * Merge live HoneyBook iCal events with CRM project rows:
 * - Matched iCal events are enriched (CRM status/client/type/…).
 * - Unmatched CRM dated projects remain as date-only overlay events.
 * - Unmatched iCal events stay as-is.
 */
export function mergeHoneybookIcalWithCrm(
  icalEvents: CalendarEvent[],
  crmRows: HoneyBookCalendarRow[],
): MergeHoneybookIcalWithCrmResult {
  const datedCrm = (crmRows ?? []).filter((r) =>
    Boolean(r.project_date && /^\d{4}-\d{2}-\d{2}/.test(r.project_date)),
  );

  const honeybookIcal = icalEvents.filter((e) => e.source === "honeybook");
  const otherIcal = icalEvents.filter((e) => e.source !== "honeybook");

  const usedCrmIds = new Set<string>();
  const mergedHoneybook: CalendarEvent[] = [];

  for (const event of honeybookIcal) {
    let bestRow: HoneyBookCalendarRow | null = null;
    let bestScore = 0;
    for (const row of datedCrm) {
      if (usedCrmIds.has(row.id)) continue;
      const score = scoreHoneybookIcalCrmMatch(event, row);
      if (score > bestScore) {
        bestScore = score;
        bestRow = row;
      }
    }

    if (bestRow && bestScore >= MATCH_THRESHOLD) {
      usedCrmIds.add(bestRow.id);
      mergedHoneybook.push(enrichHoneybookIcalEventFromCrm(event, bestRow));
    } else {
      mergedHoneybook.push(event);
    }
  }

  const unmatchedCrm = datedCrm
    .filter((row) => !usedCrmIds.has(row.id))
    .map((row) => crmRowToEvent(row));

  const events = [...otherIcal, ...mergedHoneybook, ...unmatchedCrm].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return {
    events,
    matchedCrmIds: Array.from(usedCrmIds),
  };
}
