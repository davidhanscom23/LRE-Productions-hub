"use server";

/**
 * Inquiry Forms admin server actions (ADMIN-A). Only async functions are exported (a "use server"
 * file may export nothing else).
 *
 * Every action:
 * - checks a REAL admin through adapter.currentAdmin() (never the view-as-staff UI role);
 * - uses the service client (the inquiry tables are admin-only RLS; reads and writes run here);
 * - checks every DB error and answers in plain language (a missing migration says so);
 * - mutations revalidate the /inquiry-forms pages (reads never do: a revalidation would re-render
 *   the page on every table refresh).
 */

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/admin";
import { DEPARTMENTS } from "@/lib/types/database";
import { hubAdapter as adapter } from "@/lib/inquiry-forms/server/adapter";
import { crmWriteInFlight } from "@/lib/inquiry-forms/server/crm-claim-core";
import { writeCrmRecord } from "@/lib/inquiry-forms/server/crm-write";
import { ownerFor } from "@/lib/inquiry-forms/server/forward-core";
import { STARTER_FORMS } from "@/lib/inquiry-forms/server/presets";
import {
  getBusinessSettings as readBusinessSettings,
  saveBusinessSettings as storeBusinessSettings,
} from "@/lib/inquiry-forms/server/settings";
import { publicRow, toSubmissionRecord } from "@/lib/inquiry-forms/server/db";
import { checkLocation, geocode } from "@/lib/inquiry-forms/server/geo";
import { cleanLocationText } from "@/lib/inquiry-forms/server/geo-core";
import { checkDate } from "@/lib/inquiry-forms/server/availability";
import { isUnplaceableAddress } from "@/lib/inquiry-forms/geo-zones";
import { TABLES } from "@/lib/inquiry-forms/server/schema-core";
import { crmRefDone, isUuid } from "@/lib/inquiry-forms/server/lifecycle-core";
import { allFields, coerceDefinition, emptyDefinition, validateDefinition } from "@/lib/inquiry-forms/definition";
import { prepareDraftDefinition } from "@/lib/inquiry-forms/draft";
import { mergeBusinessSettings, mergeFormSettings } from "@/lib/inquiry-forms/defaults";
import { formatAnswerLines } from "@/lib/inquiry-forms/answers";
import { addDays, isValidDateString, todayInTz } from "@/lib/inquiry-forms/dates";
import { isValidSlug, slugFromName } from "@/lib/inquiry-forms/slug";
import type {
  Attribution,
  BrandProfile,
  BusinessSettings,
  DateResult,
  DateVerdict,
  FormDefinition,
  FormSettings,
  LocationResult,
  LocationVerdict,
  Qualification,
  ScoreLabel,
  SubmissionRow,
  SubmissionStage,
} from "@/lib/inquiry-forms/types";
import {
  addStats,
  checkFormName,
  copyName,
  easternMidnightIso,
  emptyStats,
  isMissingTableError,
  isUniqueViolation,
  nextAvailableSlug,
  sameInstant,
} from "@/components/inquiry-forms/admin/list-helpers";
import {
  NEEDS_MIGRATION_MESSAGE,
  isFormStatus,
  type FormListRow,
  type FormStats,
  type FormStatus,
} from "@/components/inquiry-forms/admin/list-types";
import {
  validateBusinessSettings,
  validateFormSettings,
  type SettingsIssue,
} from "@/components/inquiry-forms/admin/settings-validate";
import { CRM_WORDS, STAFF_LOG_KINDS, isStageFilter, sourceSummary } from "@/components/inquiry-forms/admin/submissions-format";
import type {
  StageFilter,
  SubmissionDetail,
  SubmissionFunnel,
  SubmissionListResult,
  SubmissionListRow,
  SubmissionLogEntry,
} from "@/components/inquiry-forms/admin/submissions-types";

// Shared helpers (not exported: only async actions may leave this file)

type Svc = SupabaseClient;
type DbError = { code?: string; message?: string } | null | undefined;
type Admin = { id: string; name: string };

const LIST_PATH = "/inquiry-forms";
const SETTINGS_PATH = "/inquiry-forms/settings";
const PAGE_SIZE = 25;
const STATS_WINDOW_DAYS = 30;
const PAGE_ROWS = 1000;
/** A finished inquiry's automatic Leads write is retried by the sweep for about 15 minutes. */
const AUTO_CRM_GRACE_MS = 20 * 60 * 1000;

const ADMINS_ONLY = "Only admins can manage Inquiry Forms.";
const NOT_FOUND = "That form no longer exists. It may have been deleted.";
const SUBMISSION_NOT_FOUND = "That submission no longer exists.";
const CONFLICT =
  "Someone saved this form after you opened it. Reload the page to see their changes, then make yours again.";

async function realAdmin(): Promise<Admin | null> {
  try {
    const admin = await adapter.currentAdmin();
    return admin && typeof admin.id === "string" && admin.id ? admin : null;
  } catch {
    return null;
  }
}

function service(): Svc {
  return createServiceClient();
}

function dbMessage(error: DbError, what: string): string {
  if (isMissingTableError(error)) return `${NEEDS_MIGRATION_MESSAGE}.`;
  const detail = error?.message?.trim();
  return detail ? `Could not ${what}: ${detail}` : `Could not ${what}. Please try again.`;
}

function errorText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return typeof e === "string" && e ? e : "unknown error";
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function stringRecord(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(record(v))) if (typeof val === "string") out[k] = val;
  return out;
}

function stageOf(v: unknown): SubmissionStage {
  return v === "completed" || v === "waitlisted" || v === "abandoned" || v === "spam" ? v : "in_progress";
}

function scoreLabelOf(v: unknown): ScoreLabel | null {
  return v === "high" || v === "medium" || v === "low" ? v : null;
}

function brandKeys(): string[] {
  return adapter.brands.map((b) => b.key);
}

/**
 * The editor's concurrency token: inquiry_forms.draft_saved_at, which only a draft save moves
 * (updated_at also moves on publish and status changes, so it would turn the next save after a
 * publish into a false "someone else saved" conflict).
 */
function draftTokenOf(row: Record<string, unknown>): string {
  return str(row.draft_saved_at);
}

/** Form settings for the editor: defaults merged in, brand never empty. */
function editorSettings(raw: unknown, brand: string): FormSettings {
  const merged = mergeFormSettings(raw);
  const known = brandKeys();
  if (!merged.brand || !known.includes(merged.brand)) {
    merged.brand = known.includes(brand) ? brand : adapter.defaultBrand;
  }
  return merged;
}

/**
 * A stored definition as the editor should see it: normalized when valid, else the draft as it was
 * saved (with its problems) in a shape that never crashes a reader.
 */
function definitionOf(raw: unknown): FormDefinition {
  const v = validateDefinition(raw);
  if (v.ok) return v.def;
  return Array.isArray(record(raw).steps) ? coerceDefinition(raw) : emptyDefinition();
}

/**
 * Everything that keeps a stored draft from being published (publishForm refuses exactly these).
 * A draft save stores the draft anyway and returns this list.
 */
function publishProblemsOf(definition: unknown, settings: FormSettings): string[] {
  const def = validateDefinition(definition);
  const check = validateFormSettings(settings, { brandKeys: brandKeys() });
  return [...(def.ok ? [] : def.errors), ...(check.ok ? [] : check.issues.map((i) => i.message))];
}

function revalidateForm(id?: string, slug?: string | null) {
  revalidatePath(LIST_PATH);
  if (id) revalidatePath(`${LIST_PATH}/${id}`);
  if (slug) revalidatePath(`/inquire/${slug}`);
}

/** Pages through a PostgREST query 1000 rows at a time (max_rows = 1000 in this project). */
async function fetchAll(
  build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: DbError }>,
): Promise<{ rows: Record<string, unknown>[]; error: DbError }> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 100 * PAGE_ROWS; from += PAGE_ROWS) {
    const { data, error } = await build(from, from + PAGE_ROWS - 1);
    if (error) return { rows, error };
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE_ROWS) break;
  }
  return { rows, error: null };
}

function statsSince(): string {
  return addDays(todayInTz(), -(STATS_WINDOW_DAYS - 1));
}

async function statsByForm(svc: Svc, formIds: string[]): Promise<{ byForm: Map<string, FormStats>; error: DbError }> {
  const byForm = new Map<string, FormStats>();
  if (formIds.length === 0) return { byForm, error: null };
  const since = statsSince();
  const { rows, error } = await fetchAll((from, to) =>
    svc
      .from(TABLES.stats)
      .select("form_id, day, views, starts, completes")
      .in("form_id", formIds)
      .gte("day", since)
      .order("form_id", { ascending: true })
      .order("day", { ascending: true })
      .range(from, to),
  );
  if (error) return { byForm, error };
  for (const r of rows) {
    const id = str(r.form_id);
    byForm.set(id, addStats(byForm.get(id) ?? emptyStats(), r));
  }
  return { byForm, error: null };
}

const SUBMISSION_COLUMNS =
  "id, form_id, version_id, stage, current_step, total_steps, answers, contact_name, contact_email, contact_phone, event_date, event_location, guest_count, qualification, score, score_label, attribution, crm_ref, spam_reason, started_at, last_activity_at, completed_at, abandoned_at, abandon_notified_at, staff_notified_at, confirmation_sent_at, created_at, updated_at, crm_claimed_at";

/**
 * The definition a submission was filled against: its version, else the form's published
 * version, else the draft. Answers are always labeled with the questions the visitor saw.
 */
async function definitionForSubmission(
  svc: Svc,
  sub: SubmissionRow,
): Promise<
  | { ok: true; def: FormDefinition; settings: FormSettings; form: { id: string; name: string; slug: string } }
  | { ok: false; error: string }
> {
  const { data: form, error } = await svc
    .from(TABLES.forms)
    .select("id, name, slug, definition, published_version_id")
    .eq("id", sub.form_id)
    .maybeSingle();
  if (error) return { ok: false, error: dbMessage(error, "load the form") };
  if (!form) return { ok: false, error: NOT_FOUND };
  const versionId = sub.version_id ?? strOrNull(form.published_version_id);
  let raw: unknown = form.definition;
  let rawSettings: unknown = {};
  if (versionId) {
    const { data: version, error: vErr } = await svc
      .from(TABLES.versions)
      .select("definition, settings")
      .eq("id", versionId)
      .maybeSingle();
    if (vErr) return { ok: false, error: dbMessage(vErr, "load the form version") };
    if (version) {
      raw = version.definition;
      rawSettings = version.settings;
    }
  }
  return {
    ok: true,
    def: definitionOf(raw),
    // The version the visitor filled: its owner-by-event-type routing applies to staff writes too.
    settings: mergeFormSettings(rawSettings),
    form: { id: str(form.id), name: str(form.name), slug: str(form.slug) },
  };
}

async function writeLog(
  svc: Svc,
  entry: { submissionId: string; kind: string; channel: string; recipient: string | null; status: "sent" | "failed" | "skipped"; detail: Record<string, unknown> },
): Promise<void> {
  const { error } = await svc.from(TABLES.log).insert({
    submission_id: entry.submissionId,
    kind: entry.kind,
    channel: entry.channel,
    recipient: entry.recipient,
    status: entry.status,
    detail: entry.detail,
  });
  // The staff action itself already succeeded or failed on its own write; a lost log row must not
  // undo it, but it must be visible in the server logs.
  if (error) console.error(`[inquiry-forms] could not write the ${entry.kind} log row:`, error.message);
}

function turnstileAvailable(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}

function googleMapsAvailable(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

async function freeSlug(svc: Svc, base: string): Promise<{ slug: string } | { error: string }> {
  const { data, error } = await svc.from(TABLES.forms).select("slug").like("slug", `${base}%`).limit(1000);
  if (error) return { error: dbMessage(error, "check the form links") };
  return { slug: nextAvailableSlug(base, (data ?? []).map((r) => str(r.slug))) };
}

// Forms

const STATUS_ORDER: Record<FormStatus, number> = { live: 0, paused: 1, draft: 2, archived: 3 };

export async function listForms(): Promise<{ forms: FormListRow[]; error?: string; needsMigration?: boolean }> {
  const admin = await realAdmin();
  if (!admin) return { forms: [], error: ADMINS_ONLY };
  try {
    const svc = service();
    const { data, error } = await svc
      .from(TABLES.forms)
      .select("id, slug, name, brand, status, published_version_id, draft_saved_at");
    if (error) return { forms: [], error: dbMessage(error, "load the forms"), needsMigration: isMissingTableError(error) };
    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) return { forms: [] };

    const ids = rows.map((r) => str(r.id));
    const versionIds = rows.map((r) => strOrNull(r.published_version_id)).filter((v): v is string => Boolean(v));

    const [versionsRes, statsRes, lastRes] = await Promise.all([
      versionIds.length
        ? svc.from(TABLES.versions).select("id, version").in("id", versionIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
      statsByForm(svc, ids),
      Promise.all(
        ids.map((id) =>
          svc
            .from(TABLES.submissions)
            .select("completed_at")
            .eq("form_id", id)
            .in("stage", ["completed", "waitlisted"])
            .not("completed_at", "is", null)
            .order("completed_at", { ascending: false })
            .limit(1),
        ),
      ),
    ]);
    if (versionsRes.error) return { forms: [], error: dbMessage(versionsRes.error, "load the published versions") };
    if (statsRes.error) return { forms: [], error: dbMessage(statsRes.error, "load the form stats") };
    const lastErr = lastRes.find((r) => r.error)?.error;
    if (lastErr) return { forms: [], error: dbMessage(lastErr, "load the latest inquiries") };

    const versionById = new Map(
      ((versionsRes.data ?? []) as Record<string, unknown>[]).map((v) => [str(v.id), numOrNull(v.version)]),
    );
    const forms: FormListRow[] = rows.map((r, i) => {
      const status: FormStatus = isFormStatus(r.status) ? r.status : "draft";
      const versionId = strOrNull(r.published_version_id);
      const last = (lastRes[i]?.data ?? []) as Record<string, unknown>[];
      return {
        id: str(r.id),
        slug: str(r.slug),
        name: str(r.name),
        brand: str(r.brand),
        status,
        publishedVersion: versionId ? (versionById.get(versionId) ?? null) : null,
        updatedAt: draftTokenOf(r),
        stats30d: statsRes.byForm.get(str(r.id)) ?? emptyStats(),
        lastSubmissionAt: strOrNull(last[0]?.completed_at),
      };
    });
    forms.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name));
    return { forms };
  } catch (e) {
    return { forms: [], error: `Could not load the forms: ${errorText(e)}` };
  }
}

export async function createForm(input: { name: string; brand: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = await realAdmin();
  if (!admin) return { ok: false, error: ADMINS_ONLY };
  const name = checkFormName(input?.name);
  if (!name.ok) return { ok: false, error: name.error };
  const brand = adapter.brands.find((b) => b.key === input?.brand) ?? adapter.brands.find((b) => b.key === adapter.defaultBrand);
  if (!brand) return { ok: false, error: "Pick one of the brands." };
  try {
    const svc = service();
    const settings = mergeFormSettings({ brand: brand.key, accentColor: brand.accentColor });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const free = await freeSlug(svc, slugFromName(name.name));
      if ("error" in free) return { ok: false, error: free.error };
      const { data, error } = await svc
        .from(TABLES.forms)
        .insert({
          slug: free.slug,
          name: name.name,
          brand: brand.key,
          status: "draft",
          definition: emptyDefinition(),
          settings,
          created_by: admin.id,
        })
        .select("id")
        .single();
      if (error && isUniqueViolation(error)) continue;
      if (error || !data) return { ok: false, error: dbMessage(error, "create the form") };
      revalidateForm();
      return { ok: true, id: str(data.id) };
    }
    return { ok: false, error: "Could not find a free link for this form. Try a different name." };
  } catch (e) {
    return { ok: false, error: `Could not create the form: ${errorText(e)}` };
  }
}

type StarterPreset = { slug: string; name: string; brand: string; definition: unknown; settings: unknown };

function starterPresets(): StarterPreset[] {
  return STARTER_FORMS.map((p) => ({
    slug: p.slug,
    name: p.name,
    brand: p.brand || p.settings?.brand || "",
    definition: p.definition,
    settings: p.settings,
  }));
}

export async function addStarterForms(): Promise<{ ok: true; created: string[] } | { ok: false; error: string }> {
  const admin = await realAdmin();
  if (!admin) return { ok: false, error: ADMINS_ONLY };
  const presets = starterPresets();
  if (presets.length === 0) return { ok: false, error: "This hub has no starter forms set up." };

  // Check every preset before writing anything, so a bad preset never leaves half the set behind.
  const known = brandKeys();
  const prepared: { preset: StarterPreset; def: FormDefinition; settings: FormSettings }[] = [];
  for (const preset of presets) {
    if (!isValidSlug(preset.slug)) return { ok: false, error: `Starter form "${preset.name}" has an invalid link name.` };
    const v = validateDefinition(preset.definition);
    if (!v.ok) return { ok: false, error: `Starter form "${preset.name}" is not valid: ${v.errors[0]}` };
    const brand = known.includes(preset.brand) ? preset.brand : adapter.defaultBrand;
    const merged = mergeFormSettings({ ...record(preset.settings), brand });
    const sv = validateFormSettings(merged, { brandKeys: known });
    if (!sv.ok) return { ok: false, error: `Starter form "${preset.name}" settings are not valid: ${sv.issues[0]?.message}` };
    prepared.push({ preset: { ...preset, brand }, def: v.def, settings: mergeFormSettings(sv.value) });
  }

  try {
    const svc = service();
    const { data: existing, error: exErr } = await svc.from(TABLES.forms).select("slug");
    if (exErr) return { ok: false, error: dbMessage(exErr, "check the existing forms") };
    const taken = new Set(((existing ?? []) as Record<string, unknown>[]).map((r) => str(r.slug)));
    const created: string[] = [];

    for (const { preset, def, settings } of prepared) {
      if (taken.has(preset.slug)) continue;
      const { data: form, error: formErr } = await svc
        .from(TABLES.forms)
        .insert({
          slug: preset.slug,
          name: preset.name,
          brand: preset.brand,
          status: "draft",
          definition: def,
          settings,
          created_by: admin.id,
        })
        .select("id")
        .single();
      if (formErr || !form) {
        if (isUniqueViolation(formErr)) continue; // added by someone else a moment ago
        return partialFailure(created, dbMessage(formErr, `add "${preset.name}"`));
      }
      const formId = str(form.id);
      const { data: version, error: verErr } = await svc
        .from(TABLES.versions)
        .insert({ form_id: formId, version: 1, definition: def, settings, published_by: admin.id })
        .select("id")
        .single();
      if (verErr || !version) {
        await removeFormQuietly(svc, formId);
        return partialFailure(created, dbMessage(verErr, `publish "${preset.name}"`));
      }
      const { error: liveErr } = await svc
        .from(TABLES.forms)
        .update({ status: "live", published_version_id: str(version.id) })
        .eq("id", formId);
      if (liveErr) {
        await removeFormQuietly(svc, formId);
        return partialFailure(created, dbMessage(liveErr, `make "${preset.name}" live`));
      }
      created.push(preset.name);
      taken.add(preset.slug);
      revalidatePath(`/inquire/${preset.slug}`);
    }
    revalidateForm();
    return { ok: true, created };
  } catch (e) {
    return { ok: false, error: `Could not add the starter forms: ${errorText(e)}` };
  }
}

function partialFailure(created: string[], error: string): { ok: false; error: string } {
  if (created.length) revalidateForm();
  return {
    ok: false,
    error: created.length ? `${error} (${created.join(" and ")} ${created.length === 1 ? "was" : "were"} added.)` : error,
  };
}

async function removeFormQuietly(svc: Svc, formId: string): Promise<void> {
  const { error } = await svc.from(TABLES.forms).delete().eq("id", formId);
  if (error) console.error("[inquiry-forms] could not remove a half-created starter form:", formId, error.message);
}

export async function getFormForEdit(id: string): Promise<
  | {
      ok: true;
      form: {
        id: string;
        slug: string;
        name: string;
        brand: string;
        status: FormStatus;
        definition: FormDefinition;
        settings: FormSettings;
        /** Concurrency token for the next saveDraft (draft_saved_at). */
        updatedAt: string;
        publishedVersion: number | null;
        publishedAt: string | null;
        hasSubmissions: boolean;
        publishedKeys: string[];
        /** What keeps the SAVED draft from being published (empty = ready). */
        draftIssues: string[];
      };
      brands: BrandProfile[];
      publicOrigin: string;
    }
  | { ok: false; error: string }
> {
  const admin = await realAdmin();
  if (!admin) return { ok: false, error: ADMINS_ONLY };
  if (!isUuid(id)) return { ok: false, error: NOT_FOUND };
  try {
    const svc = service();
    const { data: row, error } = await svc
      .from(TABLES.forms)
      .select("id, slug, name, brand, status, definition, settings, draft_saved_at, published_version_id")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false, error: dbMessage(error, "load the form") };
    if (!row) return { ok: false, error: NOT_FOUND };

    const versionId = strOrNull(row.published_version_id);
    const [versionRes, countRes] = await Promise.all([
      versionId
        ? svc.from(TABLES.versions).select("version, published_at, definition").eq("id", versionId).maybeSingle()
        : Promise.resolve({ data: null as Record<string, unknown> | null, error: null }),
      svc.from(TABLES.submissions).select("id", { count: "exact", head: true }).eq("form_id", id),
    ]);
    if (versionRes.error) return { ok: false, error: dbMessage(versionRes.error, "load the published version") };
    if (countRes.error) return { ok: false, error: dbMessage(countRes.error, "count the submissions") };

    const version = versionRes.data as Record<string, unknown> | null;
    const publishedKeys = version
      ? Array.from(
          new Set(
            allFields(definitionOf(version.definition))
              .filter((f) => f.type !== "content")
              .map((f) => f.key),
          ),
        )
      : [];
    const brand = str(row.brand);
    const settings = editorSettings(row.settings, brand);
    return {
      ok: true,
      form: {
        id: str(row.id),
        slug: str(row.slug),
        name: str(row.name),
        brand,
        status: isFormStatus(row.status) ? row.status : "draft",
        definition: definitionOf(row.definition),
        settings,
        updatedAt: draftTokenOf(row),
        publishedVersion: version ? numOrNull(version.version) : null,
        publishedAt: version ? strOrNull(version.published_at) : null,
        hasSubmissions: (countRes.count ?? 0) > 0,
        publishedKeys,
        draftIssues: publishProblemsOf(row.definition, settings),
      },
      brands: adapter.brands,
      publicOrigin: adapter.publicOrigin(),
    };
  } catch (e) {
    return { ok: false, error: `Could not load the form: ${errorText(e)}` };
  }
}

/**
 * Draft settings to store: the validated settings when they pass, else the editor's settings
 * normalized as far as possible (deep-merged with the defaults, a known brand) with their problems.
 */
function draftSettingsOf(raw: unknown, currentBrand: string): { settings: FormSettings; issues: string[] } {
  const known = brandKeys();
  const check = validateFormSettings(raw as FormSettings, { brandKeys: known });
  if (check.ok) return { settings: mergeFormSettings(check.value), issues: [] };
  const settings = mergeFormSettings(raw);
  if (!known.includes(settings.brand)) settings.brand = known.includes(currentBrand) ? currentBrand : adapter.defaultBrand;
  return { settings, issues: check.issues.map((i) => i.message) };
}

/**
 * Saves the DRAFT and never loses work: a draft that does not pass validateDefinition or the
 * settings checks is stored anyway and `issues` lists what still blocks publishing (publishForm
 * keeps refusing it). Refused, with nothing stored: a missing or too long name, a link name the
 * database cannot hold (invalid, taken, or changed on a published form), a draft that cannot be
 * read (not an object with a list of steps) or that is over DRAFT_MAX_BYTES, and a conflict with
 * a save made since the editor loaded the form.
 */
export async function saveDraft(input: {
  id: string;
  name: string;
  slug: string;
  definition: FormDefinition;
  settings: FormSettings;
  expectedUpdatedAt: string;
}): Promise<
  | { ok: true; updatedAt: string; definition: FormDefinition; issues: string[] }
  | { ok: false; error: string; errors?: string[]; conflict?: boolean }
> {
  const admin = await realAdmin();
  if (!admin) return { ok: false, error: ADMINS_ONLY };
  if (!input || !isUuid(input.id)) return { ok: false, error: NOT_FOUND };

  const problems: string[] = [];
  const name = checkFormName(input.name);
  if (!name.ok) problems.push(name.error);
  const slug = typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
  if (!isValidSlug(slug)) {
    problems.push("Link name: use 3 to 60 lowercase letters, numbers and single dashes, like check-your-date.");
  }
  const draft = prepareDraftDefinition(input.definition);
  if (!draft.ok) problems.push(draft.error);
  if (problems.length || !name.ok || !draft.ok) {
    return {
      ok: false,
      error: problems.length === 1 ? problems[0] : `Fix these ${problems.length} things before saving.`,
      errors: problems,
    };
  }

  try {
    const svc = service();
    const { data: cur, error: curErr } = await svc
      .from(TABLES.forms)
      .select("slug, brand, draft_saved_at, published_version_id")
      .eq("id", input.id)
      .maybeSingle();
    if (curErr) return { ok: false, error: dbMessage(curErr, "save the draft") };
    if (!cur) return { ok: false, error: NOT_FOUND };
    const token = draftTokenOf(cur);
    if (!sameInstant(token, input.expectedUpdatedAt)) {
      return { ok: false, error: CONFLICT, conflict: true };
    }

    const oldSlug = str(cur.slug);
    if (slug !== oldSlug) {
      if (strOrNull(cur.published_version_id)) {
        const msg = `This form is published, so /inquire/${oldSlug} may already be on your website. Keep the link name, or duplicate the form to start a new link.`;
        return { ok: false, error: msg, errors: [msg] };
      }
      const { data: clash, error: clashErr } = await svc
        .from(TABLES.forms)
        .select("id")
        .eq("slug", slug)
        .neq("id", input.id)
        .limit(1);
      if (clashErr) return { ok: false, error: dbMessage(clashErr, "check the link name") };
      if ((clash ?? []).length > 0) {
        const msg = `Another form already uses /inquire/${slug}. Pick a different link name.`;
        return { ok: false, error: msg, errors: [msg] };
      }
    }

    const { settings, issues: settingsIssues } = draftSettingsOf(input.settings, str(cur.brand));
    const mark = new Date().toISOString();
    // Compare-and-set on the token just read: a save in between makes this match no row.
    // Publishing and status changes never touch draft_saved_at, so they never conflict.
    const { data: updated, error: updErr } = await svc
      .from(TABLES.forms)
      .update({
        name: name.name,
        slug,
        brand: settings.brand,
        definition: draft.definition,
        settings,
        draft_saved_at: mark,
      })
      .eq("id", input.id)
      .eq("draft_saved_at", token)
      .select("id");
    if (updErr) {
      if (isUniqueViolation(updErr)) {
        const msg = `Another form already uses /inquire/${slug}. Pick a different link name.`;
        return { ok: false, error: msg, errors: [msg] };
      }
      return { ok: false, error: dbMessage(updErr, "save the draft") };
    }
    if (!updated || updated.length === 0) return { ok: false, error: CONFLICT, conflict: true };
    revalidateForm(input.id, slug !== oldSlug ? oldSlug : null);
    return { ok: true, updatedAt: mark, definition: draft.definition, issues: [...draft.issues, ...settingsIssues] };
  } catch (e) {
    return { ok: false, error: `Could not save the draft: ${errorText(e)}` };
  }
}

export async function publishForm(id: string): Promise<{ ok: true; version: number } | { ok: false; error: string; errors?: string[] }> {
  const admin = await realAdmin();
  if (!admin) return { ok: false, error: ADMINS_ONLY };
  if (!isUuid(id)) return { ok: false, error: NOT_FOUND };
  try {
    const svc = service();
    const { data: row, error } = await svc
      .from(TABLES.forms)
      .select("id, slug, brand, status, definition, settings, published_version_id")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false, error: dbMessage(error, "load the form") };
    if (!row) return { ok: false, error: NOT_FOUND };
    const status: FormStatus = isFormStatus(row.status) ? row.status : "draft";
    if (status === "archived") {
      return { ok: false, error: "This form is archived. Restore it from the forms list before publishing." };
    }

    const def = validateDefinition(row.definition);
    const settingsCheck = validateFormSettings(editorSettings(row.settings, str(row.brand)), { brandKeys: brandKeys() });
    const problems = [
      ...(def.ok ? [] : def.errors),
      ...(settingsCheck.ok ? [] : settingsCheck.issues.map((i) => i.message)),
    ];
    if (!def.ok || !settingsCheck.ok) {
      return { ok: false, error: "Fix these things in the saved draft before publishing.", errors: problems };
    }
    const settings = mergeFormSettings(settingsCheck.value);

    const { data: last, error: lastErr } = await svc
      .from(TABLES.versions)
      .select("version")
      .eq("form_id", id)
      .order("version", { ascending: false })
      .limit(1);
    if (lastErr) return { ok: false, error: dbMessage(lastErr, "read the version history") };
    const nextVersion = (numOrNull((last ?? [])[0]?.version) ?? 0) + 1;

    const { data: inserted, error: insErr } = await svc
      .from(TABLES.versions)
      .insert({ form_id: id, version: nextVersion, definition: def.def, settings, published_by: admin.id })
      .select("id, version")
      .single();
    if (insErr || !inserted) {
      if (isUniqueViolation(insErr)) {
        return { ok: false, error: "Someone published this form at the same moment. Reload the page and try again." };
      }
      return { ok: false, error: dbMessage(insErr, "publish the form") };
    }

    const nextStatus: FormStatus = status === "draft" ? "live" : status;
    const { error: updErr } = await svc
      .from(TABLES.forms)
      .update({ published_version_id: str(inserted.id), status: nextStatus })
      .eq("id", id);
    if (updErr) {
      const { error: undoErr } = await svc.from(TABLES.versions).delete().eq("id", str(inserted.id));
      if (undoErr) console.error("[inquiry-forms] could not remove an unpublished version row:", inserted.id, undoErr.message);
      return { ok: false, error: dbMessage(updErr, "publish the form") };
    }
    revalidateForm(id, str(row.slug));
    return { ok: true, version: numOrNull(inserted.version) ?? nextVersion };
  } catch (e) {
    return { ok: false, error: `Could not publish the form: ${errorText(e)}` };
  }
}

export async function setFormStatus(id: string, status: "live" | "paused" | "archived"): Promise<{ ok: boolean; error?: string }> {
  const admin = await realAdmin();
  if (!admin) return { ok: false, error: ADMINS_ONLY };
  if (!isUuid(id)) return { ok: false, error: NOT_FOUND };
  if (status !== "live" && status !== "paused" && status !== "archived") return { ok: false, error: "Unknown status." };
  try {
    const svc = service();
    const { data: row, error } = await svc
      .from(TABLES.forms)
      .select("status, slug, published_version_id")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false, error: dbMessage(error, "load the form") };
    if (!row) return { ok: false, error: NOT_FOUND };
    const published = Boolean(strOrNull(row.published_version_id));
    if (status === "live" && !published) return { ok: false, error: "Publish this form before making it live." };
    // A never-published form cannot be "paused": restoring it from the archive makes it a draft again.
    const next: FormStatus = status === "paused" && !published ? "draft" : status;
    if (row.status === next) return { ok: true };
    const { error: updErr } = await svc.from(TABLES.forms).update({ status: next }).eq("id", id);
    if (updErr) return { ok: false, error: dbMessage(updErr, "change the form status") };
    revalidateForm(id, str(row.slug));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Could not change the form status: ${errorText(e)}` };
  }
}

export async function duplicateForm(id: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = await realAdmin();
  if (!admin) return { ok: false, error: ADMINS_ONLY };
  if (!isUuid(id)) return { ok: false, error: NOT_FOUND };
  try {
    const svc = service();
    const { data: src, error } = await svc
      .from(TABLES.forms)
      .select("name, brand, definition, settings")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false, error: dbMessage(error, "load the form") };
    if (!src) return { ok: false, error: NOT_FOUND };
    const { data: names, error: namesErr } = await svc.from(TABLES.forms).select("name");
    if (namesErr) return { ok: false, error: dbMessage(namesErr, "check the form names") };
    const name = copyName(str(src.name), ((names ?? []) as Record<string, unknown>[]).map((r) => str(r.name)));
    const brand = str(src.brand);
    const settings = editorSettings(src.settings, brand);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const free = await freeSlug(svc, slugFromName(name));
      if ("error" in free) return { ok: false, error: free.error };
      const { data, error: insErr } = await svc
        .from(TABLES.forms)
        .insert({
          slug: free.slug,
          name,
          brand: settings.brand || brand,
          status: "draft",
          definition: definitionOf(src.definition),
          settings,
          created_by: admin.id,
        })
        .select("id")
        .single();
      if (insErr && isUniqueViolation(insErr)) continue;
      if (insErr || !data) return { ok: false, error: dbMessage(insErr, "copy the form") };
      revalidateForm();
      return { ok: true, id: str(data.id) };
    }
    return { ok: false, error: "Could not find a free link for the copy. Please try again." };
  } catch (e) {
    return { ok: false, error: `Could not copy the form: ${errorText(e)}` };
  }
}

export async function deleteForm(id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await realAdmin();
  if (!admin) return { ok: false, error: ADMINS_ONLY };
  if (!isUuid(id)) return { ok: false, error: NOT_FOUND };
  try {
    const svc = service();
    const { data: row, error } = await svc.from(TABLES.forms).select("status, slug").eq("id", id).maybeSingle();
    if (error) return { ok: false, error: dbMessage(error, "load the form") };
    if (!row) return { ok: true };
    if (row.status === "live") {
      return { ok: false, error: "This form is live. Archive it first so no new inquiries arrive while it is deleted." };
    }
    const { count, error: countErr } = await svc
      .from(TABLES.submissions)
      .select("id", { count: "exact", head: true })
      .eq("form_id", id);
    if (countErr) return { ok: false, error: dbMessage(countErr, "count the submissions") };
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `This form has ${count} ${count === 1 ? "submission" : "submissions"}, so it cannot be deleted. Archive it instead: it stops taking inquiries and keeps the history.`,
      };
    }
    const { error: delErr } = await svc.from(TABLES.forms).delete().eq("id", id);
    if (delErr) return { ok: false, error: dbMessage(delErr, "delete the form") };
    revalidateForm(undefined, str(row.slug));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Could not delete the form: ${errorText(e)}` };
  }
}

// Submissions

function emptyFunnel(): SubmissionFunnel {
  return { views: 0, starts: 0, completes: 0, perStepReached: [], stepLabels: [], windowDays: STATS_WINDOW_DAYS };
}

export async function listSubmissions(input: {
  formId: string;
  stage?: SubmissionStage | "all";
  page?: number;
}): Promise<SubmissionListResult> {
  const blank: SubmissionListResult = { rows: [], total: 0, funnel: emptyFunnel(), page: 1, pageSize: PAGE_SIZE };
  const admin = await realAdmin();
  if (!admin) return { ...blank, error: ADMINS_ONLY };
  if (!input || !isUuid(input.formId)) return { ...blank, error: NOT_FOUND };
  const stage: StageFilter = isStageFilter(input.stage) ? input.stage : "all";
  let page = Number.isInteger(input.page) && (input.page as number) >= 1 ? (input.page as number) : 1;

  try {
    const svc = service();
    const { data: form, error: formErr } = await svc
      .from(TABLES.forms)
      .select("id, definition, published_version_id")
      .eq("id", input.formId)
      .maybeSingle();
    if (formErr) return { ...blank, error: dbMessage(formErr, "load the form"), needsMigration: isMissingTableError(formErr) };
    if (!form) return { ...blank, error: NOT_FOUND };

    let stepSource: unknown = form.definition;
    const versionId = strOrNull(form.published_version_id);
    if (versionId) {
      const { data: v, error: vErr } = await svc.from(TABLES.versions).select("definition").eq("id", versionId).maybeSingle();
      if (vErr) return { ...blank, error: dbMessage(vErr, "load the published version") };
      if (v) stepSource = v.definition;
    }
    const steps = definitionOf(stepSource).steps;

    const pageQuery = (p: number) => {
      let q = svc
        .from(TABLES.submissions)
        .select(
          "id, created_at, stage, contact_name, contact_email, contact_phone, event_date, score, score_label, qualification, attribution, crm_ref",
          { count: "exact" },
        )
        .eq("form_id", input.formId);
      if (stage !== "all") q = q.eq("stage", stage);
      const from = (p - 1) * PAGE_SIZE;
      return q.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    };

    let res = await pageQuery(page);
    if (res.error && String(res.error.code) === "PGRST103" && page > 1) {
      // Asked past the last page (rows were deleted or re-filtered): show the last page instead.
      let headQ = svc.from(TABLES.submissions).select("id", { count: "exact", head: true }).eq("form_id", input.formId);
      if (stage !== "all") headQ = headQ.eq("stage", stage);
      const head = await headQ;
      if (head.error) return { ...blank, error: dbMessage(head.error, "count the submissions") };
      page = Math.max(1, Math.ceil((head.count ?? 0) / PAGE_SIZE));
      res = await pageQuery(page);
    }
    if (res.error) return { ...blank, error: dbMessage(res.error, "load the submissions") };

    const rows: SubmissionListRow[] = ((res.data ?? []) as Record<string, unknown>[]).map((r) => {
      const q = record(r.qualification) as Qualification;
      const crm = stringRecord(r.crm_ref);
      return {
        id: str(r.id),
        createdAt: str(r.created_at),
        stage: stageOf(r.stage),
        name: strOrNull(r.contact_name),
        email: strOrNull(r.contact_email),
        phone: strOrNull(r.contact_phone),
        eventDate: strOrNull(r.event_date),
        score: numOrNull(r.score),
        scoreLabel: scoreLabelOf(r.score_label),
        dateResult: (q.date?.result as DateResult | undefined) ?? null,
        locationResult: (q.location?.result as LocationResult | undefined) ?? null,
        source: sourceSummary(record(r.attribution) as Attribution),
        crmHref: crmRefDone(crm) ? adapter.staffRecordHref(crm) : null,
      };
    });

    // Funnel: daily counters for views / starts / completes, live counts for the per-step reach.
    const [statsRes, reachRes] = await Promise.all([
      statsByForm(svc, [input.formId]),
      Promise.all(
        steps.map((_, i) =>
          svc
            .from(TABLES.submissions)
            .select("id", { count: "exact", head: true })
            .eq("form_id", input.formId)
            .neq("stage", "spam")
            .gte("created_at", easternMidnightIso(statsSince()))
            .or(`current_step.gte.${i},stage.in.(completed,waitlisted)`),
        ),
      ),
    ]);
    if (statsRes.error) return { ...blank, error: dbMessage(statsRes.error, "load the form stats") };
    const reachErr = reachRes.find((r) => r.error)?.error;
    if (reachErr) return { ...blank, error: dbMessage(reachErr, "count how far people got") };
    const stats = statsRes.byForm.get(input.formId) ?? emptyStats();

    return {
      rows,
      total: res.count ?? rows.length,
      page,
      pageSize: PAGE_SIZE,
      funnel: {
        ...stats,
        perStepReached: reachRes.map((r) => r.count ?? 0),
        stepLabels: steps.map((s) => s.progressLabel?.trim() || s.title),
        windowDays: STATS_WINDOW_DAYS,
      },
    };
  } catch (e) {
    return { ...blank, error: `Could not load the submissions: ${errorText(e)}` };
  }
}

async function loadSubmission(
  svc: Svc,
  id: string,
): Promise<{ ok: true; row: SubmissionRow; crmClaimedAt: string | null } | { ok: false; error: string }> {
  const { data, error } = await svc.from(TABLES.submissions).select(SUBMISSION_COLUMNS).eq("id", id).maybeSingle();
  if (error) return { ok: false, error: dbMessage(error, "load the submission") };
  if (!data) return { ok: false, error: SUBMISSION_NOT_FOUND };
  const raw = data as Record<string, unknown>;
  return { ok: true, row: publicRow(toSubmissionRecord(raw)), crmClaimedAt: strOrNull(raw.crm_claimed_at) };
}

function hasContactInfo(row: SubmissionRow): boolean {
  return Boolean(row.contact_email || row.contact_phone);
}

/** The automatic Leads write (completion + sweep re-drives) gets this long before staff may add it by hand. */
function autoCrmStillTrying(row: SubmissionRow, now: number): boolean {
  if (row.stage !== "completed" && row.stage !== "waitlisted") return false;
  const done = Date.parse(row.completed_at ?? "");
  return Number.isFinite(done) && now - done < AUTO_CRM_GRACE_MS;
}

export async function getSubmissionDetail(id: string): Promise<{ ok: true; detail: SubmissionDetail } | { ok: false; error: string }> {
  const admin = await realAdmin();
  if (!admin) return { ok: false, error: ADMINS_ONLY };
  if (!isUuid(id)) return { ok: false, error: SUBMISSION_NOT_FOUND };
  try {
    const svc = service();
    const loaded = await loadSubmission(svc, id);
    if (!loaded.ok) return loaded;
    const row = loaded.row;
    const [defRes, logRes] = await Promise.all([
      definitionForSubmission(svc, row),
      svc
        .from(TABLES.log)
        .select("created_at, kind, status, channel, recipient")
        .eq("submission_id", id)
        .order("created_at", { ascending: true })
        .limit(200),
    ]);
    if (!defRes.ok) return defRes;
    if (logRes.error) return { ok: false, error: dbMessage(logRes.error, "load the activity log") };

    const log: SubmissionLogEntry[] = ((logRes.data ?? []) as Record<string, unknown>[]).map((l) => ({
      at: str(l.created_at),
      kind: str(l.kind),
      status: str(l.status),
      channel: strOrNull(l.channel),
      recipient: strOrNull(l.recipient),
    }));
    const done = crmRefDone(row.crm_ref);
    const now = new Date();
    const crmBusy = crmWriteInFlight({ crmRef: row.crm_ref, claimedAt: loaded.crmClaimedAt }, now);
    return {
      ok: true,
      detail: {
        id: row.id,
        formId: row.form_id,
        stage: row.stage,
        lines: formatAnswerLines(defRes.def, row.answers),
        qualification: row.qualification,
        score: row.score,
        scoreLabel: row.score_label,
        attribution: row.attribution,
        crmHref: done ? adapter.staffRecordHref(row.crm_ref) : null,
        crmBusy,
        log,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        formName: defRes.form.name,
        createdAt: row.created_at,
        lastActivityAt: strOrNull(row.last_activity_at),
        abandonedAt: row.abandoned_at,
        contact: { name: row.contact_name, email: row.contact_email, phone: row.contact_phone },
        eventDate: row.event_date,
        currentStep: row.current_step,
        totalSteps: row.total_steps,
        spamReason: row.spam_reason,
        canAddToCrm:
          !done && !crmBusy && row.stage !== "spam" && hasContactInfo(row) && !autoCrmStillTrying(row, now.getTime()),
      },
    };
  } catch (e) {
    return { ok: false, error: `Could not load the submission: ${errorText(e)}` };
  }
}

/**
 * Staff "Add to CRM" (CRM_WORDS.add). Goes through the same claimed write as completion and the sweep, so a
 * click racing them (or a second click) never makes a second card: `already` is true when the
 * card existed (or was linked just now from an earlier write) and nothing new was created.
 */
export async function addSubmissionToCrm(
  id: string,
): Promise<{ ok: true; crmHref: string | null; already: boolean } | { ok: false; error: string; busy?: boolean }> {
  const admin = await realAdmin();
  if (!admin) return { ok: false, error: ADMINS_ONLY };
  if (!isUuid(id)) return { ok: false, error: SUBMISSION_NOT_FOUND };
  try {
    const svc = service();
    const loaded = await loadSubmission(svc, id);
    if (!loaded.ok) return loaded;
    const row = loaded.row;
    if (crmRefDone(row.crm_ref)) return { ok: true, crmHref: adapter.staffRecordHref(row.crm_ref), already: true };
    if (row.stage === "spam") return { ok: false, error: "This submission is marked as spam. Choose Not spam first if it is a real person." };
    if (!hasContactInfo(row)) return { ok: false, error: "There is no email or phone yet, so there is nobody to follow up with." };
    if (autoCrmStillTrying(row, Date.now())) {
      return { ok: false, error: CRM_WORDS.stillCreating };
    }

    const defRes = await definitionForSubmission(svc, row);
    if (!defRes.ok) return defRes;
    const result = await writeCrmRecord(svc, {
      writer: "staff",
      submission: row,
      form: defRes.form,
      definition: defRes.def,
      actor: admin,
      ownerEmail: ownerFor(defRes.settings, defRes.def, row.answers),
    });
    switch (result.outcome) {
      case "created":
        revalidateForm(row.form_id);
        revalidatePath(CRM_WORDS.pagePath);
        return { ok: true, crmHref: adapter.staffRecordHref(result.ref), already: false };
      case "done":
      case "relinked":
        revalidateForm(row.form_id);
        return { ok: true, crmHref: adapter.staffRecordHref(result.ref), already: true };
      case "busy":
        return { ok: false, busy: true, error: CRM_WORDS.busy };
      case "failed":
        return { ok: false, error: `${CRM_WORDS.failed}: ${result.error}` };
      default:
        return { ok: false, error: `${CRM_WORDS.failed}. Please try again.` };
    }
  } catch (e) {
    return { ok: false, error: `${CRM_WORDS.failed}: ${errorText(e)}` };
  }
}

export async function setSubmissionSpam(id: string, spam: boolean): Promise<{ ok: boolean; error?: string }> {
  const admin = await realAdmin();
  if (!admin) return { ok: false, error: ADMINS_ONLY };
  if (!isUuid(id)) return { ok: false, error: SUBMISSION_NOT_FOUND };
  try {
    const svc = service();
    const { data: row, error } = await svc
      .from(TABLES.submissions)
      .select("id, form_id, stage, completed_at, abandoned_at")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false, error: dbMessage(error, "load the submission") };
    if (!row) return { ok: false, error: SUBMISSION_NOT_FOUND };
    const current = stageOf(row.stage);

    if (spam) {
      if (current === "spam") return { ok: true };
      const { data: changed, error: updErr } = await svc
        .from(TABLES.submissions)
        .update({ stage: "spam", spam_reason: `Marked as spam by ${admin.name}` })
        .eq("id", id)
        .eq("stage", current)
        .select("id");
      if (updErr) return { ok: false, error: dbMessage(updErr, "mark the submission as spam") };
      if (!changed || changed.length === 0) return { ok: false, error: "This submission just changed. Reload it and try again." };
      await writeLog(svc, {
        submissionId: id,
        kind: STAFF_LOG_KINDS.markedSpam,
        channel: "staff",
        recipient: admin.name,
        status: "sent",
        detail: { by: admin.id, previous_stage: current },
      });
    } else {
      if (current !== "spam") return { ok: true };
      // Back to the stage it had before staff marked it, else the stage its timestamps imply.
      const { data: marks, error: logErr } = await svc
        .from(TABLES.log)
        .select("detail")
        .eq("submission_id", id)
        .eq("kind", STAFF_LOG_KINDS.markedSpam)
        .order("created_at", { ascending: false })
        .limit(1);
      if (logErr) return { ok: false, error: dbMessage(logErr, "read the spam history") };
      const previous = stageOf(record(((marks ?? []) as Record<string, unknown>[])[0]?.detail).previous_stage);
      const restored: SubmissionStage =
        previous !== "in_progress" && previous !== "spam"
          ? previous
          : strOrNull(row.completed_at)
            ? "completed"
            : strOrNull(row.abandoned_at)
              ? "abandoned"
              : "in_progress";
      const { data: changed, error: updErr } = await svc
        .from(TABLES.submissions)
        .update({ stage: restored, spam_reason: null })
        .eq("id", id)
        .eq("stage", "spam")
        .select("id");
      if (updErr) return { ok: false, error: dbMessage(updErr, "mark the submission as not spam") };
      if (!changed || changed.length === 0) return { ok: false, error: "This submission just changed. Reload it and try again." };
      await writeLog(svc, {
        submissionId: id,
        kind: STAFF_LOG_KINDS.markedNotSpam,
        channel: "staff",
        recipient: admin.name,
        status: "sent",
        detail: { by: admin.id, restored_stage: restored },
      });
    }
    revalidateForm(str(row.form_id));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Could not change the spam flag: ${errorText(e)}` };
  }
}

// Business settings and the test tools

export async function getBusinessSettings(): Promise<{
  settings: BusinessSettings;
  turnstileAvailable: boolean;
  googleMapsAvailable: boolean;
  error?: string;
  needsMigration?: boolean;
}> {
  const extras = { turnstileAvailable: turnstileAvailable(), googleMapsAvailable: googleMapsAvailable() };
  const admin = await realAdmin();
  if (!admin) return { settings: mergeBusinessSettings({}), ...extras, error: ADMINS_ONLY };
  try {
    const settings = await readBusinessSettings(service());
    return { settings, ...extras };
  } catch (e) {
    // InquiryDbError carries the PostgREST message, which names a missing table.
    const missing = isMissingTableError({ message: errorText(e) });
    return {
      settings: mergeBusinessSettings({}),
      ...extras,
      error: missing ? `${NEEDS_MIGRATION_MESSAGE}.` : `Could not load the business settings: ${errorText(e)}`,
      needsMigration: missing,
    };
  }
}

export async function saveBusinessSettings(
  settings: BusinessSettings,
): Promise<{ ok: true } | { ok: false; error: string; errors?: string[]; issues?: SettingsIssue[] }> {
  const admin = await realAdmin();
  if (!admin) return { ok: false, error: ADMINS_ONLY };
  const check = validateBusinessSettings(settings, { departments: DEPARTMENTS, turnstileAvailable: turnstileAvailable() });
  if (!check.ok) {
    return {
      ok: false,
      error: check.issues.length === 1 ? check.issues[0].message : `Fix these ${check.issues.length} things before saving.`,
      errors: check.issues.map((i) => i.message),
      issues: check.issues,
    };
  }
  try {
    await storeBusinessSettings(service(), check.value, admin.id);
    revalidatePath(SETTINGS_PATH);
    revalidatePath(LIST_PATH);
    return { ok: true };
  } catch (e) {
    const missing = isMissingTableError({ message: errorText(e) });
    return {
      ok: false,
      error: missing ? `${NEEDS_MIGRATION_MESSAGE}.` : `Could not save the business settings: ${errorText(e)}`,
    };
  }
}

export async function geocodeAddress(
  address: string,
): Promise<{ ok: true; lat: number; lng: number; display: string; confidence: string } | { ok: false; error: string }> {
  const admin = await realAdmin();
  if (!admin) return { ok: false, error: ADMINS_ONLY };
  const query = typeof address === "string" ? address.replace(/\s+/g, " ").trim() : "";
  if (query.length < 3) return { ok: false, error: "Type the full address first." };
  if (query.length > 300) return { ok: false, error: "That address is too long. Use street, city, state and ZIP." };
  try {
    const svc = service();
    const hit = await geocode(svc, query, adapter.publicOrigin(), { skipCache: true });
    if (!hit) {
      return { ok: false, error: "That address was not found on the map. Check the spelling, or type the latitude and longitude." };
    }
    return { ok: true, lat: hit.lat, lng: hit.lng, display: hit.display || query, confidence: hit.confidence };
  } catch (e) {
    return { ok: false, error: `The map lookup did not answer: ${errorText(e)}. Try again in a minute.` };
  }
}

export async function testDate(
  date: string,
): Promise<{ ok: true; verdict: DateVerdict; problem?: string } | { ok: false; error: string }> {
  const admin = await realAdmin();
  if (!admin) return { ok: false, error: ADMINS_ONLY };
  if (typeof date !== "string" || !isValidDateString(date)) return { ok: false, error: "Pick a real date." };
  try {
    const svc = service();
    const business = await readBusinessSettings(svc);
    // Alternatives on, so staff also see which nearby dates a form that offers them would suggest.
    const check = await checkDate(svc, adapter, business, date, { today: todayInTz(), wantAlternatives: true });
    return check.error
      ? { ok: true, verdict: check.verdict, problem: `The check hit a problem (${check.error}), so visitors get the "we will confirm" message.` }
      : { ok: true, verdict: check.verdict };
  } catch (e) {
    return { ok: false, error: `The date check did not finish: ${errorText(e)}` };
  }
}

export async function testAddress(
  text: string,
): Promise<{ ok: true; verdict: LocationVerdict; problem?: string } | { ok: false; error: string }> {
  const admin = await realAdmin();
  if (!admin) return { ok: false, error: ADMINS_ONLY };
  const query = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  if (!query) return { ok: false, error: "Type a venue, city or address." };
  if (query.length > 300) return { ok: false, error: "That is too long. Use the venue name and city." };
  try {
    const svc = service();
    const business = await readBusinessSettings(svc);
    const place = cleanLocationText(query);
    const check = await checkLocation(svc, business, { text: place, fromOption: false }, {
      formHasField: true,
      origin: adapter.publicOrigin(),
    });
    if (check.error) {
      return { ok: true, verdict: check.verdict, problem: `The check hit a problem (${check.error}), so visitors get the "address not found" message.` };
    }
    if (check.verdict.result === "unverified" && check.verdict.miles == null && isUnplaceableAddress(place)) {
      return {
        ok: true,
        verdict: check.verdict,
        problem: "That is too vague to place on the map (for example \"TBD\" or \"my house\"), so it is never looked up.",
      };
    }
    return { ok: true, verdict: check.verdict };
  } catch (e) {
    return { ok: false, error: `The travel check did not finish: ${errorText(e)}` };
  }
}
