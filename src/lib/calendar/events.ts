import { createHash } from "crypto";
import { unstable_cache } from "next/cache";
import ical, { type VEvent } from "node-ical";
import {
  canonicalCalendarUid,
  extractExternalEventId,
} from "@/lib/calendar/external-event-id";

export type CalendarRelatedFile = {
  /** Display title from planner Related Files (e.g. "Planning Form"). */
  title: string;
  url: string;
};

export type CalendarEvent = {
  uid: string;
  /**
   * "work" = planner company/staff feed.
   * "timeoff" = approved staff time off.
   * "pipeline" = CRM projects (dated projects overlaid on the calendar).
   */
  source: "work" | "timeoff" | "pipeline";
  /** Display title: Client Name + Event Type */
  title: string;
  /** ISO DTSTART (UTC) — use for calendar placement */
  start: string;
  /** ISO DTEND (UTC), if present */
  end: string | null;
  allDay: boolean;
  status: string | null;
  eventType: string | null;
  assignedStaff: string | null;
  /**
   * Hub-assigned profile ids for this event (calendar_event_assignments).
   * Used by the event detail assignee editor; names are also in assignedStaff.
   */
  assignedProfileIds?: string[];
  /** Pipeline board project id when this event is backed by a CRM card (board staff sync into the calendar). */
  crmProjectId?: string | null;
  venue: string | null;
  clientName: string | null;
  organization: string | null;
  /** Freeform client contact line from planner DESCRIPTION, if present. */
  clientContact: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  /**
   * Links from planner DESCRIPTION when present (Related Files title+URL, or an
   * Event Planning field that contains a URL). Real planner feeds often export
   * `Event Planning:` with an empty value — planning forms live in planner, not
   * as iCal links.
   */
  relatedFiles: CalendarRelatedFile[];
  /** Prefer a planning-titled link / Event Planning URL when the feed has one. */
  planningFormUrl: string | null;
  /** Generic event URL from VEVENT, or built from planner UID EVENTID + feed host. */
  eventUrl: string | null;
  /** Wall-clock times from DESCRIPTION (e.g. "4:00 PM") */
  descriptionStartTime: string | null;
  descriptionEndTime: string | null;
};

export const COMPANY_ICAL_SETTING_KEY = "company_ical_url";
/** Google Calendar (or other) iCal URL for the shared team calendar. */
export const WORK_ICAL_SETTING_KEY = "work_ical_url";

const CACHE_SECONDS = 15 * 60;

type DescriptionFields = {
  eventStartTime: string | null;
  eventEndTime: string | null;
  status: string | null;
  venue: string | null;
  clientName: string | null;
  organization: string | null;
  clientContact: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  relatedFiles: CalendarRelatedFile[];
  planningFormUrl: string | null;
};

type SummaryFields = {
  date: string | null;
  status: string | null;
  eventType: string | null;
  assignedStaff: string | null;
};

function parameterText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (
    value &&
    typeof value === "object" &&
    "val" in value &&
    typeof (value as { val: unknown }).val === "string"
  ) {
    const trimmed = (value as { val: string }).val.trim();
    return trimmed || null;
  }
  return null;
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Pull the first http(s) URL out of a DESCRIPTION value (or accept a bare URL). */
export function extractHttpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).toString();
    } catch {
      return null;
    }
  }
  const match = trimmed.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  try {
    return new URL(match[0].replace(/[),.;]+$/, "")).toString();
  } catch {
    return null;
  }
}

/** Collect every http(s) URL in a block of text. */
export function extractAllHttpUrls(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  const matches = value.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  const urls: string[] = [];
  for (const raw of matches) {
    try {
      urls.push(new URL(raw.replace(/[),.;]+$/, "")).toString());
    } catch {
      // skip malformed
    }
  }
  return urls;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
/** US-leaning phone patterns (with optional +1 / punctuation). */
const PHONE_RE =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/;

export function extractEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(EMAIL_RE);
  return match ? match[0] : null;
}

export function extractPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  // Avoid matching pure times like 4:00 by requiring enough digits.
  const match = value.match(PHONE_RE);
  if (!match) return null;
  const digits = match[0].replace(/\D/g, "");
  if (digits.length < 10) return null;
  return match[0].trim();
}

function isPlanningFormUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("planningform") ||
    lower.includes("planning-form") ||
    lower.includes("planning_form") ||
    lower.includes("planningforms") ||
    (lower.includes("djeventplanner") && lower.includes("planning")) ||
    (lower.includes("eventplanner") && lower.includes("form"))
  );
}

function isPlanningFormTitle(title: string | null | undefined): boolean {
  if (!title?.trim()) return false;
  const t = title.toLowerCase();
  return (
    t.includes("event planning") ||
    t.includes("planning form") ||
    t.includes("planning forms") ||
    /\bplanning\b/.test(t)
  );
}

function pickPlanningFormUrl(
  files: CalendarRelatedFile[],
  urls: string[] = [],
): string | null {
  const fromTitle = files.find((f) => isPlanningFormTitle(f.title));
  if (fromTitle) return fromTitle.url;
  const fromFileUrl = files.find((f) => isPlanningFormUrl(f.url));
  if (fromFileUrl) return fromFileUrl.url;
  return urls.find(isPlanningFormUrl) ?? null;
}

function isRelatedFilesLabel(normalized: string): boolean {
  return (
    normalized === "related files" ||
    normalized === "related file" ||
    normalized.includes("related file") ||
    normalized === "attached files" ||
    normalized === "attached file" ||
    normalized === "attachments" ||
    normalized === "attachment" ||
    normalized === "event files" ||
    normalized === "files"
  );
}

/**
 * planner iCal detail label for planning. Live feeds use plain "Event Planning:"
 * (often empty). Older/alternate configs may use "Event Planning #N".
 */
export function isEventPlanningLabel(normalized: string): boolean {
  return (
    normalized === "event planning" ||
    /^event planning\s+\d+$/.test(normalized) ||
    normalized.startsWith("event planning ") ||
    normalized.includes("event planning form")
  );
}

type ContactSection = "root" | "venue" | "client";

/** Detect planner DESCRIPTION section headers (usually no trailing value). */
export function contactSectionFromLine(line: string): ContactSection | null {
  const normalized = normalizeLabel(line.replace(/-+/g, " "));
  if (!normalized) return null;
  if (
    normalized === "client contact information" ||
    normalized === "client contact info" ||
    normalized.startsWith("client contact information")
  ) {
    return "client";
  }
  if (
    normalized === "venue contact information" ||
    normalized === "venue contact info" ||
    normalized.startsWith("venue contact information")
  ) {
    return "venue";
  }
  return null;
}

function isJunkContactValue(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  const v = value.trim().toLowerCase();
  return v === "na" || v === "n/a" || v === "none" || v === "-" || v === "tbd";
}

/**
 * Prefer client Cell → Work → Home phones. Ignore fax / venue office numbers.
 */
export function pickClientPhone(
  entries: { key: string; value: string }[],
): string | null {
  const preference = [
    "client cell phone",
    "client cell",
    "client mobile",
    "cell phone",
    "mobile phone",
    "client work phone",
    "work phone",
    "client home phone",
    "home phone",
    "client phone",
    "contact phone",
    "contact cell",
    "telephone",
    "phone",
  ];
  const blocked = /(fax|office)/i;

  for (const needle of preference) {
    for (const entry of entries) {
      if (blocked.test(entry.key)) continue;
      if (isJunkContactValue(entry.value)) continue;
      if (entry.key === needle || entry.key.includes(needle)) {
        return blankToNull(entry.value);
      }
    }
  }
  return null;
}

/** Prefer client `Email:` over venue `Email Address:`. */
export function pickClientEmail(
  entries: { key: string; value: string }[],
): string | null {
  const preference = [
    "client email",
    "client e mail",
    "email",
    "e mail",
    "contact email",
    "contact e mail",
    "email address",
  ];

  for (const needle of preference) {
    for (const entry of entries) {
      if (isJunkContactValue(entry.value)) continue;
      // Exact key match first so "email" wins over "email address".
      if (entry.key === needle) {
        return extractEmail(entry.value) || blankToNull(entry.value);
      }
    }
    for (const entry of entries) {
      if (isJunkContactValue(entry.value)) continue;
      if (entry.key.includes(needle)) {
        return extractEmail(entry.value) || blankToNull(entry.value);
      }
    }
  }
  return null;
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtml(value: string): string {
  return decodeBasicEntities(value.replace(/<[^>]+>/g, " ")).replace(
    /\s+/g,
    " ",
  ).trim();
}

function pushRelatedFile(
  files: CalendarRelatedFile[],
  title: string | null | undefined,
  url: string | null | undefined,
) {
  const cleanUrl = extractHttpUrl(url);
  if (!cleanUrl) return;
  if (files.some((f) => f.url === cleanUrl)) return;
  const cleanTitle = blankToNull(stripHtml(title ?? "")) || "Related file";
  files.push({ title: cleanTitle, url: cleanUrl });
}

/**
 * Parse one Related Files value that may contain title + URL in common planner
 * shapes: "Title - https://…", "Title|https://…", HTML anchors, or bare URL.
 */
export function parseRelatedFileValue(
  value: string | null | undefined,
  fallbackTitle = "Related file",
): CalendarRelatedFile[] {
  if (!value?.trim()) return [];
  const decoded = decodeBasicEntities(value.trim());
  const files: CalendarRelatedFile[] = [];

  // HTML anchors: <a href="URL">Title</a>
  const anchorRe = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let anchorMatch: RegExpExecArray | null;
  while ((anchorMatch = anchorRe.exec(decoded))) {
    pushRelatedFile(files, stripHtml(anchorMatch[2]), anchorMatch[1]);
  }
  if (files.length > 0) return files;

  // Split on common multi-file separators.
  const chunks = decoded
    .split(/\s*;\s*|\n+/)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const urls = extractAllHttpUrls(chunk);
    if (urls.length === 0) continue;
    if (urls.length === 1) {
      const title = stripHtml(
        chunk
          .replace(urls[0], " ")
          .replace(/[-–—|:]+/g, " ")
          .replace(/\(\s*\)/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      );
      pushRelatedFile(files, title || fallbackTitle, urls[0]);
      continue;
    }
    // Multiple URLs in one chunk — keep titles empty-ish.
    for (const url of urls) {
      pushRelatedFile(files, fallbackTitle, url);
    }
  }

  return files;
}

/** True when a DESCRIPTION line is a bare URL (not Label: value). */
function isBareUrlLine(line: string): boolean {
  const trimmed = line.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  // "https" alone before : would be weird; require the rest looks like a URL.
  try {
    new URL(trimmed.split(/\s+/)[0].replace(/[),.;]+$/, ""));
    return true;
  } catch {
    return false;
  }
}

function labelKeyFromLine(line: string): string | null {
  const colon = line.indexOf(":");
  if (colon <= 0) return null;
  const label = line.slice(0, colon).trim();
  if (/^https?$/i.test(label)) return null;
  return normalizeLabel(label);
}

/**
 * Walk DESCRIPTION lines and collect planner Related Files / Event Planning
 * fields (title + URL), including multi-line label + URL-on-next-line.
 */
export function parseRelatedFilesFromDescription(
  description: string | null,
): CalendarRelatedFile[] {
  if (!description?.trim()) return [];

  const normalized = description
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",");

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const files: CalendarRelatedFile[] = [];
  let pendingTitle: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isBareUrlLine(line)) {
      pushRelatedFile(files, pendingTitle, line);
      pendingTitle = null;
      continue;
    }

    const key = labelKeyFromLine(line);
    if (!key) {
      // Unlabeled HTML anchors on their own line under a pending title.
      const loose = parseRelatedFileValue(line, pendingTitle ?? "Related file");
      if (loose.length > 0) {
        for (const file of loose) pushRelatedFile(files, file.title, file.url);
        pendingTitle = null;
      }
      continue;
    }
    const colon = line.indexOf(":");
    const originalLabel = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();

    if (isEventPlanningLabel(key)) {
      // e.g. "Event Planning #3: https://…" or URL on the next line.
      const urls = extractAllHttpUrls(value);
      if (urls.length > 0) {
        for (const url of urls) pushRelatedFile(files, originalLabel, url);
        pendingTitle = null;
      } else {
        const parsed = parseRelatedFileValue(value, originalLabel);
        if (parsed.length > 0) {
          for (const file of parsed) {
            pushRelatedFile(files, originalLabel, file.url);
          }
          pendingTitle = null;
        } else {
          pendingTitle = originalLabel;
        }
      }
      continue;
    }

    if (isRelatedFilesLabel(key)) {
      const parsed = parseRelatedFileValue(value, "Related file");
      if (parsed.length > 0) {
        for (const file of parsed) pushRelatedFile(files, file.title, file.url);
        pendingTitle = null;
      } else if (value) {
        // "Related Files: Planning Form" with URL on a following line.
        pendingTitle = stripHtml(value) || "Related file";
      } else {
        pendingTitle = "Related file";
      }
      continue;
    }

    // A following labeled line ends the pending related-file title wait,
    // unless this line itself embeds a URL with a planning-ish title.
    if (pendingTitle) {
      const embedded = parseRelatedFileValue(value, pendingTitle);
      if (embedded.length > 0) {
        for (const file of embedded) pushRelatedFile(files, file.title, file.url);
        pendingTitle = null;
        continue;
      }
      pendingTitle = null;
    }
  }

  // Catch any HTML anchors elsewhere in the DESCRIPTION.
  for (const file of parseRelatedFileValue(normalized, "Related file")) {
    pushRelatedFile(files, file.title, file.url);
  }

  return files;
}

function extractAttachFiles(attach: unknown): CalendarRelatedFile[] {
  const files: CalendarRelatedFile[] = [];

  const consume = (item: unknown) => {
    if (typeof item === "string") {
      pushRelatedFile(files, "Related file", item);
      return;
    }
    if (!item || typeof item !== "object") return;
    const obj = item as {
      val?: unknown;
      params?: Record<string, unknown>;
    };
    const url = parameterText(obj.val) || parameterText(item);
    const params = obj.params ?? {};
    const title =
      parameterText(params.FILENAME) ||
      parameterText(params.filename) ||
      parameterText(params.X_FILENAME) ||
      parameterText(params["X-FILENAME"]) ||
      null;
    pushRelatedFile(files, title, url);
  };

  if (Array.isArray(attach)) {
    for (const item of attach) consume(item);
  } else if (attach != null) {
    consume(attach);
  }

  return files;
}

function mergeRelatedFiles(
  ...groups: CalendarRelatedFile[][]
): CalendarRelatedFile[] {
  const out: CalendarRelatedFile[] = [];
  for (const group of groups) {
    for (const file of group) pushRelatedFile(out, file.title, file.url);
  }
  return out;
}

function labelMatches(normalized: string, needles: string[]): boolean {
  return needles.some(
    (needle) => normalized === needle || normalized.includes(needle),
  );
}

/**
 * planner SUMMARY is " - "-separated:
 * date - status - event type - assigned staff - (start - end) - venue - client [- org]
 * Only take the first four parts (they never contain " - " themselves).
 */
export function parseFeedSummary(summary: string | null): SummaryFields {
  const empty: SummaryFields = {
    date: null,
    status: null,
    eventType: null,
    assignedStaff: null,
  };
  if (!summary?.trim()) return empty;

  const parts = summary.split(" - ").map((part) => part.trim());
  return {
    date: blankToNull(parts[0]),
    status: blankToNull(parts[1]),
    eventType: blankToNull(parts[2]),
    assignedStaff: blankToNull(parts[3]),
  };
}

/**
 * planner DESCRIPTION is newline-separated "Label: value" pairs, plus section
 * headers like "Client Contact Information" / "Venue Contact Information".
 * Values may be blank (e.g. "Event Name:", "Event Planning:"). Live planner
 * feeds put client phone/email under the Client Contact section (Work/Cell/
 * Home Phone, Email) — not "Client Phone". Event Planning is usually empty
 * (planning forms are not exported as URLs).
 */
export function parseFeedDescription(description: string | null): DescriptionFields {
  const empty: DescriptionFields = {
    eventStartTime: null,
    eventEndTime: null,
    status: null,
    venue: null,
    clientName: null,
    organization: null,
    clientContact: null,
    clientPhone: null,
    clientEmail: null,
    relatedFiles: [],
    planningFormUrl: null,
  };

  if (!description?.trim()) return empty;

  const normalized = description
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",");

  const byNormalized = new Map<string, string>();
  const rawEntries: { label: string; value: string; key: string; section: ContactSection }[] =
    [];
  const clientEntries: { key: string; value: string }[] = [];
  const rootEntries: { key: string; value: string }[] = [];
  let section: ContactSection = "root";
  const clientSectionLines: string[] = [];

  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^-+$/.test(line)) continue;

    const headerSection = contactSectionFromLine(line);
    if (headerSection) {
      section = headerSection;
      continue;
    }

    const colon = line.indexOf(":");
    if (colon <= 0) {
      if (section === "client") clientSectionLines.push(line);
      continue;
    }
    const label = line.slice(0, colon).trim();
    // Skip lines that are clearly URLs posing as "https: ..."
    if (/^https?$/i.test(label)) continue;
    // Section headers sometimes appear with a trailing colon.
    const headerFromLabel = contactSectionFromLine(label);
    if (headerFromLabel && !line.slice(colon + 1).trim()) {
      section = headerFromLabel;
      continue;
    }
    const value = line.slice(colon + 1).trim();
    const key = normalizeLabel(label);
    if (!key) continue;
    rawEntries.push({ label, value, key, section });
    if (section === "client") {
      clientEntries.push({ key, value });
      clientSectionLines.push(line);
    } else if (section === "root") {
      rootEntries.push({ key, value });
    }
    // Prefer the first non-empty value for a given label (global map for
    // non-contact fields like Venue / Client Name).
    if (!byNormalized.has(key) || !byNormalized.get(key)) {
      byNormalized.set(key, value);
    }
  }

  const readNormalized = (...needles: string[]) => {
    for (const [key, value] of byNormalized) {
      if (!value?.trim()) continue;
      if (labelMatches(key, needles)) return blankToNull(value);
    }
    return null;
  };

  // Never treat venue "Contact Person" as the client contact line.
  const clientContact =
    pickFromEntries(clientEntries, [
      "contact person",
      "contact name",
      "client contact",
    ]) ||
    pickFromEntries(rootEntries, [
      "client contact information",
      "client contact",
      "contact name",
    ]);

  let clientPhone =
    pickClientPhone(clientEntries) || pickClientPhone(rootEntries);
  let clientEmail =
    pickClientEmail(clientEntries) || pickClientEmail(rootEntries);

  // Freeform fallbacks — stay inside the client section when possible so we
  // don't grab venue office numbers from the full DESCRIPTION.
  const clientBlob = clientSectionLines.join("\n");
  if (!clientPhone) {
    clientPhone =
      extractPhone(clientContact) ||
      extractPhone(clientBlob) ||
      extractPhone(
        rawEntries
          .filter((e) => e.section === "client")
          .map((e) => e.value)
          .join("\n"),
      );
  }
  if (!clientEmail) {
    clientEmail =
      extractEmail(clientContact) ||
      extractEmail(clientBlob) ||
      extractEmail(
        rawEntries
          .filter((e) => e.section === "client")
          .map((e) => e.value)
          .join("\n"),
      );
  }

  const relatedFiles = parseRelatedFilesFromDescription(description);

  // Event Planning / Event Planning #N — only useful when the value has a URL.
  const eventPlanningFiles: CalendarRelatedFile[] = [];
  for (const entry of rawEntries) {
    if (!isEventPlanningLabel(entry.key)) continue;
    const urls = extractAllHttpUrls(entry.value);
    if (urls.length > 0) {
      for (const url of urls) {
        pushRelatedFile(eventPlanningFiles, entry.label, url);
      }
      continue;
    }
    for (const file of parseRelatedFileValue(entry.value, entry.label)) {
      pushRelatedFile(eventPlanningFiles, entry.label, file.url);
    }
  }

  const planningLabeled = readNormalized(
    "event planning",
    "planning form link",
    "planning form url",
    "client planning form",
    "online planning form",
    "event planning form",
    "planning forms",
    "planning form",
    "form link",
  );
  const labeledPlanningFiles = parseRelatedFileValue(
    planningLabeled,
    "Planning Form",
  );
  const allRelated = mergeRelatedFiles(
    relatedFiles,
    eventPlanningFiles,
    labeledPlanningFiles,
  );
  const allUrls = extractAllHttpUrls(normalized);
  const planningFormUrl =
    pickPlanningFormUrl(allRelated, allUrls) ||
    extractHttpUrl(planningLabeled) ||
    (planningLabeled && allUrls.length === 1 ? allUrls[0] : null);

  return {
    eventStartTime: readNormalized("event start time"),
    eventEndTime: readNormalized("event end time"),
    status: readNormalized("status"),
    venue: readNormalized("venue"),
    clientName: readNormalized("client name"),
    organization: readNormalized("organization", "organisation"),
    clientContact,
    clientPhone,
    clientEmail,
    relatedFiles: allRelated,
    planningFormUrl,
  };
}

function pickFromEntries(
  entries: { key: string; value: string }[],
  needles: string[],
): string | null {
  for (const needle of needles) {
    for (const entry of entries) {
      if (isJunkContactValue(entry.value)) continue;
      if (entry.key === needle || entry.key.includes(needle)) {
        return blankToNull(entry.value);
      }
    }
  }
  return null;
}

/** Parse a VEVENT CONTACT string (often "NAME;PHONE;EMAIL" or freeform). */
export function parseVEventContact(contact: string | null): {
  clientContact: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
} {
  if (!contact?.trim()) {
    return { clientContact: null, clientPhone: null, clientEmail: null };
  }
  const email = extractEmail(contact);
  const phone = extractPhone(contact);
  // Strip email/phone for a remaining name-ish contact line.
  let name = contact
    .replace(EMAIL_RE, " ")
    .replace(PHONE_RE, " ")
    .replace(/[;|,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (name && (name === phone || name === email)) name = "";
  return {
    clientContact: blankToNull(name),
    clientPhone: phone,
    clientEmail: email,
  };
}

/** Tile title: Client Name + Event Type. */
export function displayTitleFromFields(fields: {
  clientName: string | null;
  eventType: string | null;
}): string {
  const { clientName, eventType } = fields;
  if (clientName && eventType) return `${clientName} · ${eventType}`;
  return clientName || eventType || "Untitled event";
}

/**
 * planner ICS UIDs look like `EVENTID:146284`. Returns the numeric/string id, or null.
 * Also accepts bare numeric UIDs and `use_event=` / description "Event ID:" forms
 * when those strings are passed in.
 */
export function parseEventIdFromUid(
  uid: string | null | undefined,
): string | null {
  return extractExternalEventId(uid);
}

/**
 * Origin of the company iCal feed (e.g. https://planner.example.com).
 * Used to build per-event planner deep links.
 */
export function originFromIcalUrl(
  icalUrl: string | null | undefined,
): string | null {
  if (!icalUrl?.trim()) return null;
  try {
    const url = new URL(icalUrl.trim());
    if (!/^https?:$/i.test(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Staff deep link into the planner for an event. Lands on the logon with
 * `use_event` set so after login the planner opens that event record (not just the
 * calendar). The logon form accepts
 * `clientlogon.asp?use_event={id}`.
 */
export function buildEventUrl(
  icalUrl: string | null | undefined,
  uid: string | null | undefined,
): string | null {
  const eventId = parseEventIdFromUid(uid);
  const origin = originFromIcalUrl(icalUrl);
  if (!eventId || !origin) return null;
  return `${origin}/clientlogon.asp?use_event=${encodeURIComponent(eventId)}`;
}

/**
 * planner “Time Off” iCal rows. Live All Staff feeds export these as:
 *   UID: DAYSOFFID:{id}
 *   SUMMARY: Scheduled Day Off: {Employee Name}
 *   DESCRIPTION: Scheduled Day Off {Employee Name} - {reason}
 * (not the phrase “time off”, and not EVENTID work-event summaries).
 */
export function isFeedTimeOffEvent(input: {
  eventType: string | null;
  status: string | null;
  summary: string | null;
  description?: string | null;
  uid?: string | null;
  categories?: string[] | string | null;
}): boolean {
  const uid = (input.uid ?? "").trim().toLowerCase();
  if (
    uid.startsWith("daysoffid:") ||
    uid.startsWith("timeoffid:") ||
    uid.startsWith("time_off_id:") ||
    /\bdaysoffid\b/.test(uid) ||
    /\btimeoffid\b/.test(uid)
  ) {
    return true;
  }

  const categories = Array.isArray(input.categories)
    ? input.categories.join(" ")
    : (input.categories ?? "");
  const summary = input.summary ?? "";
  const description = input.description ?? "";

  // Prefer SUMMARY / UID / categories — DESCRIPTION notes on real events can
  // mention someone taking a day off without being a DAYSOFF row.
  const head = [input.eventType, input.status, summary, categories]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (head.includes("scheduled day off")) return true;
  if (/^(?:scheduled\s+)?(?:day|time)\s+off\b/i.test(summary.trim())) {
    return true;
  }
  if (head.includes("time off")) return true;
  if (/\bpto\b/.test(head)) return true;
  if (head.includes("non-event") || head.includes("non event")) return true;
  if (
    input.eventType &&
    /^(vacation|sick|unavailable|personal|pto)$/i.test(input.eventType.trim())
  ) {
    return true;
  }
  // DESCRIPTION only for the explicit planner day-off lead-in.
  if (/^\s*scheduled\s+day\s+off\b/i.test(description)) return true;
  return false;
}

/**
 * Employee display name from a planner DAYSOFF / Time Off VEVENT.
 * Examples: "Scheduled Day Off: Brandon Lettow" → "Brandon Lettow".
 */
export function personNameFromFeedTimeOff(
  summary: string | null | undefined,
  description?: string | null,
): string | null {
  const sum = summary?.replace(/\s+/g, " ").trim() ?? "";
  if (sum) {
    const labeled = sum.match(
      /^(?:scheduled\s+)?(?:day|time)\s+off\s*:\s*(.+)$/i,
    );
    if (labeled?.[1]) return blankToNull(labeled[1]);

    const dashed = sum.match(
      /^(?:scheduled\s+)?(?:day|time)\s+off\s*[-–—]\s*(.+)$/i,
    );
    if (dashed?.[1]) return blankToNull(dashed[1]);
  }

  const desc = (description ?? "")
    .replace(/\\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
  if (desc) {
    const lead = desc.match(
      /^(?:scheduled\s+)?(?:day|time)\s+off\s+(.+?)(?:\s+[-–—]\s+|$)/i,
    );
    if (lead?.[1]) return blankToNull(lead[1]);
  }

  return null;
}

/** True when end − start is an exact N-day span (planner DAYSOFF midnights). */
export function isExactMultiDaySpan(
  start: Date,
  end: Date | null | undefined,
): boolean {
  if (!end) return false;
  const ms = end.getTime() - start.getTime();
  return ms >= 24 * 60 * 60 * 1000 && ms % (24 * 60 * 60 * 1000) === 0;
}

/** Skip Time Off and other non-event calendar entries from the work feed. */
export function shouldSkipFeedEvent(input: {
  eventType: string | null;
  status: string | null;
  summary: string | null;
  description?: string | null;
  uid?: string | null;
  categories?: string[] | string | null;
}): boolean {
  return isFeedTimeOffEvent(input);
}

/** Absence row extracted from a planner iCal Time Off / PTO VEVENT. */
export type FeedTimeOffAbsence = {
  uid: string;
  /** Inclusive local YYYY-MM-DD */
  startDate: string;
  /** Inclusive local YYYY-MM-DD */
  endDate: string;
  /** Raw planner event type / label when present */
  eventType: string | null;
  /** Staff name(s) from SUMMARY assigned-staff slot or related fields */
  assignedStaff: string | null;
  summary: string | null;
};

function dateKeyFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Inclusive local date keys for a VEVENT. All-day DTEND is treated as exclusive
 * (ICS convention), so the last included day is the day before end.
 */
export function feedAbsenceDateRange(
  start: Date,
  end: Date | null,
  allDay: boolean,
): { startDate: string; endDate: string } {
  const startDate = dateKeyFromLocalDate(start);
  if (!end) return { startDate, endDate: startDate };

  if (allDay) {
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);
    last.setDate(last.getDate() - 1);
    let endDate = dateKeyFromLocalDate(last);
    if (endDate < startDate) endDate = startDate;
    return { startDate, endDate };
  }

  const endDate = dateKeyFromLocalDate(end);
  return {
    startDate,
    endDate: endDate < startDate ? startDate : endDate,
  };
}

function mapFeedEventTypeToHint(eventType: string | null): string | null {
  if (!eventType?.trim()) return null;
  const t = eventType.trim().toLowerCase();
  if (t.includes("vacation") || t.includes("pto") || t.includes("holiday")) {
    return "vacation";
  }
  if (t.includes("sick")) return "sick";
  if (t.includes("personal")) return "personal";
  if (t.includes("unavailable") || t.includes("time off")) return "unavailable";
  return null;
}

/**
 * Parse company (or dedicated) planner ICS into work events + time-off absences.
 * One download; callers partition for calendar vs staffing.
 */
export async function fetchIcalPartition(icalUrl: string): Promise<{
  workEvents: CalendarEvent[];
  timeOff: FeedTimeOffAbsence[];
}> {
  const data = await fetchIcsData(icalUrl);
  const workEvents: CalendarEvent[] = [];
  const timeOff: FeedTimeOffAbsence[] = [];

  for (const item of Object.values(data)) {
    if (!item || typeof item !== "object") continue;
    if ((item as { type?: string }).type !== "VEVENT") continue;

    const vevent = item as VEvent;
    const start = toDate(vevent.start as Date | string | undefined);
    if (!start) continue;

    const end = toDate(vevent.end as Date | string | undefined);
    const summaryText = parameterText(vevent.summary);
    const summary = parseFeedSummary(summaryText);
    const descriptionText = parameterText(vevent.description);
    const description = parseFeedDescription(descriptionText);
    const contact = parseVEventContact(parameterText(vevent.contact));
    const allDay = isAllDay(start, vevent);
    const uid =
      (typeof vevent.uid === "string" && vevent.uid) ||
      `${summaryText ?? "event"}-${start.toISOString()}`;

    const categoriesRaw = (vevent as { categories?: unknown }).categories;
    const categories = Array.isArray(categoriesRaw)
      ? categoriesRaw.map((c) => String(c))
      : typeof categoriesRaw === "string"
        ? [categoriesRaw]
        : [];

    const skipInput = {
      eventType: summary.eventType,
      status: description.status || summary.status,
      summary: summaryText,
      description: descriptionText,
      uid,
      categories,
    };

    if (isFeedTimeOffEvent(skipInput)) {
      if (!withinWindow(start.toISOString())) continue;
      // planner DAYSOFF rows use midnight→midnight date-times (datetype
      // date-time), which ICS treats like all-day with an exclusive end.
      const exclusiveEnd =
        allDay || isExactMultiDaySpan(start, end);
      const { startDate, endDate } = feedAbsenceDateRange(
        start,
        end,
        exclusiveEnd,
      );
      const assigned =
        personNameFromFeedTimeOff(summaryText, descriptionText) ||
        summary.assignedStaff ||
        description.clientName ||
        description.clientContact ||
        null;
      // Prefer an explicit type from the SUMMARY event-type slot; planner DAYSOFF
      // rows usually omit it — Staffing labels those as unavailable.
      const leaveType =
        mapFeedEventTypeToHint(summary.eventType) ||
        (summary.eventType &&
        !/^(?:scheduled\s+)?(?:day|time)\s+off\b/i.test(summary.eventType)
          ? summary.eventType
          : null) ||
        "unavailable";
      timeOff.push({
        uid,
        startDate,
        endDate,
        eventType: leaveType,
        assignedStaff: assigned,
        summary: summaryText,
      });
      continue;
    }

    const clientName = description.clientName;
    const eventType = summary.eventType;
    const venue = description.venue || parameterText(vevent.location);
    const status = description.status || summary.status;
    const title = displayTitleFromFields({ clientName, eventType });

    const veventUrl = extractHttpUrl(parameterText(vevent.url));
    const attachFiles = extractAttachFiles(
      (vevent as { attach?: unknown }).attach,
    );
    const relatedFiles = mergeRelatedFiles(
      description.relatedFiles,
      attachFiles,
    );

    const planningFormUrl =
      pickPlanningFormUrl(relatedFiles) ||
      description.planningFormUrl ||
      (veventUrl && isPlanningFormUrl(veventUrl) ? veventUrl : null) ||
      pickPlanningFormUrl([], extractAllHttpUrls(descriptionText));

    // Prefer a canonical EVENTID:{n} uid when planner exposes the id in UID,
    // DESCRIPTION ("Event ID: …"), or URL (use_event=). Keeps packets aligned
    // with website review Event_ID values.
    const resolvedEventId = extractExternalEventId(
      uid,
      descriptionText,
      veventUrl,
      summaryText,
    );
    const canonicalUid = resolvedEventId
      ? canonicalCalendarUid(resolvedEventId)
      : uid;

    const builtEventUrl = buildEventUrl(icalUrl, canonicalUid);
    const eventUrl =
      (veventUrl && veventUrl !== planningFormUrl ? veventUrl : null) ||
      (builtEventUrl && builtEventUrl !== planningFormUrl ? builtEventUrl : null);

    workEvents.push({
      uid: canonicalUid,
      source: "work",
      title,
      start: start.toISOString(),
      end: end ? end.toISOString() : null,
      allDay,
      status,
      eventType,
      assignedStaff: summary.assignedStaff,
      venue,
      clientName,
      organization: description.organization,
      clientContact: description.clientContact || contact.clientContact,
      clientPhone: description.clientPhone || contact.clientPhone,
      clientEmail: description.clientEmail || contact.clientEmail,
      relatedFiles,
      planningFormUrl,
      eventUrl,
      descriptionStartTime: description.eventStartTime,
      descriptionEndTime: description.eventEndTime,
    });
  }

  workEvents.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return {
    workEvents: workEvents.filter((e) => withinWindow(e.start)),
    timeOff,
  };
}

function isAllDay(start: Date, raw?: VEvent): boolean {
  if (
    raw &&
    "datetype" in raw &&
    (raw as { datetype?: string }).datetype === "date"
  ) {
    return true;
  }
  return (
    start.getUTCHours() === 0 &&
    start.getUTCMinutes() === 0 &&
    start.getUTCSeconds() === 0 &&
    !raw?.end
  );
}

function toDate(value: Date | string | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Keep events in a usable window: ~24 months back to ~18 months ahead.
// Past lookback supports Event Packet launch from older events; future
// cover keeps planning calendars useful without shipping years of history.
const WINDOW_PAST_MS = 730 * 24 * 60 * 60 * 1000;
const WINDOW_FUTURE_MS = 550 * 24 * 60 * 60 * 1000;

function withinWindow(startIso: string): boolean {
  const t = new Date(startIso).getTime();
  if (Number.isNaN(t)) return true;
  const now = Date.now();
  return t >= now - WINDOW_PAST_MS && t <= now + WINDOW_FUTURE_MS;
}

/** Fetch an ICS feed with a timeout so a slow feed can't hang the page. */
async function fetchIcsData(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`iCal feed responded ${res.status}`);
    const text = await res.text();
    return ical.async.parseICS(text);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse a remote ICS feed into work events (server-only).
 * Uses the generic Google-friendly parser (SUMMARY as title).
 */
export async function fetchCompanyCalendarEvents(
  icalUrl: string,
): Promise<CalendarEvent[]> {
  return fetchGenericIcalEvents(icalUrl, "work");
}

/**
 * Cached ICS partition (~15 minutes): work events + Time Off absences.
 * Cache key is a hash of the URL so the raw feed URL is never embedded in
 * logs as a plaintext cache key.
 */
export function getCachedIcalPartition(icalUrl: string) {
  const urlHash = createHash("sha256")
    .update(icalUrl)
    .digest("hex")
    .slice(0, 24);

  return unstable_cache(
    async () => fetchIcalPartition(icalUrl),
    ["ical-partition-v4-24m", urlHash],
    { revalidate: CACHE_SECONDS, tags: ["company-ical", "ical-feed"] },
  )();
}

export function getCachedFeedCalendarEvents(icalUrl: string) {
  // Shared Google feeds use the generic parser (SUMMARY as title).
  return getCachedGenericIcalEvents(icalUrl, "work");
}

export function getCachedFeedTimeOffAbsences(icalUrl: string) {
  return getCachedIcalPartition(icalUrl).then((p) => p.timeOff);
}

/**
 * Generic ICS → CalendarEvent (Google Calendar, etc.).
 * Uses SUMMARY as the title — unlike the planner parser, which expects
 * "date - status - type - staff" summaries.
 */
export async function fetchGenericIcalEvents(
  icalUrl: string,
  source: "work" = "work",
): Promise<CalendarEvent[]> {
  const data = await fetchIcsData(icalUrl);
  const events: CalendarEvent[] = [];

  for (const item of Object.values(data)) {
    if (!item || typeof item !== "object") continue;
    if ((item as { type?: string }).type !== "VEVENT") continue;

    const vevent = item as VEvent;
    const start = toDate(vevent.start as Date | string | undefined);
    if (!start) continue;

    const end = toDate(vevent.end as Date | string | undefined);
    const summaryText = parameterText(vevent.summary)?.trim() || "Untitled event";
    const descriptionText = parameterText(vevent.description);
    const location = parameterText(vevent.location);
    const allDay = isAllDay(start, vevent);
    const uid =
      (typeof vevent.uid === "string" && vevent.uid) ||
      `${summaryText}-${start.toISOString()}`;
    const veventUrl = extractHttpUrl(parameterText(vevent.url));
    const status = parameterText(
      (vevent as { status?: unknown }).status,
    );

    events.push({
      uid: `${source}-${uid}`,
      source,
      title: summaryText,
      start: start.toISOString(),
      end: end ? end.toISOString() : null,
      allDay,
      status,
      eventType: null,
      assignedStaff: null,
      venue: location,
      clientName: null,
      organization: null,
      clientContact: null,
      clientPhone: extractPhone(descriptionText),
      clientEmail: extractEmail(descriptionText),
      relatedFiles: [],
      planningFormUrl: null,
      eventUrl: veventUrl,
      descriptionStartTime: null,
      descriptionEndTime: null,
    });
  }

  events.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
  return events.filter((e) => withinWindow(e.start));
}

export function getCachedGenericIcalEvents(
  icalUrl: string,
  source: "work" = "work",
) {
  const urlHash = createHash("sha256")
    .update(`${source}:${icalUrl}`)
    .digest("hex")
    .slice(0, 24);

  return unstable_cache(
    async () => fetchGenericIcalEvents(icalUrl, source),
    ["generic-ical-v1", urlHash],
    { revalidate: CACHE_SECONDS, tags: ["company-ical", "work-ical"] },
  )();
}

/** @deprecated Prefer getCachedFeedCalendarEvents */
export function getCachedCompanyCalendarEvents(icalUrl: string) {
  return getCachedFeedCalendarEvents(icalUrl);
}
