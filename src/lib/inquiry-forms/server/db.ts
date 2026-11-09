import "server-only";

/**
 * Inquiry Forms - row mappers and loaders (service-role client only).
 * Every read and write checks its error: reads throw InquiryDbError (callers answer 500,
 * retryable), log writes never throw (they report to the server log instead).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateDefinition } from "../definition";
import { mergeFormSettings } from "../defaults";
import type {
  Answers,
  Attribution,
  FormDefinition,
  FormSettings,
  Qualification,
  SubmissionRow,
  SubmissionStage,
} from "../types";
import { isPlainObject } from "./lifecycle-core";
import {
  isFormStatusValue,
  isScoreLabelValue,
  isSubmissionStageValue,
  RPC,
  TABLES,
  type FormStatusValue,
  type LogKind,
  type LogStatus,
  type StatField,
} from "./schema-core";

export class InquiryDbError extends Error {
  readonly op: string;
  constructor(op: string, message: string) {
    super(`${op}: ${message}`);
    this.name = "InquiryDbError";
    this.op = op;
  }
}

export interface FormRecord {
  id: string;
  slug: string;
  name: string;
  brand: string;
  status: FormStatusValue;
  definition: unknown;
  settings: unknown;
  published_version_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VersionRecord {
  id: string;
  form_id: string;
  version: number;
  definition: unknown;
  settings: unknown;
  published_at: string;
  published_by: string | null;
}

/** SubmissionRow plus the columns that never leave the server. */
export interface SubmissionRecord extends SubmissionRow {
  token_hash: string;
  ip_hash: string | null;
  user_agent: string | null;
}

/** A definition + settings pair ready to use (definition validated, settings merged with defaults). */
export interface ResolvedForm {
  definition: FormDefinition;
  settings: FormSettings;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function intOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : fallback;
}

export function toFormRecord(row: Record<string, unknown>): FormRecord {
  return {
    id: str(row.id),
    slug: str(row.slug),
    name: str(row.name),
    brand: str(row.brand),
    status: isFormStatusValue(row.status) ? row.status : "draft",
    definition: row.definition,
    settings: row.settings,
    published_version_id: strOrNull(row.published_version_id),
    created_by: strOrNull(row.created_by),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

export function toVersionRecord(row: Record<string, unknown>): VersionRecord {
  return {
    id: str(row.id),
    form_id: str(row.form_id),
    version: intOr(row.version, 1),
    definition: row.definition,
    settings: row.settings,
    published_at: str(row.published_at),
    published_by: strOrNull(row.published_by),
  };
}

function stringMap(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isPlainObject(v)) return out;
  for (const [k, val] of Object.entries(v)) if (typeof val === "string") out[k] = val;
  return out;
}

export function toSubmissionRecord(row: Record<string, unknown>): SubmissionRecord {
  const stage: SubmissionStage = isSubmissionStageValue(row.stage) ? row.stage : "in_progress";
  const score = typeof row.score === "number" && Number.isFinite(row.score) ? row.score : null;
  return {
    id: str(row.id),
    form_id: str(row.form_id),
    version_id: strOrNull(row.version_id),
    stage,
    current_step: intOr(row.current_step, 0),
    total_steps: intOr(row.total_steps, 0),
    answers: (isPlainObject(row.answers) ? row.answers : {}) as Answers,
    contact_name: strOrNull(row.contact_name),
    contact_email: strOrNull(row.contact_email),
    contact_phone: strOrNull(row.contact_phone),
    event_date: typeof row.event_date === "string" ? row.event_date.slice(0, 10) : null,
    event_location: strOrNull(row.event_location),
    guest_count: typeof row.guest_count === "number" ? row.guest_count : null,
    qualification: (isPlainObject(row.qualification) ? row.qualification : {}) as Qualification,
    score,
    score_label: isScoreLabelValue(row.score_label) ? row.score_label : null,
    attribution: (isPlainObject(row.attribution) ? row.attribution : {}) as Attribution,
    crm_ref: stringMap(row.crm_ref),
    spam_reason: strOrNull(row.spam_reason),
    started_at: str(row.started_at),
    last_activity_at: str(row.last_activity_at),
    completed_at: strOrNull(row.completed_at),
    abandoned_at: strOrNull(row.abandoned_at),
    abandon_notified_at: strOrNull(row.abandon_notified_at),
    staff_notified_at: strOrNull(row.staff_notified_at),
    confirmation_sent_at: strOrNull(row.confirmation_sent_at),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
    token_hash: str(row.token_hash),
    ip_hash: strOrNull(row.ip_hash),
    user_agent: strOrNull(row.user_agent),
  };
}

/** The SubmissionRow contract shape (drops the server-only columns). */
export function publicRow(record: SubmissionRecord): SubmissionRow {
  const { token_hash, ip_hash, user_agent, ...row } = record;
  void token_hash;
  void ip_hash;
  void user_agent;
  return row;
}

/** Validated definition + merged settings, or null when the stored definition is not valid. */
export function resolveForm(definition: unknown, settings: unknown): ResolvedForm | null {
  const checked = validateDefinition(definition);
  if (!checked.ok) {
    console.error("[inquiry-forms] stored definition is not valid", checked.errors.slice(0, 5));
    return null;
  }
  return { definition: checked.def, settings: mergeFormSettings(settings) };
}

export async function loadFormBySlug(sb: SupabaseClient, slug: string): Promise<FormRecord | null> {
  const { data, error } = await sb.from(TABLES.forms).select("*").eq("slug", slug).maybeSingle();
  if (error) throw new InquiryDbError("load form", error.message);
  return data ? toFormRecord(data as Record<string, unknown>) : null;
}

export async function loadFormById(sb: SupabaseClient, id: string): Promise<FormRecord | null> {
  const { data, error } = await sb.from(TABLES.forms).select("*").eq("id", id).maybeSingle();
  if (error) throw new InquiryDbError("load form", error.message);
  return data ? toFormRecord(data as Record<string, unknown>) : null;
}

export async function loadVersion(sb: SupabaseClient, id: string): Promise<VersionRecord | null> {
  const { data, error } = await sb.from(TABLES.versions).select("*").eq("id", id).maybeSingle();
  if (error) throw new InquiryDbError("load form version", error.message);
  return data ? toVersionRecord(data as Record<string, unknown>) : null;
}

export async function loadSubmission(sb: SupabaseClient, id: string): Promise<SubmissionRecord | null> {
  const { data, error } = await sb.from(TABLES.submissions).select("*").eq("id", id).maybeSingle();
  if (error) throw new InquiryDbError("load submission", error.message);
  return data ? toSubmissionRecord(data as Record<string, unknown>) : null;
}

/** The form + the version a submission was filled on (falls back to the form's published version). */
export async function loadSubmissionForm(
  sb: SupabaseClient,
  submission: Pick<SubmissionRecord, "form_id" | "version_id">,
): Promise<{ form: FormRecord; version: VersionRecord; resolved: ResolvedForm } | null> {
  const form = await loadFormById(sb, submission.form_id);
  if (!form) return null;
  const versionId = submission.version_id ?? form.published_version_id;
  if (!versionId) return null;
  const version = await loadVersion(sb, versionId);
  if (!version) return null;
  const resolved = resolveForm(version.definition, version.settings);
  return resolved ? { form, version, resolved } : null;
}

export interface LogEntry {
  submissionId: string | null;
  kind: LogKind;
  status: LogStatus;
  channel?: string | null;
  recipient?: string | null;
  detail?: Record<string, unknown>;
}

/** Append to inquiry_log. Never throws: a failed log write is reported to the server log. */
export async function writeLog(sb: SupabaseClient, entry: LogEntry): Promise<void> {
  try {
    const { error } = await sb.from(TABLES.log).insert({
      submission_id: entry.submissionId,
      kind: entry.kind,
      status: entry.status,
      channel: entry.channel ?? null,
      recipient: entry.recipient ? entry.recipient.slice(0, 320) : null,
      detail: entry.detail ?? {},
    });
    if (error) console.error("[inquiry-forms] log write failed", entry.kind, entry.status, error.message);
  } catch (err) {
    console.error("[inquiry-forms] log write threw", entry.kind, err instanceof Error ? err.message : err);
  }
}

/** How many log rows of `kind` the submission has (optionally only one status). */
export async function countLog(
  sb: SupabaseClient,
  submissionId: string,
  kind: LogKind,
  status?: LogStatus,
): Promise<number> {
  let query = sb
    .from(TABLES.log)
    .select("id", { count: "exact", head: true })
    .eq("submission_id", submissionId)
    .eq("kind", kind);
  if (status) query = query.eq("status", status);
  const { count, error } = await query;
  if (error) throw new InquiryDbError("count log", error.message);
  return count ?? 0;
}

/** The latest log row of `kind` with `status` for a submission (detail included). */
export async function latestLog(
  sb: SupabaseClient,
  submissionId: string,
  kind: LogKind,
  status: LogStatus,
): Promise<{ detail: Record<string, unknown>; created_at: string } | null> {
  const { data, error } = await sb
    .from(TABLES.log)
    .select("detail, created_at")
    .eq("submission_id", submissionId)
    .eq("kind", kind)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new InquiryDbError("read log", error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return { detail: isPlainObject(row.detail) ? row.detail : {}, created_at: str(row.created_at) };
}

/**
 * `detail` of the newest log rows of any of `kinds` with `status` (newest first, at most `limit`).
 * Throws on error.
 */
export async function latestLogDetails(
  sb: SupabaseClient,
  submissionId: string,
  kinds: LogKind[],
  status: LogStatus,
  limit = 5,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await sb
    .from(TABLES.log)
    .select("detail")
    .eq("submission_id", submissionId)
    .in("kind", kinds)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new InquiryDbError("read log", error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => (isPlainObject(row.detail) ? row.detail : {}));
}

// ---------------------------------------------------------------------------
// CRM write claim (crm-claim-core.ts decides who claims and when)
// ---------------------------------------------------------------------------

/**
 * inquiry_crm_claim: atomically claims the CRM write of one submission. Returns the raw answer
 * ({claimed_at, crm_ref} when claimed, null when not; read it with readClaim). Throws on error.
 */
export async function claimCrmWrite(sb: SupabaseClient, submissionId: string, takeoverSeconds: number | null): Promise<unknown> {
  const { data, error } = await sb.rpc(RPC.crmClaim, { p_id: submissionId, p_stale_seconds: takeoverSeconds });
  if (error) throw new InquiryDbError("claim CRM write", error.message);
  return data ?? null;
}

/**
 * Releases a claim after a failed write: crm_claimed_at back to null, only while it still holds
 * OUR claim (a takeover in between keeps its own). Stores `ref` too when given (the partial
 * client a retry reuses). Never throws.
 */
export async function releaseCrmClaim(
  sb: SupabaseClient,
  submissionId: string,
  token: string,
  ref: Record<string, string> | null,
): Promise<boolean> {
  try {
    const { data, error } = await sb
      .from(TABLES.submissions)
      .update(ref ? { crm_claimed_at: null, crm_ref: ref } : { crm_claimed_at: null })
      .eq("id", submissionId)
      .eq("crm_claimed_at", token)
      .select("id");
    if (error) {
      console.error("[inquiry-forms] CRM claim release failed", submissionId, error.message);
      return false;
    }
    return Boolean(data && data.length > 0);
  } catch (err) {
    console.error("[inquiry-forms] CRM claim release threw", submissionId, err instanceof Error ? err.message : err);
    return false;
  }
}

/** Links the CRM record to the submission. Never throws; false when it was not stored. */
export async function saveCrmRef(sb: SupabaseClient, submissionId: string, ref: Record<string, string>): Promise<boolean> {
  try {
    const { error } = await sb.from(TABLES.submissions).update({ crm_ref: ref }).eq("id", submissionId);
    if (error) {
      console.error("[inquiry-forms] crm_ref save failed", submissionId, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[inquiry-forms] crm_ref save threw", submissionId, err instanceof Error ? err.message : err);
    return false;
  }
}

/** One hit in a fixed window; returns the new count. Throws on error (callers decide fail-open). */
export async function rateHit(sb: SupabaseClient, key: string, windowStart: string): Promise<number> {
  const { data, error } = await sb.rpc(RPC.rateHit, { p_key: key, p_window_start: windowStart });
  if (error) throw new InquiryDbError("rate counter", error.message);
  const n = typeof data === "number" ? data : Number(data);
  if (!Number.isFinite(n)) throw new InquiryDbError("rate counter", "no count returned");
  return n;
}

/** +1 views / starts / completes for the form on the New York day. Throws on error. */
export async function statBump(sb: SupabaseClient, formId: string, day: string, field: StatField): Promise<void> {
  const { error } = await sb.rpc(RPC.statBump, { p_form: formId, p_day: day, p_field: field });
  if (error) throw new InquiryDbError("stats", error.message);
}
