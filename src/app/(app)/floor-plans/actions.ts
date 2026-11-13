"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { canAccessPipeline } from "@/lib/pipeline/access";
import {
  FLOOR_PLAN_BUCKET,
  floorPlanShareUrl,
  newFloorPlanToken,
} from "@/lib/floor-plans/public";
import {
  DEFAULT_PLAN_DATA,
  sanitizePlanData,
  type FloorPlanData,
} from "@/lib/floor-plans/types";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Result<T = object> = ({ error: string } | ({ error: null } & T));

const UUID_RE = /^[0-9a-f-]{36}$/i;

async function requireStaff() {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, error: "Sign in first." };
  if (!canAccessPipeline(profile.role)) {
    return { profile: null, error: "Only admins, Leads, and staff can use floor plans." };
  }
  return { profile, error: null as string | null };
}

export async function createFloorPlan(input: {
  projectId: string | null;
  templateId?: string | null;
  name?: string;
}): Promise<Result<{ id: string }>> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };
  const asTemplate = !input.projectId;
  if (asTemplate && profile.role === "staff") {
    return { error: "Only admins and Leads can create templates." };
  }
  if (input.projectId && !UUID_RE.test(input.projectId)) return { error: "Bad project." };
  const supabase = await createClient();

  let data: FloorPlanData = { ...DEFAULT_PLAN_DATA };
  let spaceName = "";
  if (input.templateId && UUID_RE.test(input.templateId)) {
    const { data: t } = await supabase
      .from("floor_plans")
      .select("data, space_name")
      .eq("id", input.templateId)
      .eq("is_template", true)
      .maybeSingle();
    if (!t) return { error: "Template not found." };
    data = sanitizePlanData(t.data);
    spaceName = (t.space_name as string) ?? "";
  }

  const { data: row, error: insErr } = await supabase
    .from("floor_plans")
    .insert({
      project_id: input.projectId,
      is_template: asTemplate,
      name: (input.name ?? "").trim().slice(0, 120) || (asTemplate ? "New template" : "Floor plan"),
      space_name: spaceName,
      data,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (insErr || !row) return { error: insErr?.message ?? "Could not create the plan." };
  if (input.projectId) revalidatePath(`/pipeline/projects/${input.projectId}`);
  revalidatePath("/floor-plans");
  return { error: null, id: row.id as string };
}

export async function saveFloorPlan(input: {
  id: string;
  name: string;
  spaceName: string;
  data: unknown;
}): Promise<Result<{ savedAt: string }>> {
  const { error } = await requireStaff();
  if (error) return { error };
  if (!UUID_RE.test(input.id)) return { error: "Bad plan." };
  const supabase = await createClient();
  const savedAt = new Date().toISOString();
  const { data: updated, error: upErr } = await supabase
    .from("floor_plans")
    .update({
      name: input.name.trim().slice(0, 120) || "Floor plan",
      space_name: input.spaceName.trim().slice(0, 120),
      data: sanitizePlanData(input.data),
      updated_at: savedAt,
    })
    .eq("id", input.id)
    .select("id");
  if (upErr) return { error: upErr.message };
  if (!updated?.length) return { error: "You can't edit this plan." };
  return { error: null, savedAt };
}

export async function deleteFloorPlan(id: string): Promise<Result> {
  const { error } = await requireStaff();
  if (error) return { error };
  if (!UUID_RE.test(id)) return { error: "Bad plan." };
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("floor_plans")
    .select("project_id, data")
    .eq("id", id)
    .maybeSingle();
  const { data: gone, error: delErr } = await supabase
    .from("floor_plans")
    .delete()
    .eq("id", id)
    .select("id");
  if (delErr) return { error: delErr.message };
  if (!gone?.length) return { error: "You can't delete this plan." };
  const path = sanitizePlanData(plan?.data).blueprint?.path;
  if (path && isServiceRoleConfigured()) {
    await createServiceClient().storage.from(FLOOR_PLAN_BUCKET).remove([path]);
  }
  if (plan?.project_id) revalidatePath(`/pipeline/projects/${plan.project_id}`);
  revalidatePath("/floor-plans");
  return { error: null };
}

export async function duplicateFloorPlan(id: string): Promise<Result<{ id: string }>> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };
  if (!UUID_RE.test(id)) return { error: "Bad plan." };
  const supabase = await createClient();
  const { data: src } = await supabase
    .from("floor_plans")
    .select("project_id, is_template, name, space_name, data")
    .eq("id", id)
    .maybeSingle();
  if (!src) return { error: "Plan not found." };
  const { data: row, error: insErr } = await supabase
    .from("floor_plans")
    .insert({
      project_id: src.project_id,
      is_template: src.is_template,
      name: `${src.name} (copy)`.slice(0, 120),
      space_name: src.space_name,
      data: src.data,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (insErr || !row) return { error: insErr?.message ?? "Could not duplicate." };
  revalidatePath("/floor-plans");
  if (src.project_id) revalidatePath(`/pipeline/projects/${src.project_id}`);
  return { error: null, id: row.id as string };
}

/** Save a project's plan as a reusable template (admins and Leads). */
export async function saveAsTemplate(id: string, name: string): Promise<Result<{ id: string }>> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };
  if (profile.role === "staff") return { error: "Only admins and Leads can save templates." };
  if (!UUID_RE.test(id)) return { error: "Bad plan." };
  const supabase = await createClient();
  const { data: src } = await supabase
    .from("floor_plans")
    .select("space_name, data")
    .eq("id", id)
    .maybeSingle();
  if (!src) return { error: "Plan not found." };
  // Templates share the blueprint-free layout so deleting a project's blueprint never breaks them.
  const data = sanitizePlanData(src.data);
  data.blueprint = null;
  const { data: row, error: insErr } = await supabase
    .from("floor_plans")
    .insert({
      project_id: null,
      is_template: true,
      name: name.trim().slice(0, 120) || "New template",
      space_name: src.space_name,
      data,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (insErr || !row) return { error: insErr?.message ?? "Could not save the template." };
  revalidatePath("/floor-plans");
  return { error: null, id: row.id as string };
}

export async function setFloorPlanPublished(
  id: string,
  published: boolean,
): Promise<Result<{ url: string | null }>> {
  const { error } = await requireStaff();
  if (error) return { error };
  if (!UUID_RE.test(id)) return { error: "Bad plan." };
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("floor_plans")
    .select("share_token, is_template")
    .eq("id", id)
    .maybeSingle();
  if (!plan) return { error: "Plan not found." };
  if (plan.is_template) return { error: "Templates can't be published." };
  const token = (plan.share_token as string | null) ?? newFloorPlanToken();
  const { data: updated, error: upErr } = await supabase
    .from("floor_plans")
    .update({
      status: published ? "published" : "draft",
      share_token: token,
      published_at: published ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id");
  if (upErr) return { error: upErr.message };
  if (!updated?.length) return { error: "You can't publish this plan." };
  return { error: null, url: published ? floorPlanShareUrl(token) : null };
}

/** Signed upload URL for a blueprint image/PDF page image (client uploads straight to storage). */
export async function createBlueprintUpload(input: {
  planId: string;
  fileName: string;
  contentType: string;
}): Promise<Result<{ path: string; token: string }>> {
  const { error } = await requireStaff();
  if (error) return { error };
  if (!UUID_RE.test(input.planId)) return { error: "Bad plan." };
  if (!/^image\/(png|jpeg|webp)$/.test(input.contentType)) {
    return { error: "Blueprints must be PNG, JPG or WebP images." };
  }
  if (!isServiceRoleConfigured()) return { error: "Storage isn't configured." };
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("floor_plans")
    .select("id")
    .eq("id", input.planId)
    .maybeSingle();
  if (!plan) return { error: "You can't edit this plan." };
  const ext = input.contentType === "image/png" ? "png" : input.contentType === "image/webp" ? "webp" : "jpg";
  const path = `${input.planId}/${Date.now()}.${ext}`;
  const { data, error: signErr } = await createServiceClient()
    .storage.from(FLOOR_PLAN_BUCKET)
    .createSignedUploadUrl(path);
  if (signErr || !data) return { error: signErr?.message ?? "Could not start the upload." };
  return { error: null, path, token: data.token };
}

/** Short-lived signed URL so the staff editor can display the private blueprint. */
export async function getBlueprintUrl(path: string): Promise<Result<{ url: string }>> {
  const { error } = await requireStaff();
  if (error) return { error };
  if (!isServiceRoleConfigured()) return { error: "Storage isn't configured." };
  const { data, error: e } = await createServiceClient()
    .storage.from(FLOOR_PLAN_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (e || !data) return { error: e?.message ?? "Could not load the blueprint." };
  return { error: null, url: data.signedUrl };
}
