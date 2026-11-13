import { PipelineClient } from "@/components/pipeline/pipeline-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  canAccessPipeline,
  canAssignPipelineFreely,
  canManagePipelineCrm,
} from "@/lib/pipeline/access";
import { createClient } from "@/lib/supabase/server";
import type {
  PipelineAssignmentRequest,
  PipelineClient as HbClient,
  PipelinePayment,
  PipelineProject,
  PipelineProjectAssignee,
  PipelineStageEvent,
  PartnershipFinancials,
} from "@/lib/types/pipeline";
import { redirect } from "next/navigation";

type PageProps = { searchParams: Promise<{ tab?: string }> };

export default async function PipelinePage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPipeline(profile.role)) redirect("/");

  const params = await searchParams;
  const tabParam = params.tab;
  const initialTab =
    tabParam === "projects" ||
    tabParam === "partnerships" ||
    tabParam === "clients" ||
    tabParam === "payments" ||
    tabParam === "overview"
      ? tabParam
      : "overview";

  const isAdmin = profile.role === "admin";
  const canManage = canManagePipelineCrm(profile.role);
  const canAssign = canAssignPipelineFreely(profile.role);
  const supabase = await createClient();

  const { data: clientRows, error: clientErr } = await supabase
    .from("pipeline_clients")
    .select("*")
    .order("updated_at", { ascending: false });

  if (clientErr) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Pipeline needs a database update</p>
        <p className="mt-2">
          Run migration <code>111_pipeline_crm.sql</code>
          {/policy|permission|row-level/i.test(clientErr.message)
            ? " (and later Pipeline migrations through 163)"
            : ""}{" "}
          in Supabase, then refresh. ({clientErr.message})
        </p>
      </div>
    );
  }

  const clients = (clientRows ?? []) as HbClient[];
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const { data: projectRows } = await supabase
    .from("pipeline_projects")
    .select("*")
    .order("updated_at", { ascending: false });

  // Cards merged into another one are archived and hidden (filtered here so the page still
  // loads before migration 175 adds the column).
  const projects: PipelineProject[] = (
    (projectRows ?? []) as PipelineProject[]
  )
    .filter((p) => !p.merged_into)
    .map((p) => {
    const c = p.client_id ? clientById.get(p.client_id) : null;
    return {
      ...p,
      client_name: c?.full_name ?? null,
      client_email: c?.email ?? null,
      assignees: [],
    };
  });

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const projectIds = projects.map((p) => p.id);

  const { data: staffRows } = await supabase
    .from("profiles")
    .select("id, full_name, email, color, role, is_active")
    .in("role", ["admin", "trainer", "staff"])
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const staffOptions = (staffRows ?? []).map((s) => ({
    id: s.id as string,
    full_name: String(s.full_name ?? ""),
    email: String(s.email ?? ""),
    color: (s.color as string | null) ?? null,
  }));
  const staffById = new Map(staffOptions.map((s) => [s.id, s]));

  if (projectIds.length > 0) {
    const { data: assigneeRows } = await supabase
      .from("pipeline_project_assignees")
      .select("project_id, profile_id, role, created_at")
      .in("project_id", projectIds)
      .order("created_at", { ascending: true });
    for (const row of assigneeRows ?? []) {
      const pid = row.project_id as string;
      const project = projectById.get(pid);
      if (!project) continue;
      const person = staffById.get(row.profile_id as string);
      const role =
        row.role === "lead" ? ("lead" as const) : ("support" as const);
      const assignee: PipelineProjectAssignee = {
        profile_id: row.profile_id as string,
        full_name: person?.full_name || "Teammate",
        color: person?.color ?? null,
        role,
        created_at: String(row.created_at ?? ""),
      };
      project.assignees = [...(project.assignees ?? []), assignee];
    }
    for (const project of projects) {
      if (!project.assignees?.length) continue;
      project.assignees = [...project.assignees].sort((a, b) => {
        const ar = a.role === "lead" ? 0 : 1;
        const br = b.role === "lead" ? 0 : 1;
        return ar - br;
      });
    }

    const { data: fileRows } = await supabase
      .from("pipeline_project_files")
      .select(
        "id, project_id, item_key, file_name, mime_type, size_bytes, uploaded_at",
      )
      .in("project_id", projectIds)
      .order("uploaded_at", { ascending: false });
    for (const row of fileRows ?? []) {
      const pid = row.project_id as string;
      const project = projectById.get(pid);
      if (!project) continue;
      project.files = [
        ...(project.files ?? []),
        {
          id: row.id as string,
          item_key: String(row.item_key ?? "other"),
          file_name: String(row.file_name ?? ""),
          mime_type: String(row.mime_type ?? ""),
          size_bytes: Number(row.size_bytes ?? 0),
          uploaded_at: String(row.uploaded_at ?? ""),
        },
      ];
    }

    const { data: qRows } = await supabase
      .from("pipeline_project_questionnaire_answers")
      .select("project_id, answers, submitted_at, updated_at")
      .in("project_id", projectIds);
    for (const row of qRows ?? []) {
      const pid = row.project_id as string;
      const project = projectById.get(pid);
      if (!project) continue;
      const raw =
        row.answers && typeof row.answers === "object"
          ? (row.answers as Record<string, unknown>)
          : {};
      const answers: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === "string" && v.trim()) answers[k] = v;
      }
      project.questionnaire = {
        answers,
        submitted_at: (row.submitted_at as string | null) ?? null,
        updated_at: (row.updated_at as string | null) ?? null,
      };
    }
  }

  // Partnership money is admin-only: the table's RLS blocks everyone else, and we do not even ask.
  const partnershipFinancials: Record<string, PartnershipFinancials> = {};
  if (isAdmin) {
    const partnershipIds = projects
      .filter((p) => p.record_type === "partnership")
      .map((p) => p.id);
    if (partnershipIds.length > 0) {
      const { data: finRows } = await supabase
        .from("pipeline_partnership_financials")
        .select("project_id, deal_value, financial_notes")
        .in("project_id", partnershipIds);
      for (const row of finRows ?? []) {
        partnershipFinancials[row.project_id as string] = {
          dealValue:
            row.deal_value == null ? null : Number(row.deal_value),
          notes: String(row.financial_notes ?? ""),
        };
      }
    }
  }

  const mergedTarget = new Map<string, string>();
  for (const row of (projectRows ?? []) as PipelineProject[]) {
    if (row.merged_into) mergedTarget.set(row.id, row.merged_into);
  }
  const resolveMerged = (id: string): string => {
    let cur = id;
    for (let i = 0; i < 5 && mergedTarget.has(cur); i += 1) cur = mergedTarget.get(cur)!;
    return cur;
  };

  const { data: paymentRows } = await supabase
    .from("pipeline_payments")
    .select("*")
    .order("paid_at", { ascending: false })
    .limit(500);

  const payments: PipelinePayment[] = (
    (paymentRows ?? []) as PipelinePayment[]
  ).map((pay) => ({
    ...pay,
    project_id: pay.project_id ? resolveMerged(pay.project_id) : null,
    client_name: pay.client_id
      ? (clientById.get(pay.client_id)?.full_name ?? null)
      : null,
    // A payment still pointing at a card that was merged away shows the card it merged into.
    project_name: pay.project_id
      ? (projectById.get(resolveMerged(pay.project_id))?.name ?? null)
      : null,
  }));

  const packetLinks: Record<
    string,
    { id: string; client_name: string; event_date: string }[]
  > = {};
  if (projectIds.length > 0) {
    const { data: packetRows } = await supabase
      .from("event_packets")
      .select("id, client_name, event_date, pipeline_project_id")
      .in("pipeline_project_id", projectIds)
      .order("event_date", { ascending: false });
    for (const row of packetRows ?? []) {
      const pid = row.pipeline_project_id as string | null;
      if (!pid) continue;
      const list = packetLinks[pid] ?? [];
      list.push({
        id: row.id as string,
        client_name: String(row.client_name ?? ""),
        event_date: String(row.event_date ?? ""),
      });
      packetLinks[pid] = list;
    }
  }

  const stageEventsByProject: Record<string, PipelineStageEvent[]> = {};
  if (projectIds.length > 0) {
    const { data: stageRows } = await supabase
      .from("pipeline_project_stage_events")
      .select(
        "id, project_id, from_stage, to_stage, changed_by, created_at, profiles:changed_by ( full_name )",
      )
      .in("project_id", projectIds)
      .order("created_at", { ascending: false })
      .limit(300);
    for (const row of stageRows ?? []) {
      const pid = row.project_id as string;
      const person = row.profiles as
        | { full_name: string | null }
        | { full_name: string | null }[]
        | null;
      const p = Array.isArray(person) ? person[0] : person;
      const list = stageEventsByProject[pid] ?? [];
      if (list.length >= 5) continue;
      list.push({
        id: row.id as string,
        project_id: pid,
        from_stage: String(row.from_stage ?? ""),
        to_stage: String(row.to_stage ?? ""),
        changed_by: (row.changed_by as string | null) ?? null,
        created_at: String(row.created_at ?? ""),
        changer_name: p?.full_name ?? null,
      });
      stageEventsByProject[pid] = list;
    }
  }

  const assignmentRequests: PipelineAssignmentRequest[] = [];
  if (isAdmin || canManage) {
    const { data: reqRows } = await supabase
      .from("pipeline_assignment_requests")
      .select(
        "id, project_id, requester_id, target_profile_id, action, status, note, created_at",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);
    for (const row of reqRows ?? []) {
      const project = projectById.get(row.project_id as string);
      const requester = staffById.get(row.requester_id as string);
      const target = staffById.get(row.target_profile_id as string);
      assignmentRequests.push({
        id: row.id as string,
        project_id: row.project_id as string,
        project_name: project?.name,
        requester_id: row.requester_id as string,
        requester_name: requester?.full_name,
        target_profile_id: row.target_profile_id as string,
        target_name: target?.full_name,
        action: row.action as "add" | "remove",
        status: "pending",
        note: String(row.note ?? ""),
        created_at: String(row.created_at ?? ""),
      });
    }
  }

  return (
    <PipelineClient
      clients={clients}
      projects={projects}
      payments={payments}
      partnershipFinancials={partnershipFinancials}
      packetLinks={packetLinks}
      stageEventsByProject={stageEventsByProject}
      isAdmin={isAdmin}
      canManage={canManage}
      canAssign={canAssign}
      currentProfileId={profile.id}
      staffOptions={staffOptions}
      assignmentRequests={assignmentRequests}
      initialTab={initialTab}
    />
  );
}
