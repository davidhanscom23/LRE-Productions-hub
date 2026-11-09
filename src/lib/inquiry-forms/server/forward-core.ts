/**
 * Inquiry Forms - routing and the one-way copy to LeadLeaf (GoHighLevel).
 *
 * PURE module (no server-only imports) so vitest pins every mapping. The hub CRM record is always
 * written first and stays the system of record; the copy only keeps LeadLeaf fed and is a switch
 * in the form's settings.
 *
 * Wire format: the "external_form_submission" event each website's own contact form posts to
 * backend.leadconnectorhq.com/external-tracking/events; answered 200 {"status":"ok"}.
 */
import { stripHidden } from "../answers";
import { findRoleField } from "../definition";
import type { Answers, CrmSummary, FormDefinition, FormSettings, GhlCopySettings } from "../types";
import { isValidEmail } from "../validation";

export const GHL_EVENTS_URL = "https://backend.leadconnectorhq.com/external-tracking/events";

/** A current desktop Chrome User-Agent, so the copy looks like the website's own form post. */
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/** Copies are retried by the sweep only this long after the inquiry was finished. */
export const COPY_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/** The owner email for this inquiry's event type choice, or null (no event type, no rule). */
export function ownerFor(
  settings: Pick<FormSettings, "ownerByEventType">,
  definition: FormDefinition,
  answers: Answers,
): string | null {
  const map = settings.ownerByEventType ?? {};
  if (Object.keys(map).length === 0) return null;
  const field = findRoleField(definition, "event_type");
  if (!field) return null;
  const raw = stripHidden(definition, answers)[field.key];
  const value = typeof raw === "string" ? raw : Array.isArray(raw) && typeof raw[0] === "string" ? raw[0] : "";
  if (!value || !Object.prototype.hasOwnProperty.call(map, value)) return null;
  const email = String(map[value]).trim().toLowerCase();
  return isValidEmail(email) ? email : null;
}

/** Form recipients plus the routed owner, lowercased, de-duplicated, at most 20. */
export function staffRecipients(formRecipients: string[], owner: string | null): string[] {
  const out: string[] = [];
  for (const r of [...formRecipients, ...(owner ? [owner] : [])]) {
    const e = String(r ?? "").trim().toLowerCase();
    if (e && isValidEmail(e) && !out.includes(e)) out.push(e);
  }
  return out.slice(0, 20);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** "Ann Lee Smith" -> ["Ann", "Lee Smith"]; a single word stays the first name. */
export function splitName(name: string | null): { first: string; last: string } {
  const parts = (name ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function cap(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

/** The text block the copy carries: who sent it, where it lives in the hub, every answer. */
export function copyNotes(input: { formName: string; hubLink: string | null; lines: string[]; max?: number }): string {
  const head = [`Website inquiry from the Hub's "${input.formName}" form.`];
  if (input.hubLink) head.push(`In the Hub: ${input.hubLink}`);
  return cap([...head, "", ...input.lines].join("\n"), input.max ?? 4000);
}

// ---------------------------------------------------------------------------
// GoHighLevel
// ---------------------------------------------------------------------------

/** Path of an http(s) URL ("/" when it has none or does not parse). */
function pathOf(url: string): string {
  const m = /^https?:\/\/[^/?#]+([^?#]*)/i.exec(url);
  return m && m[1] ? m[1] : "/";
}

/**
 * The external form event exactly as the website's own form posts it (same keys, labels, ids),
 * with the full answers in the notes key. `pageUrl` is the page the visitor was on when known.
 */
export function buildGhlPayload(input: {
  settings: GhlCopySettings;
  summary: CrmSummary;
  formName: string;
  hubLink: string | null;
  lines: string[];
  pageUrl: string | null;
  sessionId: string;
  now: Date;
}): Record<string, unknown> {
  const { settings: g, summary } = input;
  const { first, last } = splitName(summary.name);
  const formData: Record<string, string> = {
    first_name: first,
    last_name: last,
    email: summary.email ?? "",
    phone: summary.phone ?? "",
  };
  const formLabels: Record<string, string> = {
    first_name: "First Name",
    last_name: "Last Name",
    email: "Email",
    phone: "Phone Number",
  };
  if (summary.company) {
    formData.organization = summary.company;
    formLabels.organization = "Company Name";
  }
  if (g.eventTypeKey && summary.eventType) {
    formData[g.eventTypeKey] = summary.eventType;
    formLabels[g.eventTypeKey] = "Event Type";
  }
  if (g.servicesKey && summary.services.length > 0) {
    formData[g.servicesKey] = summary.services.join(", ");
    formLabels[g.servicesKey] = "Services Needed";
  }
  formData[g.notesKey] = copyNotes({ formName: input.formName, hubLink: input.hubLink, lines: input.lines });
  formLabels[g.notesKey] = g.notesLabel;

  const url = (input.pageUrl && /^https?:\/\//i.test(input.pageUrl) ? input.pageUrl : g.siteUrl) || "";
  return {
    type: "external_form_submission",
    timestamp: input.now.getTime(),
    formId: g.formId,
    formData,
    formLabels,
    url,
    title: input.formName,
    path: url ? pathOf(url) : "/",
    userAgent: BROWSER_USER_AGENT,
    trackingId: g.trackingId,
    locationId: g.locationId,
    sessionId: input.sessionId,
    properties: { deviceType: "desktop" },
  };
}

/** GoHighLevel answers an accepted event with 2xx and {"status":"ok"}. */
export function readGhlResult(status: number, body: string): { ok: boolean; reason: string } {
  if (status < 200 || status >= 300) return { ok: false, reason: `GoHighLevel answered ${status}: ${body.slice(0, 200)}` };
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  const st = parsed && typeof parsed === "object" ? (parsed as { status?: unknown }).status : undefined;
  if (st === undefined || st === "ok") return { ok: true, reason: `accepted (${status})` };
  return { ok: false, reason: `GoHighLevel answered ${status} with status ${JSON.stringify(st).slice(0, 80)}` };
}
