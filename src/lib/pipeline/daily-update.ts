import "server-only";

import {
  buildAdminEmail,
  buildStaffEmail,
  hasAnythingToReport,
  isClosedStage,
  type DigestProject,
  type UnassignedPartnership,
  type StaffDigest,
  type UnassignedInquiry,
} from "@/lib/pipeline/daily-update-core";
import { isEmailConfigured, sendEmailDetailed } from "@/lib/email/send";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";

export type DailyUpdateResult = {
  ran: boolean;
  skippedReason: string | null;
  staffEmailed: number;
  adminEmailed: boolean;
  errors: string[];
};

function easternToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

function siteBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://hub.lreproductions.com";
}

function skipped(reason: string): DailyUpdateResult {
  return { ran: false, skippedReason: reason, staffEmailed: 0, adminEmailed: false, errors: [] };
}

type EmbeddedProject = {
  id: string;
  name: string;
  stage: string;
  project_date: string | null;
  location: string;
  client_id: string | null;
  updated_at: string;
};

/**
 * Once a day: each staff member gets their own update (events, stage, what needs doing),
 * and the admins get ONE combined email covering everybody.
 */
export async function runPipelineDailyUpdate(opts?: {
  force?: boolean;
}): Promise<DailyUpdateResult> {
  if (!isServiceRoleConfigured()) return skipped("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  if (!isEmailConfigured()) return skipped("RESEND_API_KEY or EMAIL_FROM is not configured.");

  const db = createServiceClient();
  const todayIso = easternToday();

  // Claim today's run first so a retried cron never double-sends.
  const { error: claimError } = await db.from("pipeline_digest_runs").insert({ run_date: todayIso });
  if (claimError) {
    if (/duplicate|unique/i.test(claimError.message)) {
      if (!opts?.force) return skipped("Already sent today.");
    } else {
      return skipped(`Could not record the run: ${claimError.message}`);
    }
  }

  const errors: string[] = [];

  const { data: people } = await db
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .in("role", ["admin", "trainer", "staff"])
    .eq("is_active", true);
  const staff = (people ?? []).filter((p) => String(p.email ?? "").includes("@"));

  // Active project assignments with the project embedded.
  const { data: assignRows } = await db
    .from("pipeline_project_assignees")
    .select(
      "profile_id, role, pipeline_projects!inner ( id, name, stage, project_date, location, client_id, updated_at )",
    );

  type Row = { profile_id: string; role: string; project: EmbeddedProject };
  const rows: Row[] = [];
  for (const r of assignRows ?? []) {
    const embedded = r.pipeline_projects as unknown as EmbeddedProject | EmbeddedProject[] | null;
    const project = Array.isArray(embedded) ? embedded[0] : embedded;
    if (!project || isClosedStage(String(project.stage ?? ""))) continue;
    rows.push({ profile_id: r.profile_id as string, role: String(r.role ?? "support"), project });
  }
  const projectIds = [...new Set(rows.map((r) => r.project.id))];

  // Partnerships (migration 177). Looked up separately so the update still sends before it is applied.
  const partnershipIds = new Set<string>();
  {
    const { data: ptRows, error: ptErr } = await db
      .from("pipeline_projects")
      .select("id, record_type")
      .eq("record_type", "partnership");
    if (!ptErr) for (const r of ptRows ?? []) partnershipIds.add(r.id as string);
  }

  const clientIds = [...new Set(rows.map((r) => r.project.client_id).filter((x): x is string => Boolean(x)))];
  const clientNames = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clients } = await db.from("pipeline_clients").select("id, full_name").in("id", clientIds);
    for (const c of clients ?? []) clientNames.set(c.id as string, String(c.full_name ?? ""));
  }

  // Trail: latest note + open actions per project.
  const lastNote = new Map<string, { body: string; at: string }>();
  const openActions = new Map<string, string[]>();
  if (projectIds.length > 0) {
    const { data: notes } = await db
      .from("pipeline_project_notes")
      .select("project_id, body, needs_action, action_done_at, occurred_at")
      .in("project_id", projectIds)
      .order("occurred_at", { ascending: false })
      .limit(2000);
    for (const n of notes ?? []) {
      const pid = n.project_id as string;
      if (!lastNote.has(pid)) {
        lastNote.set(pid, { body: String(n.body ?? "").slice(0, 280), at: String(n.occurred_at ?? "") });
      }
      if (n.needs_action && !n.action_done_at) {
        const list = openActions.get(pid) ?? [];
        if (list.length < 6) list.push(String(n.body ?? "").slice(0, 280));
        openActions.set(pid, list);
      }
    }
  }

  const digests: StaffDigest[] = staff.map((p) => {
    const mine = rows.filter((r) => r.profile_id === p.id);
    const projects: DigestProject[] = mine.map((r) => {
      const note = lastNote.get(r.project.id);
      return {
        id: r.project.id,
        name: String(r.project.name ?? "Untitled"),
        clientName: r.project.client_id ? clientNames.get(r.project.client_id) ?? "" : "",
        stage: String(r.project.stage ?? ""),
        projectDate: r.project.project_date,
        location: String(r.project.location ?? ""),
        role: r.role === "lead" ? "lead" : "support",
        kind: partnershipIds.has(r.project.id) ? "partnership" : "event",
        lastActivityAt: note?.at || r.project.updated_at || null,
        lastNote: note?.body ?? "",
        openActions: openActions.get(r.project.id) ?? [],
      };
    });
    return {
      staffId: p.id as string,
      name: String(p.full_name ?? "").trim() || String(p.email),
      email: String(p.email).trim(),
      projects,
    };
  });

  // Inquiry-stage projects nobody is assigned to yet.
  const assignedProjectIds = new Set(rows.map((r) => r.project.id));
  const { data: inquiryRows } = await db
    .from("pipeline_projects")
    .select("id, name, stage, client_id, created_at")
    .ilike("stage", "inquiry")
    .order("created_at", { ascending: false })
    .limit(100);
  const stillUnassigned = (inquiryRows ?? []).filter((p) => !assignedProjectIds.has(p.id as string));
  const { data: anyAssignees } = stillUnassigned.length
    ? await db
        .from("pipeline_project_assignees")
        .select("project_id")
        .in("project_id", stillUnassigned.map((p) => p.id as string))
    : { data: [] as { project_id: string }[] };
  const hasAssignee = new Set((anyAssignees ?? []).map((a) => a.project_id as string));
  const unassignedIds = stillUnassigned.filter((p) => !hasAssignee.has(p.id as string));
  const unassignedClientIds = unassignedIds
    .map((p) => p.client_id as string | null)
    .filter((x): x is string => Boolean(x) && !clientNames.has(x as string));
  if (unassignedClientIds.length > 0) {
    const { data: more } = await db.from("pipeline_clients").select("id, full_name").in("id", unassignedClientIds);
    for (const c of more ?? []) clientNames.set(c.id as string, String(c.full_name ?? ""));
  }
  // Open to-dos on partnerships nobody owns still reach the admins.
  const unassignedPartnerships: UnassignedPartnership[] = [];
  if (partnershipIds.size > 0) {
    const loose = [...partnershipIds].filter((id) => !assignedProjectIds.has(id));
    if (loose.length > 0) {
      const { data: ptProjects } = await db
        .from("pipeline_projects")
        .select("id, name, stage")
        .in("id", loose);
      const { data: ptNotes } = await db
        .from("pipeline_project_notes")
        .select("project_id, body, needs_action, action_done_at")
        .in("project_id", loose)
        .eq("needs_action", true)
        .is("action_done_at", null);
      const actionsBy = new Map<string, string[]>();
      for (const n of ptNotes ?? []) {
        const list = actionsBy.get(n.project_id as string) ?? [];
        if (list.length < 6) list.push(String(n.body ?? "").slice(0, 280));
        actionsBy.set(n.project_id as string, list);
      }
      for (const p of ptProjects ?? []) {
        if (isClosedStage(String(p.stage ?? ""))) continue;
        const acts = actionsBy.get(p.id as string);
        if (acts?.length) {
          unassignedPartnerships.push({
            id: p.id as string,
            name: String(p.name ?? "Untitled"),
            openActions: acts,
          });
        }
      }
    }
  }

  const unassigned: UnassignedInquiry[] = unassignedIds.map((p) => ({
    id: p.id as string,
    name: String(p.name ?? "Untitled"),
    clientName: p.client_id ? clientNames.get(p.client_id as string) ?? "" : "",
    createdAt: String(p.created_at ?? ""),
  }));

  const base = siteBase();
  let staffEmailed = 0;

  for (const d of digests) {
    if (!hasAnythingToReport(d)) continue;
    const email = buildStaffEmail(d, todayIso, base);
    const res = await sendEmailDetailed({ to: d.email, subject: email.subject, text: email.text, html: email.html });
    if (res.ok) staffEmailed += 1;
    else errors.push(`${d.email}: ${res.error ?? "send failed"}`);
  }

  // One combined email to the admins (not a copy of each staff email).
  let adminEmailed = false;
  const adminAddresses = staff
    .filter((p) => p.role === "admin")
    .map((p) => String(p.email).trim());
  if (adminAddresses.length > 0 && (digests.some(hasAnythingToReport) || unassigned.length > 0 || unassignedPartnerships.length > 0)) {
    const email = buildAdminEmail({ digests, unassigned, unassignedPartnerships, todayIso, siteBase: base });
    const res = await sendEmailDetailed({ to: adminAddresses, subject: email.subject, text: email.text, html: email.html });
    adminEmailed = res.ok;
    if (!res.ok) errors.push(`admin email: ${res.error ?? "send failed"}`);
  }

  await db
    .from("pipeline_digest_runs")
    .update({ staff_emailed: staffEmailed, admin_emailed: adminEmailed })
    .eq("run_date", todayIso);

  return { ran: true, skippedReason: null, staffEmailed, adminEmailed, errors };
}
