"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

type Result = { error: string | null };

async function requireMember() {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, error: "Sign in first." };
  if (profile.role === "guest") {
    return { profile: null, error: "Guest access is read-only." };
  }
  return { profile, error: null as string | null };
}

function validUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export async function createThreadAction(input: {
  title: string;
  body: string;
  categoryId: string | null;
}): Promise<{ error: string | null; id?: string }> {
  const { profile, error } = await requireMember();
  if (!profile) return { error: error ?? "Unauthorized" };

  const title = input.title.trim();
  if (!title) return { error: "Add a title." };

  const supabase = await createClient();
  const { data, error: insertError } = await supabase
    .from("forum_threads")
    .insert({
      title: title.slice(0, 200),
      body: input.body.trim(),
      category_id: input.categoryId || null,
      author_id: profile.id,
    })
    .select("id")
    .single();
  if (insertError) return { error: insertError.message };

  // Author auto-follows their own thread.
  await supabase
    .from("forum_follows")
    .insert({ thread_id: data.id, user_id: profile.id });

  revalidatePath("/forum");
  return { error: null, id: data.id as string };
}

export async function createPostAction(input: {
  threadId: string;
  body: string;
}): Promise<Result> {
  const { profile, error } = await requireMember();
  if (!profile) return { error: error ?? "Unauthorized" };

  const body = input.body.trim();
  if (!body) return { error: "Write a reply." };

  const supabase = await createClient();
  const { data, error: insertError } = await supabase
    .from("forum_posts")
    .insert({ thread_id: input.threadId, body, author_id: profile.id })
    .select("id")
    .single();
  if (insertError) return { error: insertError.message };

  try {
    await supabase.rpc("notify_forum_reply", { p_post_id: data.id });
  } catch {
    // non-critical
  }

  revalidatePath(`/forum/${input.threadId}`);
  revalidatePath("/forum");
  return { error: null };
}

export async function toggleFollowAction(
  threadId: string,
  follow: boolean,
): Promise<Result> {
  const { profile, error } = await requireMember();
  if (!profile) return { error: error ?? "Unauthorized" };

  const supabase = await createClient();
  if (follow) {
    await supabase
      .from("forum_follows")
      .insert({ thread_id: threadId, user_id: profile.id });
  } else {
    await supabase
      .from("forum_follows")
      .delete()
      .eq("thread_id", threadId)
      .eq("user_id", profile.id);
  }
  revalidatePath(`/forum/${threadId}`);
  revalidatePath("/forum");
  return { error: null };
}

export async function addAttachmentAction(input: {
  threadId: string;
  title: string;
  url: string;
}): Promise<Result> {
  const { profile, error } = await requireMember();
  if (!profile) return { error: error ?? "Unauthorized" };

  const url = input.url.trim();
  if (!validUrl(url)) return { error: "Enter a valid URL (include https://)." };

  const supabase = await createClient();
  const { error: insertError } = await supabase.from("forum_attachments").insert({
    thread_id: input.threadId,
    title: input.title.trim() || url,
    url,
    created_by: profile.id,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath(`/forum/${input.threadId}`);
  return { error: null };
}

export async function deleteAttachmentAction(id: string): Promise<Result> {
  const { profile, error } = await requireMember();
  if (!profile) return { error: error ?? "Unauthorized" };
  const supabase = await createClient();
  const { error: delError } = await supabase
    .from("forum_attachments")
    .delete()
    .eq("id", id);
  if (delError) return { error: delError.message };
  return { error: null };
}

export async function deletePostAction(
  id: string,
  threadId: string,
): Promise<Result> {
  const { profile, error } = await requireMember();
  if (!profile) return { error: error ?? "Unauthorized" };
  const supabase = await createClient();
  const { error: delError } = await supabase
    .from("forum_posts")
    .delete()
    .eq("id", id);
  if (delError) return { error: delError.message };
  revalidatePath(`/forum/${threadId}`);
  return { error: null };
}

export async function deleteThreadAction(id: string): Promise<Result> {
  const { profile, error } = await requireMember();
  if (!profile) return { error: error ?? "Unauthorized" };
  const supabase = await createClient();
  const { error: delError } = await supabase
    .from("forum_threads")
    .delete()
    .eq("id", id);
  if (delError) return { error: delError.message };
  revalidatePath("/forum");
  return { error: null };
}
