"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { canAccessPipeline, canEditPipelineProject } from "@/lib/pipeline/access";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

const UUID_RE = /^[0-9a-f-]{36}$/i;
const MAX_NOTE_CHARS = 2000;

async function requireProjectEditor(projectId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." as const, profile: null, supabase: null };
  if (!canAccessPipeline(profile.role)) {
    return {
      error: "Only admins, Leads, and staff can open Pipeline." as const,
      profile: null,
      supabase: null,
    };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_project_assignees")
    .select("profile_id")
    .eq("project_id", projectId);
  const ids = (data ?? []).map((r) => r.profile_id as string);
  if (!canEditPipelineProject(profile.role, ids, profile.id)) {
    return {
      error: "Only admins and people assigned to this project can change its notes." as const,
      profile: null,
      supabase: null,
    };
  }
  return { error: null, profile, supabase };
}

/** Add a staff note to a project's trail. Optionally flag it as something that needs doing. */
export async function addProjectNoteAction(input: {
  projectId: string;
  body: string;
  needsAction?: boolean;
}): Promise<Result> {
  if (!UUID_RE.test(input.projectId)) return { error: "Project not found." };
  const body = input.body.trim();
  if (!body) return { error: "Write a note first." };
  if (body.length > MAX_NOTE_CHARS) {
    return { error: `Keep notes under ${MAX_NOTE_CHARS} characters.` };
  }

  const { error, profile, supabase } = await requireProjectEditor(input.projectId);
  if (error || !profile || !supabase) return { error: error ?? "Not allowed." };

  const needsAction = input.needsAction === true;
  const { error: insertError } = await supabase.from("pipeline_project_notes").insert({
    project_id: input.projectId,
    author_id: profile.id,
    source: "manual",
    category: needsAction ? "action" : "note",
    body,
    needs_action: needsAction,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath(`/pipeline/projects/${input.projectId}`);
  return { error: null };
}

/** Mark a "needs action" note done (or reopen it). */
export async function setProjectNoteDoneAction(input: {
  projectId: string;
  noteId: string;
  done: boolean;
}): Promise<Result> {
  if (!UUID_RE.test(input.projectId) || !UUID_RE.test(input.noteId)) {
    return { error: "Note not found." };
  }
  const { error, supabase } = await requireProjectEditor(input.projectId);
  if (error || !supabase) return { error: error ?? "Not allowed." };

  const { error: updateError } = await supabase
    .from("pipeline_project_notes")
    .update({ action_done_at: input.done ? new Date().toISOString() : null })
    .eq("id", input.noteId)
    .eq("project_id", input.projectId)
    .eq("needs_action", true);
  if (updateError) return { error: updateError.message };

  revalidatePath(`/pipeline/projects/${input.projectId}`);
  return { error: null };
}
