"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { sendEmail } from "@/lib/email/send";
import { createClient } from "@/lib/supabase/server";
import {
  ACTION_PRIORITIES,
  type ActionPriority,
} from "@/lib/types/action-items";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

const VALID_PRIORITY = new Set(ACTION_PRIORITIES.map((p) => p.value));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ASSIGNEES = 20;

function cleanPriority(value: string): ActionPriority {
  return (VALID_PRIORITY.has(value as ActionPriority)
    ? value
    : "normal") as ActionPriority;
}

function cleanAssignees(ids: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids ?? []) {
    const id = raw?.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
    if (out.length >= MAX_ASSIGNEES) break;
  }
  return out;
}

function revalidateActionPages() {
  revalidatePath("/action-center");
  revalidatePath("/for-you");
  revalidatePath("/");
}

async function emailAssignees(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assigneeIds: string[],
  creatorName: string,
  title: string,
) {
  if (assigneeIds.length === 0) return;
  const { data: people } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", assigneeIds);
  for (const person of people ?? []) {
    if (!person?.email) continue;
    try {
      await sendEmail({
        to: person.email as string,
        subject: "A task was assigned to you",
        text: `${creatorName} assigned you a task: ${title}\n\nView it in the hub under Action Center.`,
      });
    } catch {
      // non-critical
    }
  }
}

/** Award action_completed to everyone who was assigned (or the completer when unassigned). */
async function awardCompletion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actionId: string,
  assigneeIds: string[],
  completerId: string,
  completerIsAdmin: boolean,
) {
  const targets = assigneeIds.length > 0 ? assigneeIds : [completerId];
  try {
    const { awardAchievementTo } = await import("@/lib/points/hub-points");
    const { createServiceClient, isServiceRoleConfigured } = await import(
      "@/lib/supabase/admin"
    );
    for (const userId of targets) {
      const canUseSession = userId === completerId || completerIsAdmin;
      if (canUseSession) {
        await awardAchievementTo(supabase, userId, "action_completed", {
          action_id: actionId,
        });
      } else if (isServiceRoleConfigured()) {
        await awardAchievementTo(
          createServiceClient(),
          userId,
          "action_completed",
          { action_id: actionId },
        );
      }
    }
  } catch {
    // non-critical
  }
}

export async function createActionAction(input: {
  title: string;
  detail: string;
  assignees: string[];
  dueDate: string;
  priority: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const title = input.title?.trim();
  if (!title) return { error: "Give the task a title." };
  const dueDate = ISO_DATE.test(input.dueDate?.trim() ?? "")
    ? input.dueDate.trim()
    : null;
  const assignees = cleanAssignees(input.assignees);

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("action_items")
    .insert({
      title: title.slice(0, 300),
      detail: (input.detail ?? "").trim().slice(0, 2000),
      created_by: profile.id,
      assigned_to: assignees[0] ?? null,
      due_date: dueDate,
      priority: cleanPriority(input.priority),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (assignees.length > 0) {
    const { error: assignError } = await supabase
      .from("action_item_assignees")
      .insert(
        assignees.map((userId) => ({
          action_id: created.id,
          user_id: userId,
        })),
      );
    if (assignError) return { error: assignError.message };
  }

  try {
    const { awardAchievement } = await import("@/lib/points/hub-points");
    await awardAchievement(supabase, "action_created", {
      action_id: created.id,
    });
  } catch {
    // non-critical
  }

  const toNotify = assignees.filter((id) => id !== profile.id);
  if (toNotify.length > 0) {
    try {
      await supabase.rpc("notify_action_assignees", {
        p_action_id: created.id,
        p_user_ids: toNotify,
      });
      await emailAssignees(supabase, toNotify, profile.full_name, title);
    } catch {
      // non-critical
    }
  }

  revalidateActionPages();
  return { error: null };
}

/**
 * Whole-task toggle (creator/admin, or unassigned tasks). Keeps every
 * assignee's per-person check-off in sync with the task status.
 */
export async function toggleActionDoneAction(input: {
  id: string;
  done: boolean;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("action_items")
    .select("id, status")
    .eq("id", input.id)
    .maybeSingle();
  const { data: assigneeRows } = await supabase
    .from("action_item_assignees")
    .select("user_id")
    .eq("action_id", input.id);
  const assigneeIds = (assigneeRows ?? []).map((r) => r.user_id as string);

  const { error } = await supabase
    .from("action_items")
    .update({
      status: input.done ? "done" : "open",
      completed_at: input.done ? now : null,
      completed_by: input.done ? profile.id : null,
      updated_at: now,
    })
    .eq("id", input.id);
  if (error) return { error: error.message };

  // Sync per-person check-offs with the whole-task state.
  if (assigneeIds.length > 0) {
    const sync = supabase
      .from("action_item_assignees")
      .update({ done_at: input.done ? now : null })
      .eq("action_id", input.id);
    await (input.done ? sync.is("done_at", null) : sync);
  }

  if (input.done && existing?.status !== "done") {
    await awardCompletion(
      supabase,
      input.id,
      assigneeIds,
      profile.id,
      profile.role === "admin",
    );
  }

  revalidateActionPages();
  return { error: null };
}

/**
 * An assignee checks off (or un-checks) their own part. The task flips to done
 * when every assignee has checked theirs, and reopens when someone un-checks.
 */
export async function checkOffMyAssignmentAction(input: {
  id: string;
  done: boolean;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };

  const now = new Date().toISOString();
  const supabase = await createClient();

  const { error: checkError } = await supabase
    .from("action_item_assignees")
    .update({ done_at: input.done ? now : null })
    .eq("action_id", input.id)
    .eq("user_id", profile.id);
  if (checkError) return { error: checkError.message };

  const [{ data: rows }, { data: task }] = await Promise.all([
    supabase
      .from("action_item_assignees")
      .select("user_id, done_at")
      .eq("action_id", input.id),
    supabase
      .from("action_items")
      .select("id, status")
      .eq("id", input.id)
      .maybeSingle(),
  ]);
  const assignees = rows ?? [];
  const allDone =
    assignees.length > 0 && assignees.every((r) => r.done_at !== null);

  if (allDone && task?.status !== "done") {
    const { error } = await supabase
      .from("action_items")
      .update({
        status: "done",
        completed_at: now,
        completed_by: profile.id,
        updated_at: now,
      })
      .eq("id", input.id);
    if (error) return { error: error.message };

    await awardCompletion(
      supabase,
      input.id,
      assignees.map((r) => r.user_id as string),
      profile.id,
      profile.role === "admin",
    );
    try {
      await supabase.rpc("notify_action_completed", { p_action_id: input.id });
    } catch {
      // non-critical
    }
  } else if (!allDone && task?.status === "done") {
    const { error } = await supabase
      .from("action_items")
      .update({
        status: "open",
        completed_at: null,
        completed_by: null,
        updated_at: now,
      })
      .eq("id", input.id);
    if (error) return { error: error.message };
  }

  revalidateActionPages();
  return { error: null };
}

export async function updateActionAction(input: {
  id: string;
  title: string;
  detail: string;
  assignees: string[];
  dueDate: string;
  priority: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };

  const title = input.title?.trim();
  if (!title) return { error: "Give the task a title." };
  const dueDate = ISO_DATE.test(input.dueDate?.trim() ?? "")
    ? input.dueDate.trim()
    : null;
  const assignees = cleanAssignees(input.assignees);

  const supabase = await createClient();
  const { data: existingRows } = await supabase
    .from("action_item_assignees")
    .select("user_id")
    .eq("action_id", input.id);
  const existingIds = new Set(
    (existingRows ?? []).map((r) => r.user_id as string),
  );
  const added = assignees.filter((id) => !existingIds.has(id));
  const removed = [...existingIds].filter((id) => !assignees.includes(id));

  const { error } = await supabase
    .from("action_items")
    .update({
      title: title.slice(0, 300),
      detail: (input.detail ?? "").trim().slice(0, 2000),
      assigned_to: assignees[0] ?? null,
      due_date: dueDate,
      priority: cleanPriority(input.priority),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { error: error.message };

  if (removed.length > 0) {
    await supabase
      .from("action_item_assignees")
      .delete()
      .eq("action_id", input.id)
      .in("user_id", removed);
  }
  if (added.length > 0) {
    const { error: assignError } = await supabase
      .from("action_item_assignees")
      .insert(
        added.map((userId) => ({ action_id: input.id, user_id: userId })),
      );
    if (assignError) return { error: assignError.message };
  }

  const toNotify = added.filter((id) => id !== profile.id);
  if (toNotify.length > 0) {
    try {
      await supabase.rpc("notify_action_assignees", {
        p_action_id: input.id,
        p_user_ids: toNotify,
      });
      await emailAssignees(supabase, toNotify, profile.full_name, title);
    } catch {
      // non-critical
    }
  }

  revalidateActionPages();
  return { error: null };
}

export async function deleteActionAction(id: string): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };

  const supabase = await createClient();
  const { error } = await supabase.from("action_items").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateActionPages();
  return { error: null };
}

export async function addActionCommentAction(input: {
  actionId: string;
  body: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const body = input.body?.trim();
  if (!body) return { error: "Write a comment first." };

  const supabase = await createClient();
  const { error } = await supabase.from("action_item_comments").insert({
    action_id: input.actionId,
    author_id: profile.id,
    body: body.slice(0, 2000),
  });
  if (error) {
    return {
      error: error.message.includes("row-level security")
        ? "Only the task's creator, its assignees, or an admin can comment."
        : error.message,
    };
  }

  try {
    await supabase.rpc("notify_action_comment", {
      p_action_id: input.actionId,
      p_snippet: body.slice(0, 140),
    });
  } catch {
    // non-critical
  }

  revalidatePath("/action-center");
  return { error: null };
}

export async function deleteActionCommentAction(
  commentId: string,
): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("action_item_comments")
    .delete()
    .eq("id", commentId);
  if (error) return { error: error.message };

  revalidatePath("/action-center");
  return { error: null };
}
