/**
 * Inquiry Forms admin: pure labels and formatters for the Submissions tab and drawer.
 * Staff-facing wording only (visitors never see these strings).
 */
import type {
  Attribution,
  DateResult,
  LocationResult,
  ScoreLabel,
  SubmissionStage,
} from "@/lib/inquiry-forms/types";
import { LOG_KINDS } from "@/lib/inquiry-forms/server/schema-core";
import { CRM_WORDS } from "@/lib/inquiry-forms/hub-copy";
import type { Tone } from "./list-helpers";
import type { StageFilter } from "./submissions-types";

/**
 * This hub's CRM words (Add to ..., Already in ..., the record link label). They live in the
 * hub-specific hub-copy.ts so this file stays the same in every hub.
 */
export { CRM_WORDS };

export const STAGE_LABEL: Record<SubmissionStage, string> = {
  in_progress: "In progress",
  completed: "Completed",
  waitlisted: "Waitlisted",
  abandoned: "Abandoned",
  spam: "Spam",
};

export const STAGE_TONE: Record<SubmissionStage, Tone> = {
  completed: "good",
  waitlisted: "info",
  in_progress: "warn",
  abandoned: "neutral",
  spam: "bad",
};

export const STAGE_FILTERS: { value: StageFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "in_progress", label: "In progress" },
  { value: "abandoned", label: "Abandoned" },
  { value: "spam", label: "Spam" },
];

export function isStageFilter(value: unknown): value is StageFilter {
  return typeof value === "string" && STAGE_FILTERS.some((f) => f.value === value);
}

export const DATE_RESULT_LABEL: Record<DateResult, string> = {
  available: "Available",
  open: "Open",
  limited: "Limited",
  unavailable: "Booked up",
  blackout: "Blackout date",
  too_soon: "Too soon",
  unknown: "Could not check",
  skipped: "Not checked",
};

export const DATE_RESULT_TONE: Record<DateResult, Tone> = {
  available: "good",
  open: "good",
  limited: "warn",
  unavailable: "bad",
  blackout: "bad",
  too_soon: "bad",
  unknown: "neutral",
  skipped: "neutral",
};

export const LOCATION_RESULT_LABEL: Record<LocationResult, string> = {
  pass: "In our area",
  risky: "Travel fee zone",
  talk: "Far, talk first",
  fail: "Outside our area",
  unverified: "Not verified",
  skipped: "Not checked",
};

export const LOCATION_RESULT_TONE: Record<LocationResult, Tone> = {
  pass: "good",
  risky: "warn",
  talk: "warn",
  fail: "bad",
  unverified: "neutral",
  skipped: "neutral",
};

export const SCORE_LABEL_TEXT: Record<ScoreLabel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const SCORE_LABEL_TONE: Record<ScoreLabel, Tone> = {
  high: "good",
  medium: "warn",
  low: "neutral",
};

export function hostFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Plain-language traffic source for one submission:
 * UTM source (and medium) first, then an ad click id, then the site the form is embedded on,
 * then the referring site, else "Direct".
 */
export function sourceSummary(a: Attribution | null | undefined): string {
  if (!a) return "Direct";
  const src = a.utm_source?.trim();
  const medium = a.utm_medium?.trim();
  if (src) return medium ? `${src} / ${medium}` : src;
  if (a.gclid || a.gbraid || a.wbraid) return "Google Ads";
  if (a.fbclid) return "Facebook or Instagram ad";
  if (a.msclkid) return "Microsoft Ads";
  const host = a.host_domain?.trim().replace(/^www\./i, "") || null;
  const ref = hostFromUrl(a.referrer);
  if (host && ref && ref !== host) return `${host} (from ${ref})`;
  if (host) return host;
  if (ref) return ref;
  return "Direct";
}

/** "Event date: May 15, 2027" -> { label: "Event date", value: "May 15, 2027" }. A line without ": " is all value. */
export function splitAnswerLine(line: string): { label: string; value: string } {
  const at = line.indexOf(": ");
  if (at <= 0) return { label: "", value: line };
  return { label: line.slice(0, at), value: line.slice(at + 2) };
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Wall-calendar "YYYY-MM-DD" -> "May 15, 2027" without going through Date (no time zone shift).
 * Anything else comes back unchanged; null or empty gives "".
 */
export function formatYmd(ymd: string | null | undefined): string {
  if (!ymd) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return ymd;
  return `${MONTHS[month - 1]} ${day}, ${m[1]}`;
}

/** Labels for the inquiry_log kinds the server writes (schema-core LOG_KINDS) plus the staff actions below. */
const LOG_KIND_LABELS: Record<string, string> = {
  crm_record: CRM_WORDS.logRecord,
  staff_notify: "Staff alert in the Hub",
  staff_email: "Staff email",
  confirmation: "Confirmation email to the visitor",
  abandon_alert: "Unfinished inquiry alert",
  stats: "Funnel count",
  spam: "Spam check",
  check_error: "Date or travel check problem",
  ghl_copy: "Copy to GoHighLevel",
  staff_marked_spam: "Marked as spam by staff",
  staff_marked_not_spam: "Marked as not spam by staff",
  crm_manual: CRM_WORDS.logManual,
};

/** Log kinds written by the admin actions (not side effects, so the sweep never counts them). */
export const STAFF_LOG_KINDS = {
  markedSpam: "staff_marked_spam",
  markedNotSpam: "staff_marked_not_spam",
  /** Written by the shared CRM write (server/crm-write.ts) for the staff "Add to CRM" action. */
  crmManual: LOG_KINDS.crmManual,
} as const;

/** Readable name for an inquiry_log kind. Unknown kinds are humanized ("staff_email" -> "Staff email"). */
export function logKindLabel(kind: string): string {
  const known = LOG_KIND_LABELS[kind];
  if (known) return known;
  const words = kind.replace(/[_-]+/g, " ").trim();
  if (!words) return "Activity";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const LOG_STATUS_LABEL: Record<string, string> = {
  sent: "Done",
  failed: "Failed",
  skipped: "Skipped",
};

export const LOG_STATUS_TONE: Record<string, Tone> = {
  sent: "good",
  failed: "bad",
  skipped: "neutral",
};

/** Attribution rows worth showing, in a fixed order, with staff-facing labels. */
export function attributionRows(a: Attribution | null | undefined): { label: string; value: string; href?: string }[] {
  if (!a) return [];
  const rows: { label: string; value: string; href?: string }[] = [];
  const push = (label: string, value: string | undefined, isUrl = false) => {
    const v = value?.trim();
    if (!v) return;
    const safeHref = isUrl && /^https?:\/\//i.test(v) ? v : undefined;
    rows.push(safeHref ? { label, value: v, href: safeHref } : { label, value: v });
  };
  push("UTM source", a.utm_source);
  push("UTM medium", a.utm_medium);
  push("UTM campaign", a.utm_campaign);
  push("UTM term", a.utm_term);
  push("UTM content", a.utm_content);
  push("Google click id", a.gclid);
  push("Google gbraid", a.gbraid);
  push("Google wbraid", a.wbraid);
  push("Facebook click id", a.fbclid);
  push("Microsoft click id", a.msclkid);
  push("Page", a.page_url, true);
  push("Website", a.host_domain);
  push("Came from", a.referrer, true);
  push("First visit page", a.landing_url, true);
  return rows;
}

/**
 * mailto: link for a stored visitor address. Encoded, with only the @ kept, so characters in the
 * address (? & = from rows saved before the stricter email rule) can never add Bcc, Cc or a body.
 */
export function mailtoHref(email: string): string {
  return `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}`;
}
