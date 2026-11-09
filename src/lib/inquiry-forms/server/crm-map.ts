/**
 * Inquiry Forms - Vident hub CRM mapping. PURE (row builders and counting rules; adapter.ts runs the
 * queries). Spec section 4: a finished inquiry becomes a honeybook_projects row at stage 'Inquiry'
 * (source_event 'web_form', shown with a Website badge on the board) linked to a honeybook_clients
 * row matched by exact lowercased email, plus one honeybook_project_stage_events row ('' to
 * 'Inquiry'). An existing client is never overwritten: the form only fills its blank name or phone.
 */
import { honeyBookStageMatchKey } from "@/lib/honeybook/pipeline-board";
import type { CrmSummary } from "../types";
import { normalizeEmail } from "./lifecycle-core";
import { isCalendarDate } from "./schema-core";

export { normalizeEmail };

/** honeybook_clients / honeybook_projects source_event of every row this module creates. */
export const WEB_FORM_SOURCE = "web_form";
/** The board's first column (HONEYBOOK_STAGE_HINTS[0]); Zapier inquiries and Hub "New project" use it too. */
export const INQUIRY_STAGE = "Inquiry";
/** honeybook_projects.details stays short: Proposals appends Drive links to it (8000 character cap). */
export const PROJECT_DETAILS_MAX = 3500;
/** Unique violation (honeybook_clients_email_uidx on lower(email)). */
export const UNIQUE_VIOLATION = "23505";

const NAME_MAX = 200;
const PHONE_MAX = 40;
const TEXT_MAX = 500;
const PROJECT_NAME_MAX = 300;
/** numeric(12,2): at most 10 digits before the point. */
const BUDGET_MAX = 9_999_999_999.99;
/** The name buildCrmSummary uses when the visitor gave nothing at all. */
const NO_NAME = "Website inquiry";

function clean(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : null;
}

function blank(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim() === "";
}

/**
 * Escape ILIKE wildcards so `.ilike("email", x)` is an exact, case-insensitive match. Only used as a
 * fallback for an older client row whose email is not stored lowercased.
 */
export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * The visitor's own name. buildCrmSummary falls back to the company, email or phone when the name
 * is empty; those never go into a person's name on an existing client.
 */
export function personName(summary: CrmSummary): string | null {
  const name = clean(summary.name, NAME_MAX);
  if (!name || name === NO_NAME) return null;
  const others = [summary.company, summary.email, summary.phone].map((v) => clean(v, NAME_MAX)?.toLowerCase());
  return others.includes(name.toLowerCase()) ? null : name;
}

export interface ClientInsert {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  source_event: typeof WEB_FORM_SOURCE;
  raw: { submission_id: string };
}

/** A new honeybook_clients row (full_name is never blank: the summary name has fallbacks). */
export function buildClientInsert(summary: CrmSummary, submissionId: string): ClientInsert {
  return {
    full_name: clean(summary.name, NAME_MAX) ?? NO_NAME,
    email: normalizeEmail(summary.email) ?? "",
    phone: clean(summary.phone, PHONE_MAX) ?? "",
    address: "",
    source_event: WEB_FORM_SOURCE,
    raw: { submission_id: submissionId },
  };
}

export interface ExistingClient {
  id: string;
  full_name: string | null;
  phone: string | null;
  /** Who made the row ("web_form" = an earlier website inquiry; HoneyBook sync rows say otherwise). */
  source_event: string | null;
}

/**
 * Fill blanks only: the columns an anonymous form may set on a client the CRM already has (a blank
 * name or phone). null = nothing to change. Everything else on the row stays as it is. Only on a
 * client an earlier website inquiry made: the visitor's email is not verified, so a stranger who knows
 * a real client's address must never plant a phone or name on that record. The visitor's name and
 * phone still reach staff in the project details.
 */
export function clientBlankFills(existing: ExistingClient, summary: CrmSummary): { full_name?: string; phone?: string } | null {
  if (existing.source_event !== WEB_FORM_SOURCE) return null;
  const fills: { full_name?: string; phone?: string } = {};
  const name = personName(summary);
  if (blank(existing.full_name) && name) fills.full_name = name;
  const phone = clean(summary.phone, PHONE_MAX);
  if (blank(existing.phone) && phone) fills.phone = phone;
  return Object.keys(fills).length > 0 ? fills : null;
}

/** "Jane Smith - Corporate Event"; without an event type "Jane Smith - Website inquiry". */
export function projectName(summary: CrmSummary): string {
  const who = clean(summary.name, NAME_MAX) ?? NO_NAME;
  const what = clean(summary.eventType, NAME_MAX);
  const name = what ? `${who} - ${what}` : who === NO_NAME ? NO_NAME : `${who} - ${NO_NAME}`;
  return name.slice(0, PROJECT_NAME_MAX);
}

/** honeybook_projects.budget: the tier's low bound or the amount, when it fits numeric(12,2). */
export function toBudget(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > BUDGET_MAX) return null;
  return Math.round(value * 100) / 100;
}

/**
 * honeybook_projects.details: names the form (and a waitlist or unfinished inquiry), the one-line
 * qualification summary, then every answer as "Label: value". At most PROJECT_DETAILS_MAX characters.
 */
export function buildProjectDetails(input: {
  formName: string;
  ending: CrmSummary["ending"];
  summaryLine: string;
  lines: string[];
}): string {
  const note =
    input.ending === "waitlisted"
      ? " - joined the waitlist for this date"
      : input.ending === "partial"
        ? " - unfinished, added by staff"
        : "";
  const head = `Website form: ${input.formName}${note}`;
  const body = [head, input.summaryLine, "", ...input.lines].join("\n");
  return body.length > PROJECT_DETAILS_MAX ? `${body.slice(0, PROJECT_DETAILS_MAX - 3)}...` : body;
}

export interface ProjectInsert {
  name: string;
  stage: typeof INQUIRY_STAGE;
  client_id: string | null;
  project_type: string;
  project_date: string | null;
  budget: number | null;
  location: string;
  details: string;
  source_event: typeof WEB_FORM_SOURCE;
  raw: { form_slug: string; submission_id: string };
}

/** The new honeybook_projects row (external_id stays NULL: the project was made in the Hub). */
export function buildProjectInsert(input: {
  summary: CrmSummary;
  clientId: string | null;
  details: string;
  formSlug: string;
  submissionId: string;
}): ProjectInsert {
  const s = input.summary;
  return {
    name: projectName(s),
    stage: INQUIRY_STAGE,
    client_id: input.clientId,
    project_type: clean(s.eventType, NAME_MAX) ?? "",
    project_date: isCalendarDate(s.eventDate) ? s.eventDate : null,
    budget: toBudget(s.budgetLow),
    location: clean(s.eventLocation, TEXT_MAX) ?? "",
    details: input.details,
    source_event: WEB_FORM_SOURCE,
    raw: { form_slug: input.formSlug, submission_id: input.submissionId },
  };
}

/** Same shape as the Hub "New project" history row (no person changed it: the website did). */
export function buildStageEventInsert(projectId: string): {
  project_id: string;
  from_stage: string;
  to_stage: typeof INQUIRY_STAGE;
  changed_by: null;
} {
  return { project_id: projectId, from_stage: "", to_stage: INQUIRY_STAGE, changed_by: null };
}

// ---------------------------------------------------------------------------
// Committed work on a date (adapter.bookingsOn). The hub runs the date check in "open" mode (no
// capacity number exists), so this count feeds reporting and any later "bookings" mode only.
// ---------------------------------------------------------------------------

/** Stage keys (honeyBookStageMatchKey) that mean the date is taken: _BOOKED_, _RETAINER_PAID_, ... */
export const COMMITTED_STAGE_KEYS: ReadonlySet<string> = new Set(["booked", "retainer paid", "paid in full", "planning", "in progress"]);
/** Stages that release the date even when the project was once booked (booked_at stays set). */
export const RELEASED_STAGE_KEYS: ReadonlySet<string> = new Set(["lost", "archived", "cancelled", "canceled", "not booked"]);

export interface ProjectDayRow {
  id: string;
  stage: string | null;
  booked_at: string | null;
  project_date: string | null;
}

/** Committed work: a booked-type stage, or booked_at set while the project is not lost or archived. */
export function isCommittedProject(row: Pick<ProjectDayRow, "stage" | "booked_at">): boolean {
  const key = honeyBookStageMatchKey(row.stage);
  if (COMMITTED_STAGE_KEYS.has(key)) return true;
  return !blank(row.booked_at) && !RELEASED_STAGE_KEYS.has(key);
}

/** Committed projects on the New York date (project_date is a wall-calendar date; counted once by id). */
export function countCommittedOn(rows: ProjectDayRow[], date: string): number {
  const seen = new Set<string>();
  let count = 0;
  for (const row of rows) {
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    if ((row.project_date ?? "").slice(0, 10) === date && isCommittedProject(row)) count += 1;
  }
  return count;
}

/**
 * People who can work the date (capacity source "staff"): people in the departments minus approved
 * time off. null = nobody to count. Only used if an admin switches the date check to bookings.
 */
export function capacityFromPeople(peopleIds: string[], offIds: string[]): number | null {
  const people = new Set(peopleIds.filter(Boolean));
  if (people.size === 0) return null;
  const off = new Set(offIds.filter((id) => people.has(id)));
  return people.size - off.size;
}
