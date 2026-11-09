"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/types/tasks";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, error: "You must be signed in." as const };
  }

  return { supabase, user, error: null as string | null };
}

export async function createTaskAction(
  title: string,
  dueDate?: string | null,
): Promise<{ error: string | null; task?: Task }> {
  const { supabase, user, error } = await requireUser();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const trimmed = title.trim();
  if (!trimmed) return { error: "Add a task title." };

  const due = dueDate && dueDate.trim() ? dueDate.trim() : null;

  const { data, error: insertError } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: trimmed,
      due_date: due,
    })
    .select("*")
    .single();

  if (insertError) return { error: insertError.message };

  revalidatePath("/my-week");
  return { error: null, task: data as Task };
}

export async function toggleTaskDoneAction(
  id: string,
  isDone: boolean,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireUser();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const { data: existing } = await supabase
    .from("tasks")
    .select("is_done")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error: updateError } = await supabase
    .from("tasks")
    .update({ is_done: isDone })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) return { error: updateError.message };

  if (isDone && existing && existing.is_done !== true) {
    try {
      const { awardAchievement } = await import("@/lib/points/hub-points");
      await awardAchievement(supabase, "todo_completed", { task_id: id });
    } catch {
      // non-critical
    }
  }

  revalidatePath("/my-week");
  return { error: null };
}

export async function deleteTaskAction(
  id: string,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireUser();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const { error: deleteError } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) return { error: deleteError.message };

  revalidatePath("/my-week");
  return { error: null };
}

/** Local Hub mark-done for a HoneyBook task (does not write back to HoneyBook). */
export async function toggleHoneyBookTaskHubDoneAction(
  id: string,
  hubDone: boolean,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireUser();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const { error: updateError } = await supabase
    .from("honeybook_tasks")
    .update({
      hub_done: hubDone,
      hub_done_at: hubDone ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    if (/honeybook_tasks|schema cache|does not exist/i.test(updateError.message)) {
      return {
        error:
          "HoneyBook tasks need a database update. Run migration 124_honeybook_tasks.sql in Supabase.",
      };
    }
    return { error: updateError.message };
  }

  revalidatePath("/my-week");
  return { error: null };
}
