"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { uploadProposalPdfToDrive } from "@/lib/proposals/drive-upload";
import {
  buildProposalPdf,
  proposalFileName,
} from "@/lib/proposals/pdf";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PROPOSAL_INTRO,
  type ProposalLineSnapshot,
  type ProposalStatus,
} from "@/lib/types/proposals";
import {
  summarizeQuoteLines,
  type QuoteLineItem,
} from "@/lib/types/quoting";

type Result = { error: string | null; id?: string; pdfBase64?: string };

function revalidateProposals(id?: string) {
  revalidatePath("/proposals");
  revalidatePath("/quoting");
  if (id) revalidatePath(`/proposals/${id}`);
}

async function requireStaff() {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, error: "Sign in first." as const };
  if (profile.role === "guest") {
    return { profile: null, error: "Guest access is read-only." as const };
  }
  return { profile, error: null };
}

function mapLines(rows: Record<string, unknown>[]): QuoteLineItem[] {
  return rows.map((r) => ({
    id: String(r.id ?? ""),
    quote_id: String(r.quote_id ?? ""),
    label: String(r.label ?? ""),
    quantity: Number(r.quantity) || 1,
    list_unit_price: Number(r.list_unit_price) || 0,
    quote_unit_price: Number(r.quote_unit_price) || 0,
    sort_order: Number(r.sort_order) || 0,
  }));
}

function snapshotFromLines(lines: QuoteLineItem[]): ProposalLineSnapshot[] {
  return lines.map((l) => ({
    label: l.label,
    quantity: l.quantity,
    list_unit_price: l.list_unit_price,
    quote_unit_price: l.quote_unit_price,
  }));
}

export async function createProposalFromQuoteAction(
  quoteId: string,
): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };

  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return { error: "Quote not found." };
  if (quote.created_by !== profile.id && profile.role !== "admin") {
    return { error: "Not allowed." };
  }
  if (quote.status !== "ready") {
    return { error: "Only Ready quotes can become proposals. Mark the quote ready first." };
  }

  const { data: lineRows } = await supabase
    .from("quote_line_items")
    .select("*")
    .eq("quote_id", quoteId)
    .order("sort_order", { ascending: true });
  const lines = mapLines((lineRows ?? []) as Record<string, unknown>[]);
  if (lines.length === 0) return { error: "Quote has no line items." };

  const summary = summarizeQuoteLines(lines);
  const title = `Proposal — ${String(quote.client_name || "Event").trim() || "Event"}`;

  const { data, error: insertError } = await supabase
    .from("proposals")
    .insert({
      quote_id: quoteId,
      created_by: profile.id,
      client_name: String(quote.client_name ?? ""),
      event_name: String(quote.event_name ?? ""),
      event_date: quote.event_date ?? null,
      department: String(quote.department ?? "General"),
      title,
      intro: DEFAULT_PROPOSAL_INTRO,
      notes: String(quote.notes ?? ""),
      status: "draft",
      list_total: summary.listTotal,
      quote_total: summary.quoteTotal,
      lines_snapshot: snapshotFromLines(lines),
    })
    .select("id")
    .single();

  if (insertError) {
    if (/proposals|schema cache|does not exist/i.test(insertError.message)) {
      return {
        error:
          "Proposals need a database update. Run migration 123_proposals.sql in Supabase, then try again.",
      };
    }
    return { error: insertError.message };
  }

  revalidateProposals(data.id as string);
  return { error: null, id: data.id as string };
}

export async function updateProposalMetaAction(input: {
  id: string;
  title: string;
  intro: string;
  notes: string;
  clientName: string;
  eventName: string;
  eventDate: string;
  department: string;
}): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("proposals")
    .select("id, created_by")
    .eq("id", input.id)
    .maybeSingle();
  if (!existing) return { error: "Proposal not found." };
  if (existing.created_by !== profile.id && profile.role !== "admin") {
    return { error: "Not allowed." };
  }

  const eventDate =
    /^\d{4}-\d{2}-\d{2}$/.test(input.eventDate?.trim() ?? "")
      ? input.eventDate.trim()
      : null;

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      title: (input.title ?? "").trim().slice(0, 200) || "Proposal",
      intro: (input.intro ?? "").trim().slice(0, 4000),
      notes: (input.notes ?? "").trim().slice(0, 4000),
      client_name: (input.clientName ?? "").trim().slice(0, 200),
      event_name: (input.eventName ?? "").trim().slice(0, 200),
      event_date: eventDate,
      department: (input.department ?? "General").trim().slice(0, 80),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (updateError) return { error: updateError.message };
  revalidateProposals(input.id);
  return { error: null };
}

export async function deleteProposalAction(id: string): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };

  const supabase = await createClient();
  const { error: delError } = await supabase.from("proposals").delete().eq("id", id);
  if (delError) return { error: delError.message };
  revalidateProposals();
  return { error: null };
}

async function loadProposalForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  profileId: string,
  isAdmin: boolean,
) {
  const { data } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { proposal: null, error: "Proposal not found." as const };
  if (data.created_by !== profileId && !isAdmin) {
    return { proposal: null, error: "Not allowed." as const };
  }
  return { proposal: data, error: null };
}

export async function generateProposalPdfAction(
  id: string,
): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };

  const supabase = await createClient();
  const { proposal, error: loadError } = await loadProposalForUser(
    supabase,
    id,
    profile.id,
    profile.role === "admin",
  );
  if (loadError || !proposal) return { error: loadError ?? "Not found." };

  const lines = Array.isArray(proposal.lines_snapshot)
    ? (proposal.lines_snapshot as ProposalLineSnapshot[])
    : [];
  if (lines.length === 0) return { error: "Proposal has no line items." };

  const bytes = await buildProposalPdf({
    title: String(proposal.title ?? "Proposal"),
    clientName: String(proposal.client_name ?? ""),
    eventName: String(proposal.event_name ?? ""),
    eventDate: (proposal.event_date as string) ?? null,
    department: String(proposal.department ?? ""),
    intro: String(proposal.intro ?? ""),
    notes: String(proposal.notes ?? ""),
    lines,
    preparedBy: profile.full_name ?? undefined,
  });

  const statusUpdate: Partial<{ status: ProposalStatus; generated_at: string; updated_at: string }> = {
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (proposal.status === "draft") {
    statusUpdate.status = "generated";
  }

  await supabase.from("proposals").update(statusUpdate).eq("id", id);

  revalidateProposals(id);
  return {
    error: null,
    pdfBase64: Buffer.from(bytes).toString("base64"),
  };
}

export async function uploadProposalToDriveAction(
  id: string,
): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };

  const supabase = await createClient();
  const { proposal, error: loadError } = await loadProposalForUser(
    supabase,
    id,
    profile.id,
    profile.role === "admin",
  );
  if (loadError || !proposal) return { error: loadError ?? "Not found." };

  const lines = Array.isArray(proposal.lines_snapshot)
    ? (proposal.lines_snapshot as ProposalLineSnapshot[])
    : [];
  if (lines.length === 0) return { error: "Proposal has no line items." };

  const pdfBytes = await buildProposalPdf({
    title: String(proposal.title ?? "Proposal"),
    clientName: String(proposal.client_name ?? ""),
    eventName: String(proposal.event_name ?? ""),
    eventDate: (proposal.event_date as string) ?? null,
    department: String(proposal.department ?? ""),
    intro: String(proposal.intro ?? ""),
    notes: String(proposal.notes ?? ""),
    lines,
    preparedBy: profile.full_name ?? undefined,
  });

  const fileName = proposalFileName({
    clientName: String(proposal.client_name ?? ""),
    eventName: String(proposal.event_name ?? ""),
    eventDate: (proposal.event_date as string) ?? null,
  });

  const uploaded = await uploadProposalPdfToDrive({
    clientName: String(proposal.client_name ?? ""),
    eventName: String(proposal.event_name ?? ""),
    eventDate: (proposal.event_date as string) ?? null,
    fileName,
    bytes: Buffer.from(pdfBytes),
  });
  if (uploaded.error) return { error: uploaded.error };

  const keepLinked = proposal.status === "linked" && proposal.pipeline_project_id;
  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      drive_file_id: uploaded.fileId,
      drive_web_view_link: uploaded.webViewLink,
      drive_folder_path: uploaded.folderPath,
      status: keepLinked ? "linked" : "uploaded",
      generated_at: new Date().toISOString(),
      uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) return { error: updateError.message };
  revalidateProposals(id);
  return { error: null };
}

export async function linkProposalToPipelineAction(input: {
  proposalId: string;
  pipelineProjectId: string;
}): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };
  if (profile.role !== "admin") {
    return {
      error:
        "Only admins can write the Drive link onto a Pipeline project in the Hub. Upload to Drive, then copy the link into Pipeline, or ask an admin to link it here.",
    };
  }

  const supabase = await createClient();
  const { proposal, error: loadError } = await loadProposalForUser(
    supabase,
    input.proposalId,
    profile.id,
    profile.role === "admin",
  );
  if (loadError || !proposal) return { error: loadError ?? "Not found." };

  if (!proposal.drive_web_view_link) {
    return {
      error: "Upload the PDF to Google Drive first, then link Pipeline.",
    };
  }

  const { data: project } = await supabase
    .from("pipeline_projects")
    .select("id, name, details")
    .eq("id", input.pipelineProjectId)
    .maybeSingle();
  if (!project) return { error: "Pipeline project not found in the Hub." };

  const marker = "LRE Hub proposal:";
  const linkLine = `${marker} ${proposal.drive_web_view_link}`;
  const existingDetails = String(project.details ?? "");
  let nextDetails = existingDetails;
  if (existingDetails.includes(marker)) {
    nextDetails = existingDetails
      .split("\n")
      .map((line) => (line.includes(marker) ? linkLine : line))
      .join("\n");
  } else {
    nextDetails = existingDetails.trim()
      ? `${existingDetails.trim()}\n\n${linkLine}`
      : linkLine;
  }

  const { error: projectError } = await supabase
    .from("pipeline_projects")
    .update({
      details: nextDetails.slice(0, 8000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", project.id);
  if (projectError) return { error: projectError.message };

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      pipeline_project_id: project.id,
      pipeline_linked_at: new Date().toISOString(),
      status: "linked",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.proposalId);
  if (updateError) return { error: updateError.message };

  revalidateProposals(input.proposalId);
  revalidatePath("/pipeline");
  return { error: null };
}

export async function searchPipelineProjectsAction(
  query: string,
): Promise<{ error: string | null; projects?: { id: string; name: string; stage: string; client_name: string | null }[] }> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };
  if (profile.role !== "admin") {
    return { error: "Admins only can browse Pipeline projects." };
  }

  const supabase = await createClient();
  const q = query.trim();
  let req = supabase
    .from("pipeline_projects")
    .select("id, name, stage, client_id")
    .order("updated_at", { ascending: false })
    .limit(25);
  if (q) {
    req = req.ilike("name", `%${q}%`);
  }
  const { data, error: dbError } = await req;
  if (dbError) return { error: dbError.message };

  const clientIds = Array.from(
    new Set(
      ((data ?? []) as { client_id?: string | null }[])
        .map((r) => r.client_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const { data: clients } = clientIds.length
    ? await supabase
        .from("pipeline_clients")
        .select("id, full_name")
        .in("id", clientIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map(
    (clients ?? []).map((c) => [c.id as string, c.full_name as string]),
  );

  const projects = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    stage: String(row.stage ?? ""),
    client_name: row.client_id
      ? nameById.get(String(row.client_id)) ?? null
      : null,
  }));
  return { error: null, projects };
}
