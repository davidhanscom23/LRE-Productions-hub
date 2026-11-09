"use server";

import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";
import { datetimeLocalEasternToIso } from "@/lib/av-erp/datetime";

export type ActivityActionResult =
  | { ok: true }
  | { ok: false; error: string };

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function revalidateActivities() {
  revalidatePath("/rentals/activities");
  revalidatePath("/rentals");
}

export async function createActivityAction(
  formData: FormData,
): Promise<ActivityActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const subject = str(formData, "subject");
  if (!subject) return { ok: false, error: "Subject is required." };
  const dueRaw = str(formData, "due_at");
  const dueAt = datetimeLocalEasternToIso(dueRaw);
  if (!dueAt) return { ok: false, error: "Set a due date (Eastern)." };

  const opportunityId = str(formData, "opportunity_id") || null;

  const { error: insertError } = await supabase.from("av_activities").insert({
    subject,
    kind: str(formData, "kind"),
    due_at: dueAt,
    opportunity_id: opportunityId,
    notes: str(formData, "notes"),
    created_by: profile.id,
  });
  if (insertError) return { ok: false, error: insertError.message };
  revalidateActivities();
  return { ok: true };
}

export async function settleActivityAction(
  formData: FormData,
): Promise<ActivityActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Missing activity." };

  const { error: updateError } = await supabase
    .from("av_activities")
    .update({ settled_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) return { ok: false, error: updateError.message };
  revalidateActivities();
  return { ok: true };
}

export async function reopenActivityAction(
  formData: FormData,
): Promise<ActivityActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Missing activity." };

  const { error: updateError } = await supabase
    .from("av_activities")
    .update({ settled_at: null })
    .eq("id", id);
  if (updateError) return { ok: false, error: updateError.message };
  revalidateActivities();
  return { ok: true };
}

export async function deleteActivityAction(
  formData: FormData,
): Promise<ActivityActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Missing activity." };

  const { error: delError } = await supabase
    .from("av_activities")
    .delete()
    .eq("id", id);
  if (delError) return { ok: false, error: delError.message };
  revalidateActivities();
  return { ok: true };
}
