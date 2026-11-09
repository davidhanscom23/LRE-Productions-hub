import { PartnershipDetailClient } from "@/components/honeybook/partnership-detail-client";
import { ProjectDetailClient } from "@/components/honeybook/project-detail-client";
import { isPartnership } from "@/lib/honeybook/partnerships";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  canAccessHoneyBook,
  canAssignHoneyBookFreely,
  canEditHoneyBookProject,
  canManageHoneyBookCrm,
} from "@/lib/honeybook/access";
import { createClient } from "@/lib/supabase/server";
import type {
  CatalogOption,
  InvoiceListItem,
} from "@/components/project-invoices/project-invoices";
import type {
  ContractListItem,
  ContractTemplateOption,
} from "@/components/project-contracts/project-contracts";
import { contractSignUrl } from "@/lib/project-contracts/server";
import { ensureStandardContractTemplates } from "@/lib/project-contracts/seed";
import type { ArchiveDocItem } from "@/components/honeybook/project-archive-docs";
import { allocatePayments } from "@/lib/project-invoices/math";
import { projectInvoicePayUrl } from "@/lib/project-invoices/server";
import type {
  FloorPlanListItem,
  FloorPlanTemplateOption,
} from "@/components/floor-plans/project-floor-plans";
import type {
  HoneyBookClient,
  HoneyBookProject,
  HoneyBookProjectAssignee,
  HoneyBookProjectNote,
  HoneyBookStageEvent,
  PartnershipFinancials,
} from "@/lib/types/honeybook";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function HoneyBookProjectDetailPage({ params }: Props) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessHoneyBook(profile.role)) redirect("/");

  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const canManage = canManageHoneyBookCrm(profile.role);
  const canAssign = canAssignHoneyBookFreely(profile.role);

  const { data: row, error } = await supabase
    .from("honeybook_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) notFound();

  const project = row as HoneyBookProject;

  if (project.client_id) {
    const { data: client } = await supabase
      .from("honeybook_clients")
      .select("full_name, email")
      .eq("id", project.client_id)
      .maybeSingle();
    project.client_name = client?.full_name ?? null;
    project.client_email = client?.email ?? null;
  }

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

  const { data: assigneeRows } = await supabase
    .from("honeybook_project_assignees")
    .select("profile_id, role, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true });
  project.assignees = (assigneeRows ?? [])
    .map((row) => {
      const person = staffById.get(row.profile_id as string);
      const assignee: HoneyBookProjectAssignee = {
        profile_id: row.profile_id as string,
        full_name: person?.full_name || "Teammate",
        color: person?.color ?? null,
        role: row.role === "lead" ? "lead" : "support",
        created_at: String(row.created_at ?? ""),
      };
      return assignee;
    })
    .sort((a, b) => {
      const ar = a.role === "lead" ? 0 : 1;
      const br = b.role === "lead" ? 0 : 1;
      return ar - br;
    });

  const { data: fileRows } = await supabase
    .from("honeybook_project_files")
    .select(
      "id, project_id, item_key, file_name, mime_type, size_bytes, uploaded_at",
    )
    .eq("project_id", id)
    .order("uploaded_at", { ascending: false });
  project.files = (fileRows ?? []).map((row) => ({
    id: row.id as string,
    item_key: String(row.item_key ?? "other"),
    file_name: String(row.file_name ?? ""),
    mime_type: String(row.mime_type ?? ""),
    size_bytes: Number(row.size_bytes ?? 0),
    uploaded_at: String(row.uploaded_at ?? ""),
  }));

  const { data: qRow } = await supabase
    .from("honeybook_project_questionnaire_answers")
    .select("answers, submitted_at, updated_at")
    .eq("project_id", id)
    .maybeSingle();
  if (qRow) {
    const raw =
      qRow.answers && typeof qRow.answers === "object"
        ? (qRow.answers as Record<string, unknown>)
        : {};
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "string" && v.trim()) answers[k] = v;
    }
    project.questionnaire = {
      answers,
      submitted_at: (qRow.submitted_at as string | null) ?? null,
      updated_at: (qRow.updated_at as string | null) ?? null,
    };
  }

  const { data: clientRows } = await supabase
    .from("honeybook_clients")
    .select("*")
    .order("full_name", { ascending: true });
  const clients = (clientRows ?? []) as HoneyBookClient[];

  const { data: stageRows } = await supabase
    .from("honeybook_project_stage_events")
    .select(
      "id, project_id, from_stage, to_stage, changed_by, created_at, profiles:changed_by ( full_name )",
    )
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  const stageEvents: HoneyBookStageEvent[] = (stageRows ?? []).map((row) => {
    const person = row.profiles as
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
    const p = Array.isArray(person) ? person[0] : person;
    return {
      id: row.id as string,
      project_id: id,
      from_stage: String(row.from_stage ?? ""),
      to_stage: String(row.to_stage ?? ""),
      changed_by: (row.changed_by as string | null) ?? null,
      created_at: String(row.created_at ?? ""),
      changer_name: p?.full_name ?? null,
    };
  });

  const { data: packetRows } = await supabase
    .from("event_packets")
    .select("id, client_name, event_date")
    .eq("honeybook_project_id", id)
    .order("event_date", { ascending: false });
  const packetLinks = (packetRows ?? []).map((row) => ({
    id: row.id as string,
    client_name: String(row.client_name ?? ""),
    event_date: String(row.event_date ?? ""),
  }));

  const staffNameByEmail = new Map(
    staffOptions.map((s) => [s.email.trim().toLowerCase(), s.full_name]),
  );
  const { data: noteRows } = await supabase
    .from("honeybook_project_notes")
    .select(
      "id, project_id, source, category, body, mailbox, needs_action, action_done_at, occurred_at, profiles:author_id ( full_name )",
    )
    .eq("project_id", id)
    .order("occurred_at", { ascending: false })
    .limit(100);
  const notes: HoneyBookProjectNote[] = (noteRows ?? []).map((row) => {
    const person = row.profiles as
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
    const p = Array.isArray(person) ? person[0] : person;
    const mailbox = String(row.mailbox ?? "");
    return {
      id: row.id as string,
      project_id: id,
      source: row.source as HoneyBookProjectNote["source"],
      category: row.category as HoneyBookProjectNote["category"],
      body: String(row.body ?? ""),
      mailbox,
      needs_action: Boolean(row.needs_action),
      action_done_at: (row.action_done_at as string | null) ?? null,
      occurred_at: String(row.occurred_at ?? ""),
      author_name:
        row.source === "gmail"
          ? staffNameByEmail.get(mailbox.toLowerCase()) ?? mailbox
          : p?.full_name ?? null,
    };
  });

  // Cards this one could be merged with (managers only) and, for an archived merge, the survivor.
  let mergeCandidates: HoneyBookProject[] = [];
  if (canManage && !project.merged_into) {
    const { data: otherRows } = await supabase
      .from("honeybook_projects")
      .select("*")
      .neq("id", id)
      .order("updated_at", { ascending: false })
      .limit(500);
    const clientById = new Map(clients.map((c) => [c.id, c]));
    mergeCandidates = ((otherRows ?? []) as HoneyBookProject[])
      .filter(
        (p) =>
          !p.merged_into &&
          !["archived", "lost"].includes(String(p.stage ?? "").trim().toLowerCase()),
      )
      .map((p) => {
        const c = p.client_id ? clientById.get(p.client_id) : null;
        return {
          ...p,
          client_name: c?.full_name ?? null,
          client_email: c?.email ?? null,
          assignees: [],
        };
      });
  }
  let mergedIntoCard: { id: string; name: string } | null = null;
  if (project.merged_into) {
    const { data: keptRow } = await supabase
      .from("honeybook_projects")
      .select("id, name")
      .eq("id", project.merged_into)
      .maybeSingle();
    if (keptRow) {
      mergedIntoCard = { id: keptRow.id as string, name: String(keptRow.name ?? "") };
    }
  }

  const canEdit = canEditHoneyBookProject(
    profile.role,
    (project.assignees ?? []).map((a) => a.profile_id),
    profile.id,
  );

  const { data: planRows } = await supabase
    .from("floor_plans")
    .select("id, name, space_name, status, updated_at, is_template")
    .or(`project_id.eq.${id},is_template.eq.true`)
    .order("updated_at", { ascending: false });
  const floorPlans: FloorPlanListItem[] = (planRows ?? [])
    .filter((r) => !r.is_template)
    .map((r) => ({
      id: r.id as string,
      name: String(r.name ?? ""),
      spaceName: String(r.space_name ?? ""),
      status: String(r.status ?? "draft"),
      updatedAt: String(r.updated_at ?? ""),
    }));
  const floorPlanTemplates: FloorPlanTemplateOption[] = (planRows ?? [])
    .filter((r) => r.is_template)
    .map((r) => ({ id: r.id as string, name: String(r.name ?? "") }));

  const today = new Date().toISOString().slice(0, 10);
  const { data: invRows } = await supabase
    .from("project_invoices")
    .select("*, project_invoice_lines(*), project_invoice_installments(label, amount, due_at, sort_order)")
    .eq("project_id", id)
    .order("created_at", { ascending: false });
  const invoices: InvoiceListItem[] = (invRows ?? []).map((r) => {
    const lines = ((r.project_invoice_lines ?? []) as { description: string; qty: number; unit_price: number; catalog_item_id: string | null; sort_order: number; section?: string | null }[])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => ({ description: l.description, qty: Number(l.qty), unit_price: Number(l.unit_price), catalog_item_id: l.catalog_item_id, section: l.section ?? "" }));
    const inst = ((r.project_invoice_installments ?? []) as { label: string; amount: number; due_at: string | null; sort_order: number }[])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({ label: i.label, amount: Number(i.amount), due_at: i.due_at }));
    return {
      id: r.id as string,
      number: String(r.number),
      title: String(r.title ?? ""),
      status: r.status as InvoiceListItem["status"],
      total: Number(r.total),
      amountPaid: Number(r.amount_paid),
      dueAt: (r.due_at as string | null) ?? null,
      taxRatePct: Number(r.tax_rate_pct),
      notes: String(r.notes ?? ""),
      payUrl: projectInvoicePayUrl(r.pay_token as string),
      lines,
      installments: allocatePayments(inst, Number(r.amount_paid), today).map((i) => ({
        label: i.label,
        amount: i.amount,
        due_at: i.due_at,
        paid: i.paid,
        overdue: i.overdue,
      })),
    };
  });
  const { data: contractRows } = await supabase
    .from("project_contracts")
    .select("id, title, body, status, sign_token, signer_name, signed_at, sent_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false });
  const contracts: ContractListItem[] = (contractRows ?? []).map((r) => ({
    id: r.id as string,
    title: String(r.title),
    body: String(r.body),
    status: r.status as ContractListItem["status"],
    signUrl: contractSignUrl(r.sign_token as string),
    signerName: String(r.signer_name ?? ""),
    signedAt: (r.signed_at as string | null) ?? null,
    sentAt: (r.sent_at as string | null) ?? null,
  }));
  await ensureStandardContractTemplates();
  const { data: tplRows } = await supabase
    .from("contract_templates")
    .select("id, name")
    .eq("active", true)
    .order("name");
  const contractTemplates: ContractTemplateOption[] = (tplRows ?? []).map((t) => ({
    id: t.id as string,
    name: String(t.name),
  }));
  const { data: archiveRows } = await supabase
    .from("honeybook_archive_documents")
    .select("id, kind, file_name, size_bytes, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false });
  const archiveDocs: ArchiveDocItem[] = (archiveRows ?? []).map((d) => ({
    id: d.id as string,
    kind: String(d.kind),
    fileName: String(d.file_name),
    sizeBytes: Number(d.size_bytes ?? 0),
    createdAt: String(d.created_at),
  }));
  const { data: catRows } = await supabase
    .from("service_catalog_items")
    .select("id, name, unit_price, category")
    .eq("active", true)
    .order("category")
    .order("name");
  const catalogOptions: CatalogOption[] = (catRows ?? []).map((c) => ({
    id: c.id as string,
    name: String(c.name),
    unitPrice: Number(c.unit_price),
    category: String(c.category ?? ""),
  }));

  if (isPartnership(project)) {
    // Money is admin-only: only admins ever query it (the table's RLS blocks everyone else too).
    let financials: PartnershipFinancials | null = null;
    if (profile.role === "admin") {
      const { data: fin } = await supabase
        .from("honeybook_partnership_financials")
        .select("deal_value, financial_notes")
        .eq("project_id", id)
        .maybeSingle();
      if (fin) {
        financials = {
          dealValue: fin.deal_value == null ? null : Number(fin.deal_value),
          notes: String(fin.financial_notes ?? ""),
        };
      }
    }
    return (
      <PartnershipDetailClient
        project={{ ...project, budget: null }}
        staffOptions={staffOptions}
        stageEvents={stageEvents}
        notes={notes}
        financials={financials}
        canManage={canManage}
        canAssign={canAssign}
        canEdit={canEdit}
        currentProfileId={profile.id}
        isAdmin={profile.role === "admin"}
      />
    );
  }

  return (
    <ProjectDetailClient
      project={project}
      clients={clients}
      staffOptions={staffOptions}
      stageEvents={stageEvents}
      notes={notes}
      packetLinks={packetLinks}
      canManage={canManage}
      canAssign={canAssign}
      canEdit={canEdit}
      currentProfileId={profile.id}
      isAdmin={profile.role === "admin"}
      mergeCandidates={mergeCandidates}
      mergedIntoCard={mergedIntoCard}
      floorPlans={floorPlans}
      floorPlanTemplates={floorPlanTemplates}
      invoices={invoices}
      archiveDocs={archiveDocs}
      contracts={contracts}
      contractTemplates={contractTemplates}
      catalogOptions={catalogOptions}
    />
  );
}
