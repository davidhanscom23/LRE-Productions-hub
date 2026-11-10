import "server-only";

/**
 * Inquiry Forms - the LRE hub adapter (spec section 6). Everything hub-specific the shared module
 * needs: the CRM write (HoneyBook board client + Inquiry project + stage history row), committed
 * work and staff capacity for the availability check, staff alerts, email, the real-admin check,
 * the page-gate role and the public origin.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentProfile, getRealProfile } from "@/lib/auth/profile";
import { getPublicBaseUrl } from "@/lib/av-portals/emails";
import { sendEmailDetailed } from "@/lib/email/send";
import { insertNotifications } from "@/lib/notifications/notify";
import type { BrandProfile, BusinessSettings, CrmSummary, SubmissionRow } from "../types";
import {
  buildClientInsert,
  buildProjectDetails,
  buildProjectInsert,
  buildStageEventInsert,
  capacityFromPeople,
  countCommittedOn,
  escapeIlike,
  normalizeEmail,
  UNIQUE_VIOLATION,
  WEB_FORM_SOURCE,
  clientBlankFills,
  type ExistingClient,
  type ProjectDayRow,
} from "./crm-map";
import { qualificationSummaryLine } from "./lifecycle-core";
import { BRANDS, DEFAULT_BRAND_KEY } from "./presets";

export interface HubAdapter {
  hubKey: "y-ent" | "vident";
  brands: BrandProfile[];
  defaultBrand: string;
  /** Canonical absolute origin, no trailing slash. */
  publicOrigin(): string;
  /** Creates the CRM records for a submission; returns crm_ref. */
  recordInquiry(
    sb: SupabaseClient,
    input: {
      submission: SubmissionRow;
      form: { id: string; name: string; slug: string };
      summary: CrmSummary;
      lines: string[];
      /** Owner routed by event type: set as the record's owner when that email has an active hub login. */
      ownerEmail?: string | null;
    },
  ): Promise<Record<string, string>>;
  /** Hub-relative link to the CRM record, or null. */
  staffRecordHref(crmRef: Record<string, string>): string | null;
  /** Committed work on that New York date. */
  bookingsOn(sb: SupabaseClient, date: string): Promise<number>;
  capacityOn(
    sb: SupabaseClient,
    date: string,
    cap: BusinessSettings["availability"]["capacity"],
  ): Promise<number | null>;
  notifyStaff(
    sb: SupabaseClient,
    n: { kind: "web_inquiry" | "web_inquiry_unfinished"; title: string; body: string; href: string },
  ): Promise<void>;
  sendEmail(m: {
    to: string[];
    subject: string;
    text: string;
    html?: string;
    replyTo?: string | null;
  }): Promise<{ ok: boolean; skipped?: boolean; error?: string }>;
  /** The signed-in REAL admin (an admin in Staff view still counts), else null. */
  currentAdmin(): Promise<{ id: string; name: string } | null>;
  /**
   * The signed-in person's role for PAGE gates, else null when signed out. It follows the hub's
   * "view as staff" preview (an admin previewing as staff reads as "staff"), so the admin pages
   * hide exactly as they do for staff; every action still checks currentAdmin().
   */
  viewerRole(): Promise<string | null>;
}

/** Thrown by recordInquiry when part of the CRM write already happened (`partialRef` to keep). */
export class CrmWriteError extends Error {
  readonly partialRef: Record<string, string>;
  constructor(message: string, partialRef: Record<string, string> = {}) {
    super(message);
    this.name = "CrmWriteError";
    this.partialRef = partialRef;
  }
}

const CLIENT_COLUMNS = "id, full_name, phone, source_event";

function toExistingClient(row: unknown): ExistingClient {
  const r = row as { id: unknown; full_name?: unknown; phone?: unknown; source_event?: unknown };
  return {
    id: String(r.id),
    full_name: typeof r.full_name === "string" ? r.full_name : null,
    phone: typeof r.phone === "string" ? r.phone : null,
    source_event: typeof r.source_event === "string" ? r.source_event : null,
  };
}

/**
 * The client with exactly this (lowercased) email. Every hub writer stores emails lowercased, so
 * `eq` is the match; `anyCase` adds an escaped ILIKE for an older row that kept capitals (the
 * unique index is on lower(email), so such a row is the one an insert collides with).
 */
async function findClientByEmail(sb: SupabaseClient, email: string, anyCase: boolean): Promise<ExistingClient | null> {
  const exact = await sb.from("honeybook_clients").select(CLIENT_COLUMNS).eq("email", email).limit(1).maybeSingle();
  if (exact.error) throw new CrmWriteError(`client lookup: ${exact.error.message}`);
  if (exact.data) return toExistingClient(exact.data);
  // PostgREST reads "*" in an ilike value as a wildcard (no escape exists): exact match only then.
  if (!anyCase || email.includes("*")) return null;
  const loose = await sb
    .from("honeybook_clients")
    .select(CLIENT_COLUMNS)
    .ilike("email", escapeIlike(email))
    .limit(1)
    .maybeSingle();
  if (loose.error) throw new CrmWriteError(`client lookup: ${loose.error.message}`);
  return loose.data ? toExistingClient(loose.data) : null;
}

/**
 * Fill blanks only: a blank name or phone on the existing client gets the visitor's. Guarded on the
 * values just read, so a value someone saved a moment ago is never replaced. Best effort: the client
 * row is already usable, so a failure here is logged and the project is still created.
 */
async function fillClientBlanks(sb: SupabaseClient, client: ExistingClient, summary: CrmSummary): Promise<void> {
  const fills = clientBlankFills(client, summary);
  if (!fills) return;
  let update = sb
    .from("honeybook_clients")
    .update({ ...fills, updated_at: new Date().toISOString() })
    .eq("id", client.id);
  if (fills.full_name !== undefined) update = update.eq("full_name", client.full_name ?? "");
  if (fills.phone !== undefined) update = update.eq("phone", client.phone ?? "");
  const { error } = await update;
  if (error) console.error("[inquiry-forms] client blank fill failed", client.id, error.message);
}

/** Active, non-guest people per department set. Changes rarely; cached for a minute per instance. */
const peopleCache = new Map<string, { at: number; ids: string[] }>();
const PEOPLE_CACHE_MS = 60_000;

async function staffIds(sb: SupabaseClient, departments: string[]): Promise<string[]> {
  const key = [...departments].sort().join("|");
  const hit = peopleCache.get(key);
  if (hit && Date.now() - hit.at < PEOPLE_CACHE_MS) return hit.ids;
  const { data, error } = await sb
    .from("profiles")
    .select("id")
    .eq("is_active", true)
    .neq("role", "guest")
    .overlaps("departments", departments);
  if (error) throw new Error(`staff lookup: ${error.message}`);
  const ids = (data ?? []).map((p) => String((p as { id: unknown }).id));
  peopleCache.set(key, { at: Date.now(), ids });
  return ids;
}

/**
 * The active, non-guest hub person with this email, else null. Never throws: routing is a
 * convenience, so a failed lookup leaves the project unassigned instead of failing the CRM write.
 */
async function ownerProfileId(sb: SupabaseClient, email: string | null | undefined): Promise<string | null> {
  const e = normalizeEmail(email ?? null);
  if (!e || e.includes("*")) return null;
  try {
    const { data, error } = await sb
      .from("profiles")
      .select("id")
      .ilike("email", escapeIlike(e))
      .eq("is_active", true)
      .neq("role", "guest")
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[inquiry-forms] owner lookup failed", error.message);
      return null;
    }
    return data ? String((data as { id: unknown }).id) : null;
  } catch (err) {
    console.error("[inquiry-forms] owner lookup failed", err instanceof Error ? err.message : String(err));
    return null;
  }
}

export const hubAdapter: HubAdapter = {
  hubKey: "vident",
  brands: BRANDS,
  defaultBrand: DEFAULT_BRAND_KEY,

  publicOrigin() {
    // NEXT_PUBLIC_SITE_URL or https://hub.lreproductions.com (the helper the AV portal emails use).
    return getPublicBaseUrl().replace(/\/+$/, "");
  },

  async recordInquiry(sb, { submission, form, summary, lines, ownerEmail }) {
    const existing = submission.crm_ref ?? {};
    // A project already exists for this inquiry: never make a second one.
    if (existing.project_id) {
      const ref: Record<string, string> = { project_id: existing.project_id };
      if (existing.client_id) ref.client_id = existing.client_id;
      return ref;
    }

    // 1. Client: reuse a half-finished write, else the exact lowercased email, else insert.
    let clientId: string | null = existing.client_id || null;
    const email = normalizeEmail(summary.email);
    if (!clientId && email) {
      const found = await findClientByEmail(sb, email, false);
      if (found) {
        clientId = found.id;
        await fillClientBlanks(sb, found, summary);
      }
    }
    if (!clientId) {
      const { data, error } = await sb
        .from("honeybook_clients")
        .insert({ ...buildClientInsert(summary, submission.id), updated_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error && error.code === UNIQUE_VIOLATION && email) {
        // The same email was saved between the lookup and the insert (or an older row differs only
        // in case): use that client.
        const again = await findClientByEmail(sb, email, true);
        if (!again) throw new CrmWriteError(`client insert: ${error.message}`);
        clientId = again.id;
        await fillClientBlanks(sb, again, summary);
      } else if (error || !data) {
        throw new CrmWriteError(`client insert: ${error?.message ?? "no row returned"}`);
      } else {
        clientId = String((data as { id: unknown }).id);
      }
    }

    // 2. The board project at stage Inquiry (source_event web_form shows a Website badge).
    const details = buildProjectDetails({
      formName: form.name,
      ending: summary.ending,
      summaryLine: qualificationSummaryLine({
        qualification: submission.qualification ?? {},
        score: submission.score,
        scoreLabel: submission.score_label,
        budgetLabel: summary.budgetLabel,
      }),
      lines,
    });
    // A writer that died after the insert (sweep or after() past its time limit) left the project
    // without a logged ref: find it by the submission id it carries before inserting a second one.
    const { data: prior, error: priorError } = await sb
      .from("honeybook_projects")
      .select("id, client_id")
      .eq("source_event", WEB_FORM_SOURCE)
      .eq("raw->>submission_id", submission.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (priorError) throw new CrmWriteError(`project lookup: ${priorError.message}`, { client_id: clientId });
    if (prior) {
      const p = prior as { id: unknown; client_id: unknown };
      const ref: Record<string, string> = { project_id: String(p.id) };
      const owner = typeof p.client_id === "string" && p.client_id ? p.client_id : clientId;
      if (owner) ref.client_id = owner;
      return ref;
    }

    const project = buildProjectInsert({ summary, clientId, details, formSlug: form.slug, submissionId: submission.id });
    const { data: created, error: projectError } = await sb
      .from("honeybook_projects")
      .insert({ ...project, updated_at: new Date().toISOString() })
      .select("id")
      .single();
    if (projectError || !created) {
      throw new CrmWriteError(`project insert: ${projectError?.message ?? "no row returned"}`, { client_id: clientId });
    }
    const projectId = String((created as { id: unknown }).id);

    // 3. Stage history row, the same shape as the Hub "New project" button writes. History only
    // (the board reads the project's own stage), so a failure is logged and the write still counts.
    const { error: stageError } = await sb.from("honeybook_project_stage_events").insert(buildStageEventInsert(projectId));
    if (stageError) console.error("[inquiry-forms] stage history row failed", projectId, stageError.message);

    // 4. Routed owner (form settings ownerByEventType) becomes the project lead, the same row the
    // board's assignee picker writes. Only for an active hub login; a failure leaves it unassigned.
    const ownerId = await ownerProfileId(sb, ownerEmail);
    if (ownerId) {
      const { error: leadError } = await sb
        .from("honeybook_project_assignees")
        .insert({ project_id: projectId, profile_id: ownerId, role: "lead", assigned_by: null });
      if (leadError) console.error("[inquiry-forms] project lead row failed", projectId, leadError.message);
    }

    return { client_id: clientId, project_id: projectId };
  },

  staffRecordHref(crmRef) {
    return crmRef.project_id && crmRef.partial !== "true"
      ? `/honeybook/projects/${encodeURIComponent(crmRef.project_id)}`
      : null;
  },

  async bookingsOn(sb, date) {
    // project_date is a wall-calendar date (the CRM and Calendar treat it as the New York day).
    const { data, error } = await sb
      .from("honeybook_projects")
      .select("id, stage, booked_at, project_date")
      .eq("project_date", date)
      .limit(1000);
    if (error) throw new Error(`projects by date: ${error.message}`);
    return countCommittedOn((data ?? []) as ProjectDayRow[], date);
  },

  async capacityOn(sb, date, cap) {
    // The hub ships with the date check in "open" mode and source "none" (no capacity number exists,
    // and a DMC runs several events a day), so this answers null. The other two choices on the
    // settings page work too, so neither is a dead option if an admin switches to "Check our bookings".
    if (cap.source === "none") return null;
    if (cap.source === "fixed") {
      return typeof cap.fixed === "number" && Number.isFinite(cap.fixed) && cap.fixed > 0 ? Math.floor(cap.fixed) : null;
    }
    const departments = (cap.departments ?? []).map((d) => d.trim()).filter(Boolean);
    if (departments.length === 0) return null;
    const ids = await staffIds(sb, departments);
    if (ids.length === 0) return null;
    const { data, error } = await sb
      .from("time_off_requests")
      .select("user_id")
      .eq("status", "approved")
      .lte("start_date", date)
      .gte("end_date", date)
      .in("user_id", ids);
    if (error) throw new Error(`time off lookup: ${error.message}`);
    const off = (data ?? []).map((r) => String((r as { user_id: unknown }).user_id));
    return capacityFromPeople(ids, off);
  },

  async notifyStaff(sb, n) {
    // Always the SERVICE client: hub_notifications insert RLS allows only admins and Leads.
    const { data, error } = await sb.from("profiles").select("id").eq("role", "admin").eq("is_active", true);
    if (error) throw new Error(`admin lookup: ${error.message}`);
    const ids = (data ?? []).map((p) => String((p as { id: unknown }).id));
    if (ids.length === 0) throw new Error("No active admins to notify.");
    // The bell rows plus the hub's web push fan-out; throwOnError so a lost alert is retried.
    await insertNotifications(
      sb,
      ids.map((userId) => ({ userId, kind: n.kind, title: n.title, body: n.body, href: n.href })),
      { throwOnError: true },
    );
  },

  async sendEmail(m) {
    const result = await sendEmailDetailed({
      to: m.to,
      subject: m.subject,
      text: m.text,
      html: m.html,
      replyTo: m.replyTo ?? null,
    });
    return { ok: result.ok, skipped: result.skipped, error: result.error };
  },

  async currentAdmin() {
    try {
      // getRealProfile, not getCurrentProfile: "View as staff" (vp_view_as) downgrades the role
      // for the UI only, and admin actions must still see the real admin.
      const profile = await getRealProfile();
      if (!profile || profile.role !== "admin" || profile.is_active === false) return null;
      return { id: profile.id, name: profile.full_name || profile.email || "Admin" };
    } catch (err) {
      console.error("[inquiry-forms] admin check failed", err instanceof Error ? err.message : err);
      return null;
    }
  },

  async viewerRole() {
    // getCurrentProfile applies the vp_view_as cookie (house rule: new page gates use it).
    const profile = await getCurrentProfile();
    return profile ? profile.role : null;
  },
};
