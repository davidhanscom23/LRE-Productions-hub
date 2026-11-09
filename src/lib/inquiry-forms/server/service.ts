import "server-only";

/**
 * Inquiry Forms - the public lifecycle (start, save, ping, qualify, complete, view), the admin
 * draft check, the completion side effects and the sweep. Spec sections 0, 3, 4.
 *
 * - The server owns every write and every verdict; the browser never sends stage or score.
 * - A submission is addressed by {submissionId, token}; the DB keeps sha256(token).
 * - Completion is ONE idempotent flip (update ... where completed_at is null returning). Only the
 *   flipping request schedules side effects (route handler runs them in after()); the sweep
 *   re-drives what never logged success, at most 3 attempts each.
 * - Spam is stored with stage "spam", every outbound is silenced, the bot sees a thank-you.
 * - Every DB write checks its error; a failed write answers 500 retryable, never a fake thank-you.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/admin";
import { mergeAnswers, sanitizeStepAnswers, stripHidden } from "../answers";
import { easternDayKey, todayInTz } from "../dates";
import { computeScore } from "../scoring";
import { isValidSlug } from "../slug";
import type {
  Answers,
  BusinessSettings,
  CheckKind,
  CompleteResponse,
  ErrorResponse,
  FormDefinition,
  FormSettings,
  Qualification,
  QualifyResponse,
  SaveResponse,
  StartResponse,
} from "../types";
import { validateStep } from "../validation";
import { hubAdapter, type HubAdapter } from "./adapter";
import { checkDate } from "./availability";
import { resolveBrand } from "./bundle-core";
import { MAX_AUTO_CRM_ATTEMPTS, refFromLogDetail, type CrmWriter } from "./crm-claim-core";
import { CRM_LOG_KINDS, writeCrmRecord, type CrmWriteResult } from "./crm-write";
import {
  countLog,
  latestLogDetails,
  loadFormById,
  loadFormBySlug,
  loadSubmission,
  loadSubmissionForm,
  loadVersion,
  publicRow,
  resolveForm,
  statBump,
  toSubmissionRecord,
  writeLog,
  type FormRecord,
  type SubmissionRecord,
} from "./db";
import type { InquiryContext } from "./emails";
import { checkLocation } from "./geo";
import { formHasLocationField, locationInputFromAnswers } from "./geo-core";
import {
  applyAltDateChoice,
  budgetQualification,
  celebrateFor,
  contactColumns,
  crmRefDone,
  endingFor,
  eventDateOf,
  firstInvalidStep,
  hasContact,
  isUuid,
  missingContactErrors,
  nextCurrentStep,
  parseCompleteBody,
  parseSaveBody,
  parseSlugBody,
  parseStartBody,
  parseTokenBody,
  qualifyStepOf,
  resolveEnding,
  staleChecks,
  storedEndingKind,
  urgencyFor,
  visitorQualification,
  withinUpdateWindow,
} from "./lifecycle-core";
import { sendGhlCopy, type CopyContext } from "./forward";
import { COPY_RETRY_WINDOW_MS, ownerFor } from "./forward-core";
import { notifyStaffOfInquiry, notifyStaffOfUnfinished, sendInquiryConfirmation, staffHref } from "./notify";
import { LOG_KINDS, TABLES, type StatField } from "./schema-core";
import { getBusinessSettings, hubBusinessDefaults } from "./settings";
import { countHit, isTurnstileOn, verifyTurnstile } from "./spam";
import {
  capUserAgent,
  clientIpFrom,
  countsTowardEmailLimit,
  easternDayWindowStart,
  halfHourWindowStart,
  hourWindowStart,
  overLimit,
  RATE_KEYS,
  sanitizeAttribution,
  startHardCapped,
  startSignalsSpamReason,
  turnstileDecision,
  type SpamReason,
} from "./spam-core";
import { emailKeyFor, hashToken, ipHashFor, newToken, tokenMatches } from "./tokens";

// ---------------------------------------------------------------------------
// Results and copy
// ---------------------------------------------------------------------------

/** ErrorResponse carries the optional stepIndex the client jumps back to. */
export type ErrorBody = ErrorResponse;

export interface ServiceResult<T> {
  status: number;
  body: T | ErrorBody;
  /** Side effects for the route handler to run in after() (only the flipping complete call). */
  afterResponse?: () => Promise<void>;
}

const COPY = {
  notLive: "This form is not available right now.",
  notFound: "We could not find this form session. Please reload the page and start again.",
  badToken: "This form session is not valid. Please reload the page and start again.",
  expired: "This form session expired. Please reload the page and start again.",
  alreadySent: "This inquiry was already sent.",
  checkFields: "Please check the highlighted fields.",
  needContact: "Please add an email or phone so we can reach you.",
  tooMany: "Too many tries in a short time. Please wait a minute and try again.",
  retry: "Something went wrong on our side. Please try again.",
  badRequest: "The request was not understood.",
  adminOnly: "Only admins can preview a draft.",
  draftInvalid: "This draft has problems. Fix them in the builder before previewing.",
  finishCheck:
    "Please finish the quick security check on this page, then try again. If you do not see it, reload the page (your answers stay).",
} as const;

/** Most qualify calls a single submission may make per hour (it can trigger geocoding). */
const MAX_QUALIFY_PER_HOUR = 12;
/** Uncached geocoder lookups (network calls, billable with Google) per hour for the whole hub. */
const MAX_GEOCODES_PER_HOUR = 150;
/** Uncached geocoder lookups per visitor IP per hour (a bridal show booth still gets plenty). */
const MAX_GEOCODES_PER_IP_PER_HOUR = 20;
/** Spam submissions (and their log rows) are deleted after this long. */
const SPAM_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const SPAM_PRUNE_BATCH = 500;
/** A sweep claims a row only when nothing touched it this recently (a running claim holder did). */
const CLAIM_QUIET_MS = 2 * 60 * 1000;
/** Admin draft previews per hour. */
const MAX_PREVIEW_PER_HOUR = 300;
/** Side-effect attempts per kind before the sweep gives up (each one is logged). */
const MAX_ATTEMPTS = 3;
/** Pings closer together than this skip the write. */
const PING_MIN_GAP_MS = 15_000;
/** The sweep leaves a completion alone this long (after() is still running it). */
const REDRIVE_AFTER_MS = 2 * 60 * 1000;
/** The sweep never re-drives completions older than this. */
const REDRIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** A confirmation that never ran is sent by the sweep only this soon after completion. */
const CONFIRMATION_LATE_LIMIT_MS = 60 * 60 * 1000;
/** Abandonment window: older than the delay, newer than this. */
const ABANDON_MAX_AGE_MS = 48 * 60 * 60 * 1000;
/** A failed unfinished alert is retried after this long. */
const ABANDON_RETRY_AFTER_MS = 10 * 60 * 1000;
const SWEEP_BATCH = 100;

function ok<T>(body: T): ServiceResult<T> {
  return { status: 200, body };
}

function fail<T>(status: number, error: string, extra?: Omit<ErrorBody, "ok" | "error">): ServiceResult<T> {
  return { status, body: { ok: false, error, ...(extra ?? {}) } };
}

function serverError<T>(op: string, err: unknown): ServiceResult<T> {
  console.error(`[inquiry-forms] ${op} failed`, err instanceof Error ? err.message : err);
  return fail<T>(500, COPY.retry, { retryable: true });
}

function errorText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

function hasErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0;
}

function adapter(): HubAdapter {
  return hubAdapter;
}

// ---------------------------------------------------------------------------
// Qualification (shared by qualify, complete and the admin draft check)
// ---------------------------------------------------------------------------

interface CheckInput {
  definition: FormDefinition;
  settings: FormSettings;
  business: BusinessSettings;
  answers: Answers;
  prev: Qualification;
  checks: CheckKind[];
  today: string;
  /** Hourly geocoder budget for visitor checks (omitted for the admin dry run). */
  geocodeBudget?: () => Promise<boolean>;
}

/** A visitor's uncached geocoder lookups spend a hub-wide and a per-IP hourly budget. */
function visitorGeocodeBudget(sb: SupabaseClient, ipHash: string | null, now: Date): () => Promise<boolean> {
  return async () => {
    const hour = hourWindowStart(now);
    if (overLimit(await countHit(sb, RATE_KEYS.geocodeIp(ipHash), hour), MAX_GEOCODES_PER_IP_PER_HOUR)) return false;
    return !overLimit(await countHit(sb, RATE_KEYS.geocodeAll(), hour), MAX_GEOCODES_PER_HOUR);
  };
}

async function runChecks(sb: SupabaseClient, input: CheckInput): Promise<{ qualification: Qualification; errors: string[] }> {
  const a = adapter();
  const q: Qualification = { ...input.prev };
  const errors: string[] = [];
  const date = eventDateOf(input.definition, input.answers);
  applyAltDateChoice(q, input.prev, date);

  const tasks: Promise<void>[] = [];
  if (input.checks.includes("date")) {
    const wantAlternatives = input.settings.onDateUnavailable.actions.includes("alternatives");
    tasks.push(
      checkDate(sb, a, input.business, date, { today: input.today, wantAlternatives }).then((r) => {
        q.date = r.verdict;
        if (r.error) errors.push(`date: ${r.error}`);
      }),
    );
  }
  if (input.checks.includes("location")) {
    tasks.push(
      checkLocation(sb, input.business, locationInputFromAnswers(input.definition, input.answers), {
        formHasField: formHasLocationField(input.definition),
        origin: a.publicOrigin(),
        budget: input.geocodeBudget,
      }).then((r) => {
        q.location = r.verdict;
        if (r.error) errors.push(`location: ${r.error}`);
      }),
    );
  }
  await Promise.all(tasks);

  const budget = budgetQualification(input.definition, input.answers);
  if (budget) q.budget = budget;
  else delete q.budget;
  return { qualification: q, errors };
}

async function logCheckErrors(sb: SupabaseClient, submissionId: string | null, errors: string[]): Promise<void> {
  for (const error of errors) {
    console.error("[inquiry-forms] check answered unknown/unverified after an error", error);
    await writeLog(sb, { submissionId, kind: LOG_KINDS.checkError, status: "failed", detail: { error: error.slice(0, 500) } });
  }
}

/** Score only once there is something to score (in-progress rows without verdicts stay unscored). */
function scoreOf(q: Qualification): { score: number | null; score_label: "high" | "medium" | "low" | null } {
  if (!q.date && !q.location && !q.budget) return { score: null, score_label: null };
  const s = computeScore(q);
  return { score: s.score, score_label: s.label };
}

async function loadLiveForm(
  sb: SupabaseClient,
  slug: string,
): Promise<{ form: FormRecord; versionId: string; definition: FormDefinition; settings: FormSettings } | null> {
  const form = await loadFormBySlug(sb, slug);
  if (!form || form.status !== "live" || !form.published_version_id) return null;
  const version = await loadVersion(sb, form.published_version_id);
  if (!version) return null;
  const resolved = resolveForm(version.definition, version.settings);
  return resolved ? { form, versionId: version.id, ...resolved } : null;
}

async function bumpStat(sb: SupabaseClient, formId: string, day: string, field: StatField): Promise<boolean> {
  try {
    await statBump(sb, formId, day, field);
    return true;
  } catch (err) {
    console.error("[inquiry-forms] stats bump failed", field, errorText(err));
    return false;
  }
}

// ---------------------------------------------------------------------------
// POST /api/inquire/start
// ---------------------------------------------------------------------------

export async function startSubmission(input: {
  body: unknown;
  headers: Headers;
  now?: Date;
}): Promise<ServiceResult<StartResponse>> {
  const now = input.now ?? new Date();
  const parsed = parseStartBody(input.body);
  if (!parsed.ok) return fail(400, parsed.error);
  const { formSlug, answers: incoming, attribution, hp, elapsedMs, turnstileToken } = parsed.value;
  if (!isValidSlug(formSlug)) return fail(404, COPY.notLive);

  try {
    const sb = createServiceClient();
    const live = await loadLiveForm(sb, formSlug);
    if (!live) return fail(404, COPY.notLive);
    const { form, versionId, definition } = live;
    const today = todayInTz(now);

    const answers = stripHidden(definition, mergeAnswers({}, sanitizeStepAnswers(definition, 0, incoming)));
    const fieldErrors = validateStep(definition.steps[0], answers, { today });
    if (hasErrors(fieldErrors)) return fail(400, COPY.checkFields, { fieldErrors, stepIndex: 0 });
    const contact = contactColumns(definition, answers);
    if (!hasContact(contact)) {
      return fail(400, COPY.needContact, { fieldErrors: missingContactErrors(definition), stepIndex: 0 });
    }

    const business = await getBusinessSettings(sb);
    const ip = clientIpFrom(input.headers);
    const ipHash = ipHashFor(ip);
    let spamReason: SpamReason | null = startSignalsSpamReason({ hp, elapsedMs });
    const starts = await countHit(sb, RATE_KEYS.starts(ipHash), hourWindowStart(now));
    // Far past the limit nothing is stored at all: the limit alone only labels rows spam.
    if (startHardCapped(starts, business.spam.maxStartsPerIpPerHour)) return fail(429, COPY.tooMany, { retryable: true });
    if (!spamReason && overLimit(starts, business.spam.maxStartsPerIpPerHour)) spamReason = "ip_rate";

    // Turnstile guards the start too: the sweep turns any reachable, never-finished start into a
    // staff alert, so checking only at completion would leave that path open.
    let turnstileUnverified = false;
    if (!spamReason && isTurnstileOn(business)) {
      const decision = turnstileDecision(await verifyTurnstile(turnstileToken, ip));
      if (decision.action === "retry") return fail(400, COPY.finishCheck, { retryable: true });
      if (decision.action === "spam") spamReason = decision.reason;
      if (decision.action === "accept_logged") turnstileUnverified = true;
    }

    const qualification: Qualification = {};
    const budget = budgetQualification(definition, answers);
    if (budget) qualification.budget = budget;
    const token = newToken();
    const total = definition.steps.length;
    const currentStep = nextCurrentStep(0, 0, total);
    const nowIso = now.toISOString();

    const { data, error } = await sb
      .from(TABLES.submissions)
      .insert({
        form_id: form.id,
        version_id: versionId,
        stage: spamReason ? "spam" : "in_progress",
        current_step: currentStep,
        total_steps: total,
        answers,
        ...contact,
        qualification,
        ...scoreOf(qualification),
        attribution: sanitizeAttribution(attribution),
        ip_hash: ipHash,
        user_agent: capUserAgent(input.headers.get("user-agent")),
        token_hash: hashToken(token),
        spam_reason: spamReason,
        started_at: nowIso,
        last_activity_at: nowIso,
      })
      .select("id")
      .single();
    if (error || !data) return serverError("create submission", error?.message ?? "no row returned");
    const submissionId = String((data as { id: unknown }).id);

    if (spamReason) {
      await writeLog(sb, { submissionId, kind: LOG_KINDS.spam, status: "skipped", detail: { reason: spamReason, at: "start" } });
    } else {
      await bumpStat(sb, form.id, today, "starts");
    }
    if (turnstileUnverified) {
      await writeLog(sb, {
        submissionId,
        kind: LOG_KINDS.checkError,
        status: "failed",
        detail: { error: "Turnstile could not be verified at start; the visitor was let in." },
      });
    }
    return ok({ ok: true, submissionId, token, currentStep });
  } catch (err) {
    return serverError("start", err);
  }
}

// ---------------------------------------------------------------------------
// Shared lookups for token calls
// ---------------------------------------------------------------------------

type Authorized =
  | { ok: true; sb: SupabaseClient; sub: SubmissionRecord }
  | { ok: false; result: ServiceResult<never> };

async function authorize(submissionId: string, token: string): Promise<Authorized> {
  if (!isUuid(submissionId)) return { ok: false, result: fail(404, COPY.notFound) };
  const sb = createServiceClient();
  const sub = await loadSubmission(sb, submissionId);
  if (!sub) return { ok: false, result: fail(404, COPY.notFound) };
  if (!tokenMatches(token, sub.token_hash)) return { ok: false, result: fail(403, COPY.badToken) };
  return { ok: true, sb, sub };
}

// ---------------------------------------------------------------------------
// POST /api/inquire/[id]/save
// ---------------------------------------------------------------------------

export async function saveStep(input: { submissionId: string; body: unknown; now?: Date }): Promise<ServiceResult<SaveResponse>> {
  const now = input.now ?? new Date();
  const parsed = parseSaveBody(input.body);
  if (!parsed.ok) return fail(400, parsed.error);
  const { token, stepIndex, answers: incoming } = parsed.value;

  try {
    const auth = await authorize(input.submissionId, token);
    if (!auth.ok) return auth.result;
    const { sb, sub } = auth;
    if (sub.completed_at) return fail(409, COPY.alreadySent);
    if (!withinUpdateWindow(sub.started_at, now)) return fail(410, COPY.expired);
    const loaded = await loadSubmissionForm(sb, sub);
    // Archiving a form is the kill switch: sessions issued before it stop saving, checking and completing.
    if (!loaded || loaded.form.status === "archived") return fail(404, COPY.notLive);
    const { definition } = loaded.resolved;
    if (stepIndex >= definition.steps.length) return fail(400, COPY.badRequest);

    const today = todayInTz(now);
    const patch = sanitizeStepAnswers(definition, stepIndex, incoming);
    const answers = stripHidden(definition, mergeAnswers(sub.answers, patch));
    const fieldErrors = validateStep(definition.steps[stepIndex], answers, { today });
    if (hasErrors(fieldErrors)) return fail(400, COPY.checkFields, { fieldErrors, stepIndex });
    const contact = contactColumns(definition, answers);
    if (!hasContact(contact)) {
      return fail(400, COPY.needContact, { fieldErrors: missingContactErrors(definition), stepIndex: 0 });
    }

    const qualification: Qualification = { ...sub.qualification };
    applyAltDateChoice(qualification, sub.qualification, contact.event_date);
    const budget = budgetQualification(definition, answers);
    if (budget) qualification.budget = budget;
    else delete qualification.budget;
    const currentStep = nextCurrentStep(sub.current_step, stepIndex, definition.steps.length);

    const update: Record<string, unknown> = {
      answers,
      ...contact,
      qualification,
      ...scoreOf(qualification),
      current_step: currentStep,
      last_activity_at: now.toISOString(),
    };
    if (sub.stage === "abandoned") update.stage = "in_progress";
    const { data, error } = await sb
      .from(TABLES.submissions)
      .update(update)
      .eq("id", sub.id)
      .is("completed_at", null)
      .select("id");
    if (error) return serverError("save step", error.message);
    if (!data || data.length === 0) return fail(409, COPY.alreadySent);
    return ok({ ok: true, currentStep });
  } catch (err) {
    return serverError("save", err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/inquire/[id]/ping  (heartbeat; also sendBeacon on pagehide)
// ---------------------------------------------------------------------------

export async function pingSubmission(input: {
  submissionId: string;
  body: unknown;
  now?: Date;
}): Promise<ServiceResult<{ ok: true }>> {
  const now = input.now ?? new Date();
  const parsed = parseTokenBody(input.body);
  if (!parsed.ok) return fail(400, parsed.error);
  try {
    const auth = await authorize(input.submissionId, parsed.value.token);
    if (!auth.ok) return auth.result;
    const { sb, sub } = auth;
    if (sub.completed_at || sub.stage === "spam") return ok({ ok: true });
    if (!withinUpdateWindow(sub.started_at, now)) return fail(410, COPY.expired);
    const last = Date.parse(sub.last_activity_at);
    if (sub.stage !== "abandoned" && Number.isFinite(last) && now.getTime() - last < PING_MIN_GAP_MS) {
      return ok({ ok: true });
    }
    const update: Record<string, unknown> = { last_activity_at: now.toISOString() };
    if (sub.stage === "abandoned") update.stage = "in_progress";
    const { error } = await sb.from(TABLES.submissions).update(update).eq("id", sub.id).is("completed_at", null);
    if (error) return serverError("ping", error.message);
    return ok({ ok: true });
  } catch (err) {
    return serverError("ping", err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/inquire/[id]/qualify
// ---------------------------------------------------------------------------

export async function qualifySubmission(input: {
  submissionId: string;
  body: unknown;
  now?: Date;
}): Promise<ServiceResult<QualifyResponse>> {
  const now = input.now ?? new Date();
  const parsed = parseTokenBody(input.body);
  if (!parsed.ok) return fail(400, parsed.error);
  try {
    const auth = await authorize(input.submissionId, parsed.value.token);
    if (!auth.ok) return auth.result;
    const { sb, sub } = auth;
    if (sub.completed_at) return fail(409, COPY.alreadySent);
    if (!withinUpdateWindow(sub.started_at, now)) return fail(410, COPY.expired);
    const loaded = await loadSubmissionForm(sb, sub);
    if (!loaded || loaded.form.status === "archived") return fail(404, COPY.notLive);
    const { definition, settings } = loaded.resolved;
    const business = await getBusinessSettings(sb);
    const qstep = qualifyStepOf(definition);
    const checks = qstep?.checks ?? [];

    // Spam: a plausible, cheap answer with no lookups (no geocoding amplification), nothing stored.
    if (sub.stage === "spam") {
      const canned: Qualification = {};
      const checkedAt = now.toISOString();
      if (checks.includes("date")) {
        canned.date = { result: "unknown", checkedFor: sub.event_date, message: business.availability.messages.unknown, checkedAt };
      }
      if (checks.includes("location")) {
        canned.location = { result: "unverified", message: business.location.messages.unverified, checkedAt };
      }
      return ok({ ok: true, qualification: canned, celebrate: false, urgency: null });
    }

    const hits = await countHit(sb, RATE_KEYS.qualify(sub.id), hourWindowStart(now));
    if (overLimit(hits, MAX_QUALIFY_PER_HOUR)) return fail(429, COPY.tooMany, { retryable: true });

    const { qualification, errors } = await runChecks(sb, {
      definition,
      settings,
      business,
      answers: sub.answers,
      prev: sub.qualification,
      checks,
      today: todayInTz(now),
      geocodeBudget: visitorGeocodeBudget(sb, sub.ip_hash, now),
    });
    await logCheckErrors(sb, sub.id, errors);

    const update: Record<string, unknown> = {
      qualification,
      ...scoreOf(qualification),
      current_step: qstep ? nextCurrentStep(sub.current_step, qstep.index, definition.steps.length) : sub.current_step,
      last_activity_at: now.toISOString(),
    };
    if (sub.stage === "abandoned") update.stage = "in_progress";
    const { data, error } = await sb
      .from(TABLES.submissions)
      .update(update)
      .eq("id", sub.id)
      .is("completed_at", null)
      .select("id");
    if (error) return serverError("store qualification", error.message);
    if (!data || data.length === 0) return fail(409, COPY.alreadySent);

    return ok({
      ok: true,
      qualification: visitorQualification(qualification),
      celebrate: celebrateFor(qualification, checks, settings),
      urgency: urgencyFor(qualification, settings),
    });
  } catch (err) {
    return serverError("qualify", err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/inquire/[id]/complete
// ---------------------------------------------------------------------------

export async function completeSubmission(input: {
  submissionId: string;
  body: unknown;
  headers: Headers;
  now?: Date;
}): Promise<ServiceResult<CompleteResponse>> {
  const now = input.now ?? new Date();
  const parsed = parseCompleteBody(input.body);
  if (!parsed.ok) return fail(400, parsed.error);
  const body = parsed.value;

  try {
    const auth = await authorize(input.submissionId, body.token);
    if (!auth.ok) return auth.result;
    const { sb, sub } = auth;
    const loaded = await loadSubmissionForm(sb, sub);
    if (!loaded) return fail(404, COPY.notLive);
    const { definition, settings } = loaded.resolved;

    // Idempotent: a second call (double click, retry) gets the same ending, nothing runs again.
    if (sub.completed_at) {
      return ok({ ok: true, ending: endingFor(settings, storedEndingKind(sub.stage, body.ending, settings)) });
    }
    if (loaded.form.status === "archived") return fail(404, COPY.notLive);
    if (!withinUpdateWindow(sub.started_at, now)) return fail(410, COPY.expired);

    // Last step, then every visible required field of every step (server-side, never trusted).
    const today = todayInTz(now);
    const lastIndex = definition.steps.length - 1;
    const answers = stripHidden(
      definition,
      mergeAnswers(sub.answers, sanitizeStepAnswers(definition, lastIndex, body.answers)),
    );
    const lastErrors = validateStep(definition.steps[lastIndex], answers, { today });
    if (hasErrors(lastErrors)) return fail(400, COPY.checkFields, { fieldErrors: lastErrors, stepIndex: lastIndex });
    const invalid = firstInvalidStep(definition, answers, today);
    if (invalid) return fail(400, COPY.checkFields, { fieldErrors: invalid.fieldErrors, stepIndex: invalid.stepIndex });
    const contact = contactColumns(definition, answers);
    if (!hasContact(contact)) {
      return fail(400, COPY.needContact, { fieldErrors: missingContactErrors(definition), stepIndex: 0 });
    }

    const ending = resolveEnding(body.ending, settings);
    const business = await getBusinessSettings(sb);

    // Spam verdict, computed once (start signals were stored as stage "spam").
    let spamReason: SpamReason | null = sub.stage === "spam" ? ((sub.spam_reason as SpamReason | null) ?? "honeypot") : null;
    let newSpam = false;
    // Turnstile first: a missing token is never silent spam (the visitor finishes the check and
    // sends again, nothing stored), and a failed one never spends the per-email allowance.
    if (!spamReason && isTurnstileOn(business)) {
      const decision = turnstileDecision(await verifyTurnstile(body.turnstileToken, clientIpFrom(input.headers)));
      if (decision.action === "retry") return fail(400, COPY.finishCheck, { retryable: true });
      if (decision.action === "spam") {
        spamReason = decision.reason;
        newSpam = true;
      } else if (decision.action === "accept_logged") {
        await writeLog(sb, {
          submissionId: sub.id,
          kind: LOG_KINDS.checkError,
          status: "failed",
          detail: { error: "Turnstile could not be verified; the inquiry was accepted." },
        });
      }
    }
    // Completes per email per day count inquiries, not attempts: each submission counts once, so a
    // retry after a failed flip or a double click never pushes a real inquiry over the limit.
    if (!spamReason && contact.contact_email) {
      const once = await countHit(sb, RATE_KEYS.completeOnce(sub.id), easternDayWindowStart(now));
      if (countsTowardEmailLimit(once)) {
        const completes = await countHit(
          sb,
          RATE_KEYS.completes(emailKeyFor(contact.contact_email)),
          easternDayWindowStart(now),
        );
        if (overLimit(completes, business.spam.maxCompletesPerEmailPerDay)) {
          spamReason = "email_rate";
          newSpam = true;
        }
      }
    }

    // Final verdicts: re-run any check whose answer changed since qualify (or that never ran).
    let qualification: Qualification = { ...sub.qualification };
    if (!spamReason) {
      const checks = qualifyStepOf(definition)?.checks ?? [];
      const stale = staleChecks(qualification, checks, {
        date: eventDateOf(definition, answers),
        locationText: locationInputFromAnswers(definition, answers)?.text ?? null,
      });
      const ran = await runChecks(sb, {
        definition,
        settings,
        business,
        answers,
        prev: qualification,
        checks: stale,
        today,
        geocodeBudget: visitorGeocodeBudget(sb, sub.ip_hash, now),
      });
      qualification = ran.qualification;
      await logCheckErrors(sb, sub.id, ran.errors);
    } else {
      const budget = budgetQualification(definition, answers);
      if (budget) qualification.budget = budget;
    }
    const scored = computeScore(qualification);
    const nowIso = now.toISOString();

    const { data, error } = await sb
      .from(TABLES.submissions)
      .update({
        stage: spamReason ? "spam" : ending,
        completed_at: nowIso,
        last_activity_at: nowIso,
        current_step: definition.steps.length,
        answers,
        ...contact,
        qualification,
        score: scored.score,
        score_label: scored.label,
        spam_reason: spamReason,
      })
      .eq("id", sub.id)
      .is("completed_at", null)
      .select("*");
    if (error) return serverError("complete", error.message);
    const flipped = (data ?? [])[0] as Record<string, unknown> | undefined;
    if (!flipped) {
      // Another request finished it a moment ago: answer with the ending it got.
      const latest = await loadSubmission(sb, sub.id);
      return ok({ ok: true, ending: endingFor(settings, storedEndingKind(latest?.stage ?? "", body.ending, settings)) });
    }

    if (newSpam) {
      await writeLog(sb, { submissionId: sub.id, kind: LOG_KINDS.spam, status: "skipped", detail: { reason: spamReason, at: "complete" } });
    }
    const submissionId = sub.id;
    return {
      status: 200,
      body: { ok: true, ending: endingFor(settings, ending) },
      // Spam silences every outbound: no CRM card, no staff alert, no email, no stats.
      afterResponse: spamReason ? undefined : () => runCompletionSideEffects(submissionId).then(() => undefined),
    };
  } catch (err) {
    return serverError("complete", err);
  }
}

// ---------------------------------------------------------------------------
// Completion side effects (after() on the flipping request, and the sweep re-drive)
// ---------------------------------------------------------------------------

export interface SideEffectReport {
  /** busy = another writer holds the CRM write right now (it creates the card, not this run). */
  crm: "done" | "created" | "busy" | "failed" | "gave_up" | "skipped";
  staff: "done" | "sent" | "failed" | "gave_up" | "skipped";
  confirmation: "sent" | "failed" | "skipped";
  stats: "done" | "counted" | "failed";
  /** One-way LeadLeaf (GoHighLevel) copy: done = already sent earlier. */
  ghl: "done" | "sent" | "failed" | "gave_up" | "skipped";
}

/**
 * Whether a copy of this kind is still owed: never after a sent row, never past MAX_ATTEMPTS
 * failures, never for a copy that is off, never after the retry window.
 */
async function copyState(
  sb: SupabaseClient,
  submissionId: string,
  kind: typeof LOG_KINDS.ghlCopy,
  enabled: boolean,
  completedAt: string | null,
  now: Date,
): Promise<"owed" | "done" | "gave_up" | "skipped"> {
  if (!enabled) return "skipped";
  if ((await countLog(sb, submissionId, kind, "sent")) > 0) return "done";
  if ((await countLog(sb, submissionId, kind, "failed")) >= MAX_ATTEMPTS) return "gave_up";
  const age = now.getTime() - Date.parse(completedAt ?? "");
  if (Number.isFinite(age) && age > COPY_RETRY_WINDOW_MS) return "gave_up";
  return "owed";
}

function crmReportOf(outcome: CrmWriteResult["outcome"]): SideEffectReport["crm"] {
  return outcome === "relinked" ? "done" : outcome;
}

/**
 * Run (or finish) everything a completed / waitlisted submission owes: CRM card, staff alert,
 * confirmation email, stats. Safe to call again: each step checks state and the log first, and
 * the CRM card is claimed before it is written (the staff "Add to Leads" button claims too), so
 * concurrent runs never create two cards. `writer` is "completion" for the after() run and
 * "sweep" for the cron re-drive (which may take over a claim whose holder died).
 */
export async function runCompletionSideEffects(
  submissionId: string,
  now: Date = new Date(),
  writer: Extract<CrmWriter, "completion" | "sweep"> = "completion",
): Promise<SideEffectReport> {
  const report: SideEffectReport = {
    crm: "skipped",
    staff: "skipped",
    confirmation: "skipped",
    stats: "done",
    ghl: "skipped",
  };
  let sb: SupabaseClient;
  try {
    sb = createServiceClient();
  } catch (err) {
    console.error("[inquiry-forms] side effects: no service client", errorText(err));
    return report;
  }
  try {
    const sub = await loadSubmission(sb, submissionId);
    if (!sub || !sub.completed_at || (sub.stage !== "completed" && sub.stage !== "waitlisted")) return report;
    const loaded = await loadSubmissionForm(sb, sub);
    if (!loaded) {
      await writeLog(sb, {
        submissionId,
        kind: LOG_KINDS.crmRecord,
        status: "failed",
        detail: { error: "The form version of this submission could not be loaded." },
      });
      report.crm = "failed";
      return report;
    }
    const { form, resolved } = loaded;
    const formRef = { id: form.id, name: form.name, slug: form.slug };
    const a = adapter();
    const brand = resolveBrand(a.brands, resolved.settings.brand || form.brand, a.defaultBrand);

    // 1. CRM card (Leads) + client. Needs nothing but the submission and its form. A read or
    // claim error (nothing written yet) counts as a failed attempt and never skips the staff alert.
    let crmRef = sub.crm_ref;
    try {
      const crm = await writeCrmRecord(sb, {
        writer,
        submission: publicRow(sub),
        form: formRef,
        definition: resolved.definition,
        ownerEmail: ownerFor(resolved.settings, resolved.definition, sub.answers),
      });
      report.crm = crmReportOf(crm.outcome);
      crmRef = crm.ref;
    } catch (err) {
      report.crm = "failed";
      console.error("[inquiry-forms] CRM write could not start", submissionId, errorText(err));
      await writeLog(sb, {
        submissionId,
        kind: LOG_KINDS.crmRecord,
        status: "failed",
        channel: "crm",
        detail: { error: errorText(err) },
      });
    }
    const current: SubmissionRecord = { ...sub, crm_ref: crmRef };

    // Emails only use the business emoji prefix; a failed read must not stop the staff alert.
    const business = await getBusinessSettings(sb).catch((err: unknown) => {
      console.error("[inquiry-forms] side effects: business settings fell back to defaults", errorText(err));
      return hubBusinessDefaults();
    });
    const ctx: InquiryContext = {
      submission: current,
      form: formRef,
      definition: resolved.definition,
      settings: resolved.settings,
      business,
      brand,
    };

    // Each step is isolated: a failure in one never skips the others.
    const isolated = async (name: string, fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (err) {
        console.error(`[inquiry-forms] side effect "${name}" failed`, submissionId, errorText(err));
      }
    };

    // 2. Staff alert (in-app + optional emails), stamped once someone heard.
    await isolated("staff alert", async () => {
      const stampStaff = async () => {
        const { error } = await sb
          .from(TABLES.submissions)
          .update({ staff_notified_at: new Date().toISOString() })
          .eq("id", sub.id);
        if (error) console.error("[inquiry-forms] staff_notified_at stamp failed", sub.id, error.message);
      };
      if (current.staff_notified_at) {
        report.staff = "done";
      } else if (
        (await countLog(sb, sub.id, LOG_KINDS.staffNotify, "sent")) > 0 ||
        (await countLog(sb, sub.id, LOG_KINDS.staffEmail, "sent")) > 0
      ) {
        // Staff already heard; only the stamp was lost. Never alert twice.
        await stampStaff();
        report.staff = "done";
      } else if ((await countLog(sb, sub.id, LOG_KINDS.staffNotify)) >= MAX_ATTEMPTS) {
        report.staff = "gave_up";
      } else {
        report.staff = "failed";
        const { heard } = await notifyStaffOfInquiry(sb, a, ctx);
        report.staff = heard ? "sent" : "failed";
        if (heard) await stampStaff();
      }
    });

    // 3. Confirmation to the visitor: never twice, and never long after the fact.
    await isolated("confirmation", async () => {
      if (current.confirmation_sent_at || (await countLog(sb, sub.id, LOG_KINDS.confirmation)) > 0) return;
      const age = now.getTime() - Date.parse(current.completed_at ?? "");
      if (Number.isFinite(age) && age <= CONFIRMATION_LATE_LIMIT_MS) {
        report.confirmation = await sendInquiryConfirmation(sb, a, ctx);
      }
    });

    // 4. Funnel stats (once).
    await isolated("stats", async () => {
      if ((await countLog(sb, sub.id, LOG_KINDS.stats, "sent")) > 0) return;
      const day = easternDayKey(current.completed_at ?? now.toISOString()) || todayInTz(now);
      const counted = await bumpStat(sb, sub.form_id, day, "completes");
      report.stats = counted ? "counted" : "failed";
      await writeLog(sb, {
        submissionId: sub.id,
        kind: LOG_KINDS.stats,
        status: counted ? "sent" : "failed",
        channel: "stats",
        detail: { field: "completes", day },
      });
    });

    // 5. One-way LeadLeaf copy (after the CRM card, so the copy never holds up or replaces the
    // hub's own record).
    const copyCtx: CopyContext = {
      submission: current,
      form: formRef,
      definition: resolved.definition,
      settings: resolved.settings,
      hubLink: `${a.publicOrigin()}${staffHref(a, current)}`,
    };
    const copies = resolved.settings.copies;
    await isolated("ghl copy", async () => {
      const state = await copyState(sb, sub.id, LOG_KINDS.ghlCopy, Boolean(copies.ghl?.enabled), current.completed_at, now);
      report.ghl = state === "owed" ? await sendGhlCopy(sb, copyCtx, now) : state;
    });
    return report;
  } catch (err) {
    console.error("[inquiry-forms] side effects failed", submissionId, errorText(err));
    return report;
  }
}

// ---------------------------------------------------------------------------
// POST /api/inquire/view
// ---------------------------------------------------------------------------

/** The form named by a slug (preferred) or an id; null when neither is usable or it does not exist. */
async function formFromRef(sb: SupabaseClient, ref: { slug: string | null; formId: string | null }): Promise<FormRecord | null> {
  if (ref.slug && isValidSlug(ref.slug)) return loadFormBySlug(sb, ref.slug);
  if (ref.formId) return loadFormById(sb, ref.formId);
  return null;
}

/** One view per IP hash per form per 30 minutes. Never throws (the route always answers 204). */
export async function recordView(input: { body: unknown; ip: string | null; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  const parsed = parseSlugBody(input.body);
  if (!parsed.ok) return;
  try {
    const sb = createServiceClient();
    const form = await formFromRef(sb, parsed.value);
    if (!form || form.status !== "live") return;
    const hits = await countHit(sb, RATE_KEYS.view(form.id, ipHashFor(input.ip)), halfHourWindowStart(now));
    if (hits === 1) await bumpStat(sb, form.id, todayInTz(now), "views");
  } catch (err) {
    console.error("[inquiry-forms] view count failed", errorText(err));
  }
}

// ---------------------------------------------------------------------------
// POST /api/inquire/preview/qualify  (admin dry run of the DRAFT; nothing stored)
// ---------------------------------------------------------------------------

export async function previewQualify(input: { body: unknown; now?: Date }): Promise<ServiceResult<QualifyResponse>> {
  const now = input.now ?? new Date();
  const a = adapter();
  const admin = await a.currentAdmin();
  if (!admin) return fail(403, COPY.adminOnly);
  const parsed = parseSlugBody(input.body);
  if (!parsed.ok) return fail(400, parsed.error);
  try {
    const sb = createServiceClient();
    const form = await formFromRef(sb, parsed.value);
    if (!form) return fail(404, COPY.notLive);
    const resolved = resolveForm(form.definition, form.settings);
    if (!resolved) return fail(400, COPY.draftInvalid);
    const hits = await countHit(sb, RATE_KEYS.preview(admin.id), hourWindowStart(now));
    if (overLimit(hits, MAX_PREVIEW_PER_HOUR)) return fail(429, COPY.tooMany, { retryable: true });

    const { definition, settings } = resolved;
    let answers: Answers = {};
    definition.steps.forEach((_step, i) => {
      answers = mergeAnswers(answers, sanitizeStepAnswers(definition, i, parsed.value.answers));
    });
    answers = stripHidden(definition, answers);
    const business = await getBusinessSettings(sb);
    const checks = qualifyStepOf(definition)?.checks ?? [];
    const { qualification, errors } = await runChecks(sb, {
      definition,
      settings,
      business,
      answers,
      prev: {},
      checks,
      today: todayInTz(now),
    });
    for (const e of errors) console.error("[inquiry-forms] preview check answered unknown/unverified", e);
    return ok({
      ok: true,
      // Admins see the staff details (miles, confidence) in the dry run.
      qualification,
      celebrate: celebrateFor(qualification, checks, settings),
      urgency: urgencyFor(qualification, settings),
    });
  } catch (err) {
    return serverError("preview qualify", err);
  }
}

// ---------------------------------------------------------------------------
// GET|POST /api/cron/inquiry-forms-sweep
// ---------------------------------------------------------------------------

export interface SweepSummary {
  ok: boolean;
  abandoned: number;
  alerted: number;
  alertFailed: number;
  alertSkipped: number;
  alertRetried: number;
  redriven: number;
  redriveFailed: number;
  pruned: number;
  /** Spam submissions deleted after SPAM_RETENTION_MS (their log rows go with them). */
  prunedSpam: number;
  errors: string[];
}

/**
 * Compare-and-set claim on a row (the updated_at trigger moves it, so a second sweeper loses).
 * The claim also needs the row to have been quiet for CLAIM_QUIET_MS: a sweep that read the row
 * just after another sweep claimed it sees that fresh updated_at and must not claim it again while
 * the first one is still sending (the holder runs inside the 60 s sweep limit).
 */
async function claimRow(sb: SupabaseClient, id: string, updatedAt: string, now: Date): Promise<boolean> {
  const quietBefore = new Date(now.getTime() - CLAIM_QUIET_MS).toISOString();
  const { data, error } = await sb
    .from(TABLES.submissions)
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("updated_at", updatedAt)
    .lt("updated_at", quietBefore)
    .select("id");
  if (error) throw new Error(`claim ${id}: ${error.message}`);
  return Boolean(data && data.length > 0);
}

export async function runSweep(now: Date = new Date()): Promise<SweepSummary> {
  const summary: SweepSummary = {
    ok: true,
    abandoned: 0,
    alerted: 0,
    alertFailed: 0,
    alertSkipped: 0,
    alertRetried: 0,
    redriven: 0,
    redriveFailed: 0,
    pruned: 0,
    prunedSpam: 0,
    errors: [],
  };
  const note = (step: string, err: unknown) => {
    summary.ok = false;
    summary.errors.push(`${step}: ${errorText(err)}`);
  };

  let sb: SupabaseClient;
  let business: BusinessSettings;
  try {
    sb = createServiceClient();
    business = await getBusinessSettings(sb);
  } catch (err) {
    note("setup", err);
    return summary;
  }
  const a = adapter();
  const nowIso = now.toISOString();
  const floorIso = new Date(now.getTime() - ABANDON_MAX_AGE_MS).toISOString();
  const formCache = new Map<string, { name: string; definition: FormDefinition | null; archived: boolean }>();
  const formInfo = async (sub: SubmissionRecord) => {
    const key = `${sub.form_id}:${sub.version_id ?? ""}`;
    const hit = formCache.get(key);
    if (hit) return hit;
    const loaded = await loadSubmissionForm(sb, sub);
    const info = loaded
      ? { name: loaded.form.name, definition: loaded.resolved.definition, archived: loaded.form.status === "archived" }
      : { name: "a website form", definition: null, archived: false };
    formCache.set(key, info);
    return info;
  };
  const stampAbandonNotified = async (id: string) => {
    const { error } = await sb.from(TABLES.submissions).update({ abandon_notified_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(`stamp ${id}: ${error.message}`);
  };
  const alertOne = async (sub: SubmissionRecord): Promise<"sent" | "failed" | "skipped"> => {
    if (!business.abandonment.alertStaff) {
      await writeLog(sb, {
        submissionId: sub.id,
        kind: LOG_KINDS.abandonAlert,
        status: "skipped",
        channel: "in_app",
        detail: { reason: "Unfinished inquiry alerts are off in business settings." },
      });
      await stampAbandonNotified(sub.id);
      return "skipped";
    }
    const info = await formInfo(sub);
    if (info.archived) {
      // Archiving a form is the kill switch: no unfinished alerts for it either.
      await writeLog(sb, {
        submissionId: sub.id,
        kind: LOG_KINDS.abandonAlert,
        status: "skipped",
        channel: "in_app",
        detail: { reason: "The form is archived." },
      });
      await stampAbandonNotified(sub.id);
      return "skipped";
    }
    const sent = await notifyStaffOfUnfinished(sb, a, { submission: sub, formName: info.name, definition: info.definition });
    if (sent) await stampAbandonNotified(sub.id);
    return sent ? "sent" : "failed";
  };
  const tally = (outcome: "sent" | "failed" | "skipped") => {
    if (outcome === "sent") summary.alerted += 1;
    else if (outcome === "failed") summary.alertFailed += 1;
    else summary.alertSkipped += 1;
  };

  // A. Abandonment: in_progress, reachable, idle past the delay, not older than 48 h, never alerted.
  try {
    const cutoffIso = new Date(now.getTime() - business.abandonment.delayMinutes * 60 * 1000).toISOString();
    const { data: candidates, error } = await sb
      .from(TABLES.submissions)
      .select("id")
      .eq("stage", "in_progress")
      .is("abandon_notified_at", null)
      .lt("last_activity_at", cutoffIso)
      .gt("last_activity_at", floorIso)
      .or("contact_email.not.is.null,contact_phone.not.is.null")
      .order("last_activity_at", { ascending: true })
      .limit(SWEEP_BATCH);
    if (error) throw new Error(error.message);
    const ids = (candidates ?? []).map((r) => String((r as { id: unknown }).id));
    if (ids.length > 0) {
      // The claim re-checks every condition, so two overlapping sweeps never both alert.
      const { data: claimed, error: claimError } = await sb
        .from(TABLES.submissions)
        .update({ stage: "abandoned", abandoned_at: nowIso })
        .in("id", ids)
        .eq("stage", "in_progress")
        .is("abandon_notified_at", null)
        .lt("last_activity_at", cutoffIso)
        .select("*");
      if (claimError) throw new Error(claimError.message);
      for (const raw of claimed ?? []) {
        const sub = toSubmissionRecord(raw as Record<string, unknown>);
        summary.abandoned += 1;
        try {
          tally(await alertOne(sub));
        } catch (err) {
          summary.alertFailed += 1;
          note(`alert ${sub.id}`, err);
        }
      }
    }
  } catch (err) {
    note("abandonment", err);
  }

  // B. Retry unfinished alerts that failed earlier (max 3 attempts each).
  try {
    const retryBefore = new Date(now.getTime() - ABANDON_RETRY_AFTER_MS).toISOString();
    const { data: stuck, error } = await sb
      .from(TABLES.submissions)
      .select("*")
      .eq("stage", "abandoned")
      .is("abandon_notified_at", null)
      .lt("abandoned_at", retryBefore)
      .gt("abandoned_at", floorIso)
      .limit(SWEEP_BATCH);
    if (error) throw new Error(error.message);
    for (const raw of stuck ?? []) {
      const sub = toSubmissionRecord(raw as Record<string, unknown>);
      try {
        if ((await countLog(sb, sub.id, LOG_KINDS.abandonAlert, "sent")) > 0) {
          // The alert went out; only the stamp was lost. Never alert twice.
          await stampAbandonNotified(sub.id);
          continue;
        }
        if ((await countLog(sb, sub.id, LOG_KINDS.abandonAlert)) >= MAX_ATTEMPTS) continue;
        if (!(await claimRow(sb, sub.id, sub.updated_at, now))) continue;
        summary.alertRetried += 1;
        tally(await alertOne(sub));
      } catch (err) {
        note(`alert retry ${sub.id}`, err);
      }
    }
  } catch (err) {
    note("alert retry", err);
  }

  // C. Re-drive completions whose CRM card or staff alert never logged success.
  try {
    const newest = new Date(now.getTime() - REDRIVE_AFTER_MS).toISOString();
    const oldest = new Date(now.getTime() - REDRIVE_WINDOW_MS).toISOString();
    const { data: done, error } = await sb
      .from(TABLES.submissions)
      .select("id, crm_ref, staff_notified_at, updated_at")
      .in("stage", ["completed", "waitlisted"])
      .lt("completed_at", newest)
      .gt("completed_at", oldest)
      .order("completed_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    for (const raw of done ?? []) {
      const row = raw as { id: unknown; crm_ref: unknown; staff_notified_at: unknown; updated_at: unknown };
      const id = String(row.id);
      const needsCrm = !crmRefDone(row.crm_ref);
      const needsStaff = !row.staff_notified_at;
      if (!needsCrm && !needsStaff) continue;
      try {
        // Same cap writeCrmRecord applies (planCrmWrite gives up at MAX_AUTO_CRM_ATTEMPTS).
        const crmLeft = needsCrm && (await countLog(sb, id, LOG_KINDS.crmRecord)) < MAX_AUTO_CRM_ATTEMPTS;
        const staffLeft = needsStaff && (await countLog(sb, id, LOG_KINDS.staffNotify)) < MAX_ATTEMPTS;
        // A CRM ref saved only in the log (automatic or staff write) is re-linked by the run too.
        const recoverable =
          needsCrm &&
          !crmLeft &&
          (await latestLogDetails(sb, id, CRM_LOG_KINDS, "sent")).some((detail) => crmRefDone(refFromLogDetail(detail)));
        if (!crmLeft && !staffLeft && !recoverable) continue;
        if (!(await claimRow(sb, id, String(row.updated_at), now))) continue;
        const report = await runCompletionSideEffects(id, now, "sweep");
        summary.redriven += 1;
        if (report.crm === "failed" || report.staff === "failed") summary.redriveFailed += 1;
      } catch (err) {
        summary.redriveFailed += 1;
        note(`redrive ${id}`, err);
      }
    }
  } catch (err) {
    note("redrive", err);
  }

  // C2. Re-drive the one-way LeadLeaf (GoHighLevel) copy still owed inside their retry window. The
  // log says what was sent or failed; the form version says which copies are on.
  try {
    const newest = new Date(now.getTime() - REDRIVE_AFTER_MS).toISOString();
    const oldest = new Date(now.getTime() - COPY_RETRY_WINDOW_MS).toISOString();
    const { data: recent, error } = await sb
      .from(TABLES.submissions)
      .select("id, form_id, version_id, updated_at")
      .in("stage", ["completed", "waitlisted"])
      .lt("completed_at", newest)
      .gt("completed_at", oldest)
      .order("completed_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = (recent ?? []).map((raw) => {
      const r = raw as { id: unknown; form_id: unknown; version_id: unknown; updated_at: unknown };
      return {
        id: String(r.id),
        form_id: String(r.form_id),
        version_id: typeof r.version_id === "string" ? r.version_id : null,
        updated_at: String(r.updated_at),
      };
    });
    if (rows.length > 0) {
      const { data: logs, error: logError } = await sb
        .from(TABLES.log)
        .select("submission_id, kind, status")
        .in("submission_id", rows.map((r) => r.id))
        .in("kind", [LOG_KINDS.ghlCopy]);
      if (logError) throw new Error(logError.message);
      const tally = new Map<string, { sent: number; failed: number }>();
      for (const raw of logs ?? []) {
        const l = raw as { submission_id: unknown; kind: unknown; status: unknown };
        const key = `${String(l.submission_id)}|${String(l.kind)}`;
        const t = tally.get(key) ?? { sent: 0, failed: 0 };
        if (l.status === "sent") t.sent += 1;
        if (l.status === "failed") t.failed += 1;
        tally.set(key, t);
      }
      const owed = (id: string, kind: string, enabled: boolean) => {
        const t = tally.get(`${id}|${kind}`) ?? { sent: 0, failed: 0 };
        return enabled && t.sent === 0 && t.failed < MAX_ATTEMPTS;
      };
      const copiesByVersion = new Map<string, FormSettings["copies"] | null>();
      for (const row of rows) {
        try {
          const cacheKey = row.version_id ?? `form:${row.form_id}`;
          let copies = copiesByVersion.get(cacheKey);
          if (copies === undefined) {
            const loaded = await loadSubmissionForm(sb, row);
            copies = loaded ? loaded.resolved.settings.copies : null;
            copiesByVersion.set(cacheKey, copies);
          }
          if (!copies) continue;
          const need = owed(row.id, LOG_KINDS.ghlCopy, Boolean(copies.ghl?.enabled));
          if (!need) continue;
          if (!(await claimRow(sb, row.id, row.updated_at, now))) continue;
          const report = await runCompletionSideEffects(row.id, now, "sweep");
          summary.redriven += 1;
          if (report.ghl === "failed") summary.redriveFailed += 1;
        } catch (err) {
          summary.redriveFailed += 1;
          note(`copy redrive ${row.id}`, err);
        }
      }
    }
  } catch (err) {
    note("copy redrive", err);
  }

  // D. Prune rate-limit windows older than 2 days.
  try {
    const { count, error } = await sb
      .from(TABLES.rateLimits)
      .delete({ count: "exact" })
      .lt("window_start", new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString());
    if (error) throw new Error(error.message);
    summary.pruned = count ?? 0;
  } catch (err) {
    note("prune", err);
  }

  // E. Delete spam submissions older than 30 days, log rows first (the log keeps a set-null link).
  try {
    const before = new Date(now.getTime() - SPAM_RETENTION_MS).toISOString();
    const { data: old, error } = await sb
      .from(TABLES.submissions)
      .select("id")
      .eq("stage", "spam")
      .lt("created_at", before)
      .limit(SPAM_PRUNE_BATCH);
    if (error) throw new Error(error.message);
    const ids = (old ?? []).map((r) => String((r as { id: unknown }).id));
    if (ids.length > 0) {
      const { error: logError } = await sb.from(TABLES.log).delete().in("submission_id", ids);
      if (logError) throw new Error(logError.message);
      const { count, error: delError } = await sb
        .from(TABLES.submissions)
        .delete({ count: "exact" })
        .in("id", ids)
        .eq("stage", "spam");
      if (delError) throw new Error(delError.message);
      summary.prunedSpam = count ?? 0;
    }
  } catch (err) {
    note("spam prune", err);
  }

  return summary;
}
