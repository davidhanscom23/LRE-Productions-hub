/**
 * Inquiry Forms - the values the database accepts (the inquiry forms migration's check
 * constraints) and the table / log vocabulary the server writes. PURE module: no server-only
 * imports, so vitest can pin these lists to the migration SQL (schema-core.test.ts).
 */
import type { ScoreLabel, SubmissionStage } from "../types";

/**
 * The migration that creates these tables, in supabase/migrations: each hub uses its next free
 * number (Y? 278_inquiry_forms.sql, LRE 167_inquiry_forms.sql).
 */
export const MIGRATION_FILE_PATTERN = /^\d+_inquiry_forms\.sql$/;

export const TABLES = {
  forms: "inquiry_forms",
  versions: "inquiry_form_versions",
  settings: "inquiry_settings",
  submissions: "inquiry_submissions",
  log: "inquiry_log",
  rateLimits: "inquiry_rate_limits",
  stats: "inquiry_form_stats",
  geocodeCache: "inquiry_geocode_cache",
} as const;

export const FORM_STATUS_VALUES = ["draft", "live", "paused", "archived"] as const;
export type FormStatusValue = (typeof FORM_STATUS_VALUES)[number];

export const SUBMISSION_STAGE_VALUES = [
  "in_progress",
  "completed",
  "waitlisted",
  "abandoned",
  "spam",
] as const satisfies readonly SubmissionStage[];

export const SCORE_LABEL_VALUES = ["high", "medium", "low"] as const satisfies readonly ScoreLabel[];

export const LOG_STATUS_VALUES = ["sent", "failed", "skipped"] as const;
export type LogStatus = (typeof LOG_STATUS_VALUES)[number];

export const STAT_FIELDS = ["views", "starts", "completes"] as const;
export type StatField = (typeof STAT_FIELDS)[number];

/** Same rule as slug.ts isValidSlug, written as the SQL check uses it. */
export const SLUG_SQL_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";
export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 60;

/** inquiry_log.kind values written by the server (free text in SQL; listed here for the admin UI). */
export const LOG_KINDS = {
  /** adapter.recordInquiry (Leads card + client) by completion or the sweep (counted as attempts). */
  crmRecord: "crm_record",
  /** adapter.recordInquiry by staff ("Add to Leads"); never counted as an automatic attempt. */
  crmManual: "crm_manual",
  /** In-app staff alert for a finished inquiry. */
  staffNotify: "staff_notify",
  /** Staff email to settings.notify.recipients. */
  staffEmail: "staff_email",
  /** Lead-facing confirmation email. */
  confirmation: "confirmation",
  /** In-app alert for an unfinished inquiry (sweep). */
  abandonAlert: "abandon_alert",
  /** Daily stats bump. */
  stats: "stats",
  /** Spam verdict (start or complete). */
  spam: "spam",
  /** A qualification check failed and was answered "unknown" / "unverified". */
  checkError: "check_error",
  /** One-way copy to GoHighLevel (settings.copies.ghl). */
  ghlCopy: "ghl_copy",
} as const;
export type LogKind = (typeof LOG_KINDS)[keyof typeof LOG_KINDS];

/** RPC names (each revoked from anon / authenticated by name in the migration). */
export const RPC = {
  rateHit: "inquiry_rate_hit",
  statBump: "inquiry_stat_bump",
  /** Atomic CRM write claim (crm-claim-core.ts explains who claims and when). */
  crmClaim: "inquiry_crm_claim",
} as const;

/** SQL argument types of each RPC, as the migration revokes and grants them. */
export const RPC_SIGNATURES: Record<(typeof RPC)[keyof typeof RPC], string> = {
  inquiry_rate_hit: "text, timestamptz",
  inquiry_stat_bump: "uuid, date, text",
  inquiry_crm_claim: "uuid, integer",
};

/**
 * A real calendar date "YYYY-MM-DD" that a Postgres `date` column accepts (it rejects
 * "2027-02-30"). Used as the last guard before writing event_date columns.
 */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Postgres integer range, and the rounding the guest_count columns need. */
export function toDbInt(value: unknown, min = 0, max = 2_000_000_000): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  return n >= min && n <= max ? n : null;
}

export function isFormStatusValue(value: unknown): value is FormStatusValue {
  return typeof value === "string" && (FORM_STATUS_VALUES as readonly string[]).includes(value);
}

export function isSubmissionStageValue(value: unknown): value is SubmissionStage {
  return typeof value === "string" && (SUBMISSION_STAGE_VALUES as readonly string[]).includes(value);
}

export function isScoreLabelValue(value: unknown): value is ScoreLabel {
  return typeof value === "string" && (SCORE_LABEL_VALUES as readonly string[]).includes(value);
}
