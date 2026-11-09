"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { InterviewStatus } from "@/lib/types/hiring-ats";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "You must be signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { supabase, user: null, error: "Only admins can manage hiring." };
  }
  return { supabase, user, error: null as string | null };
}

/* ---------- Interview scheduling ---------- */

export async function createInterviewAction(input: {
  candidateId: string;
  scheduledAt: string;
  interviewer: string;
  location: string;
  notes: string;
}): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Unauthorized" };

  if (!input.candidateId) return { error: "Pick a candidate." };
  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) return { error: "Pick a valid date/time." };

  const { error: insertError } = await supabase.from("interview_schedules").insert({
    candidate_id: input.candidateId,
    scheduled_at: when.toISOString(),
    interviewer: input.interviewer.trim(),
    location: input.location.trim(),
    notes: input.notes.trim(),
    created_by: user.id,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath("/hiring");
  return { error: null };
}

export async function setInterviewStatusAction(
  id: string,
  status: InterviewStatus,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const { error: updateError } = await supabase
    .from("interview_schedules")
    .update({ status })
    .eq("id", id);
  if (updateError) return { error: updateError.message };

  revalidatePath("/hiring");
  return { error: null };
}

export async function deleteInterviewAction(
  id: string,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const { error: deleteError } = await supabase
    .from("interview_schedules")
    .delete()
    .eq("id", id);
  if (deleteError) return { error: deleteError.message };

  revalidatePath("/hiring");
  return { error: null };
}

/* ---------- Interview templates ---------- */

export async function createTemplateAction(input: {
  title: string;
  track: string;
  questions: string[];
}): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const title = input.title.trim();
  if (!title) return { error: "Title is required." };
  const questions = input.questions
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, 50);

  const { error: insertError } = await supabase.from("interview_templates").insert({
    title,
    track: input.track || "general",
    questions,
    created_by: user.id,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath("/hiring");
  return { error: null };
}

export async function deleteTemplateAction(
  id: string,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const { error: deleteError } = await supabase
    .from("interview_templates")
    .delete()
    .eq("id", id);
  if (deleteError) return { error: deleteError.message };

  revalidatePath("/hiring");
  return { error: null };
}
