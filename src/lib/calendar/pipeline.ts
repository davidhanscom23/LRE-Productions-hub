import type { CalendarEvent } from "@/lib/calendar/events";
import { eventDayKey } from "@/lib/calendar/format";

export type PipelineCalendarRow = {
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
 * Map Pipeline projects with a project_date onto CalendarEvents (all-day).
 * Same noon-UTC pattern as Hub time off so day keys stay stable in ET.
 */
export function pipelineProjectsToEvents(
  rows: PipelineCalendarRow[],
): CalendarEvent[] {
  return (rows ?? [])
    .filter((r) => Boolean(r.project_date && /^\d{4}-\d{2}-\d{2}/.test(r.project_date)))
    .map((r) => crmRowToEvent(r));
}

function crmRowToEvent(r: PipelineCalendarRow): CalendarEvent {
  const date = (r.project_date as string).slice(0, 10);
  const client = (r.client_name ?? "").trim() || null;
  const type = (r.project_type ?? "").trim() || null;
  const projectName = r.name.trim() || "Pipeline project";
  // Prefer "Client · Project" when both differ; otherwise just the project name.
  const title =
    client && client !== projectName
      ? `${client} · ${projectName}`
      : projectName;

  return {
    uid: `pipeline-${r.id}`,
    source: "pipeline",
    title,
    start: `${date}T12:00:00Z`,
    end: `${date}T12:00:00Z`,
    allDay: true,
    status: (r.stage ?? "").trim() || "Pipeline",
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
    // Don't deep-link to /pipeline here — that module is admin-only.
    eventUrl: null,
    descriptionStartTime: null,
    descriptionEndTime: null,
  };
}
