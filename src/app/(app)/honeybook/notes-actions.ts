"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { canAccessHoneyBook, canEditHoneyBookProject } from "@/lib/honeybook/access";
import { notLeadSenderKey } from "@/lib/honeybook/gmail/trail-core";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

const UUID_RE = /^[0-9a-f-]{36}$/i;
const MAX_NOTE_CHARS = 2000;

async function requireProjectEditor(projectId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." as const, profile: null, supabase: null };
  if (!canAccessHoneyBook(profile.role)) {
    return {
      error: "Only admins, Leads, and staff can open HoneyBook." as const,
      profile: null,
      supabase: null,
    };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("honeybook_project_assignees")
    .select("profile_id")
    .eq("project_id", projectId);
  const ids = (data ?? []).map((r) => r.profile_id as string);
  if (!canEditHoneyBookProject(profile.role, ids, profile.id)) {
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
  const { error: insertError } = await supabase.from("honeybook_project_notes").insert({
    project_id: input.projectId,
    author_id: profile.id,
    source: "manual",
    category: needsAction ? "action" : "note",
    body,
    needs_action: needsAction,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath(`/honeybook/projects/${input.projectId}`);
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
    .from("honeybook_project_notes")
    .update({ action_done_at: input.done ? new Date().toISOString() : null })
    .eq("id", input.noteId)
    .eq("project_id", input.projectId)
    .eq("needs_action", true);
  if (updateError) return { error: updateError.message };

  revalidatePath(`/honeybook/projects/${input.projectId}`);
  return { error: null };
}

/**
 * "Not a lead": for a card the email monitor created by mistake. Remembers the thread and the
 * prospect's address so that mail is skipped next time, shows the summary to the classifier as a
 * "not a lead" example, then removes the card (and its client if nothing else uses it).
 */
export async function markProjectNotALeadAction(input: { projectId: string }): Promise<Result> {
  if (!UUID_RE.test(input.projectId)) return { error: "Project not found." };
  const { error, profile } = await requireProjectEditor(input.projectId);
  if (error || !profile) return { error: error ?? "Not allowed." };
  if (!isServiceRoleConfigured()) return { error: "The Hub is missing its service key." };

  const db = createServiceClient();
  const { data: project } = await db
    .from("honeybook_projects")
    .select("id, name, client_id, source_event")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };
  if (project.source_event !== "gmail") {
    return { error: "Only cards created from email can be marked not a lead." };
  }

  const [{ data: threads }, { data: noteRow }, { data: client }] = await Promise.all([
    db.from("honeybook_gmail_threads").select("mailbox, thread_id").eq("project_id", project.id),
    db
      .from("honeybook_project_notes")
      .select("body")
      .eq("project_id", project.id)
      .eq("category", "email")
      .order("occurred_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    project.client_id
      ? db.from("honeybook_clients").select("id, email, source_event").eq("id", project.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const summary = String(noteRow?.body ?? "")
    .replace(/^New inquiry came in by email to [^.]+\.\s*/i, "")
    .slice(0, 300);
  const rows: Record<string, unknown>[] = (threads ?? []).map((t) => ({
    kind: "thread",
    mailbox: t.mailbox,
    thread_id: t.thread_id,
    summary,
    project_name: project.name,
    created_by: profile.id,
  }));
  const sender = notLeadSenderKey(client?.email as string | undefined);
  if (sender) {
    rows.push({
      kind: "sender",
      sender_email: sender,
      summary,
      project_name: project.name,
      created_by: profile.id,
    });
  }
  // Remember first, delete second: if remembering fails the card stays and nothing is lost.
  for (const row of rows) {
    const { error: insErr } = await db.from("honeybook_gmail_not_leads").insert(row);
    if (insErr && !/duplicate|unique/i.test(insErr.message)) return { error: insErr.message };
  }

  const { error: delErr } = await db.from("honeybook_projects").delete().eq("id", project.id);
  if (delErr) return { error: delErr.message };

  if (client && client.source_event === "gmail") {
    const { count } = await db
      .from("honeybook_projects")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id);
    if ((count ?? 0) === 0) await db.from("honeybook_clients").delete().eq("id", client.id);
  }

  revalidatePath("/honeybook");
  return { error: null };
}
