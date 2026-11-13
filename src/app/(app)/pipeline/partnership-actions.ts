"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import {
  canAccessPipeline,
  canEditPipelineProject,
  canManagePipelineCrm,
} from "@/lib/pipeline/access";
import {
  normalizePartnerKind,
  normalizePartnershipStage,
} from "@/lib/pipeline/partnerships";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Result = { error: string | null; id?: string };

const UUID_RE = /^[0-9a-f-]{36}$/i;

function parseMoney(raw: string | null | undefined): number | null | "bad" {
  const t = (raw ?? "").trim();
  if (t === "") return null;
  const n = Number.parseFloat(t.replace(/[$,]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : "bad";
}

function refresh(id?: string) {
  revalidatePath("/pipeline");
  if (id) revalidatePath(`/pipeline/projects/${id}`);
}

/** Admin or Lead creates a partnership. Money fields are saved only when an admin sends them. */
export async function createPartnershipAction(input: {
  name: string;
  partnerKind?: string;
  stage?: string;
  location?: string;
  details?: string;
  dealValue?: string | null;
  financialNotes?: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (!canManagePipelineCrm(profile.role)) {
    return { error: "Only admins and Leads can add partnerships." };
  }
  const name = input.name?.trim() ?? "";
  if (!name) return { error: "Partnership name is required." };
  const stage = normalizePartnershipStage(input.stage);
  const isAdmin = profile.role === "admin";
  const deal = isAdmin ? parseMoney(input.dealValue) : null;
  if (deal === "bad") return { error: "Deal value must be a number." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pipeline_projects")
    .insert({
      name: name.slice(0, 300),
      stage,
      record_type: "partnership",
      partner_kind: normalizePartnerKind(input.partnerKind),
      project_type: "",
      project_date: null,
      location: input.location?.trim().slice(0, 300) ?? "",
      details: input.details?.trim().slice(0, 8000) ?? "",
      budget: null,
      source_event: "hub",
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (/record_type|partner_kind|schema cache/i.test(error.message)) {
      return {
        error:
          "Run migration 177_pipeline_partnerships.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }
  const id = data?.id as string | undefined;
  if (id) {
    await supabase.from("pipeline_project_stage_events").insert({
      project_id: id,
      from_stage: "",
      to_stage: stage,
      changed_by: profile.id,
    });
    if (isAdmin && (deal != null || input.financialNotes?.trim())) {
      await supabase.from("pipeline_partnership_financials").upsert({
        project_id: id,
        deal_value: deal,
        financial_notes: input.financialNotes?.trim().slice(0, 4000) ?? "",
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      });
    }
  }
  refresh();
  return { error: null, id };
}

/** Admin, or anyone assigned to the partnership, edits its basic details and stage. */
export async function updatePartnershipAction(input: {
  id: string;
  name: string;
  partnerKind?: string;
  stage?: string;
  location?: string;
  details?: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (!canAccessPipeline(profile.role)) return { error: "Not allowed." };
  if (!UUID_RE.test(input.id ?? "")) return { error: "Missing partnership." };
  const name = input.name?.trim() ?? "";
  if (!name) return { error: "Partnership name is required." };

  const supabase = await createClient();
  const { data: assignees } = await supabase
    .from("pipeline_project_assignees")
    .select("profile_id")
    .eq("project_id", input.id);
  const ids = (assignees ?? []).map((r) => r.profile_id as string);
  if (!canEditPipelineProject(profile.role, ids, profile.id)) {
    return { error: "You can only edit partnerships you’re assigned to." };
  }

  const { data: existing } = await supabase
    .from("pipeline_projects")
    .select("id, stage, record_type")
    .eq("id", input.id)
    .maybeSingle();
  if (!existing || existing.record_type !== "partnership") {
    return { error: "Partnership not found." };
  }
  const stage = normalizePartnershipStage(input.stage ?? String(existing.stage));
  const { error } = await supabase
    .from("pipeline_projects")
    .update({
      name: name.slice(0, 300),
      stage,
      partner_kind: normalizePartnerKind(input.partnerKind),
      location: input.location?.trim().slice(0, 300) ?? "",
      details: input.details?.trim().slice(0, 8000) ?? "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { error: error.message };

  if (String(existing.stage ?? "") !== stage) {
    await supabase.from("pipeline_project_stage_events").insert({
      project_id: input.id,
      from_stage: String(existing.stage ?? ""),
      to_stage: stage,
      changed_by: profile.id,
    });
  }
  refresh(input.id);
  return { error: null };
}

/** Admins only: the money side of a partnership. Staff never read or write this. */
export async function savePartnershipFinancialsAction(input: {
  id: string;
  dealValue?: string | null;
  financialNotes?: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role !== "admin") return { error: "Admins only." };
  if (!UUID_RE.test(input.id ?? "")) return { error: "Missing partnership." };
  const deal = parseMoney(input.dealValue);
  if (deal === "bad") return { error: "Deal value must be a number." };

  const supabase = await createClient();
  const { error } = await supabase.from("pipeline_partnership_financials").upsert({
    project_id: input.id,
    deal_value: deal,
    financial_notes: input.financialNotes?.trim().slice(0, 4000) ?? "",
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) {
      return {
        error:
          "Run migration 177_pipeline_partnerships.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }
  refresh(input.id);
  return { error: null };
}
