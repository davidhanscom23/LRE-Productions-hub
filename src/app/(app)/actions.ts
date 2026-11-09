"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

async function requireSignedInProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      role: null as UserRole | null,
      error: "You must be signed in." as const,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role ?? null) as UserRole | null;
  if (!role) {
    return {
      supabase,
      user: null,
      role: null,
      error: "Profile not found." as const,
    };
  }

  return { supabase, user, role, error: null as string | null };
}

export async function createPostAction(
  body: string,
): Promise<{ error: string | null }> {
  const { supabase, user, role, error } = await requireSignedInProfile();
  if (error || !user || !role) return { error: error ?? "Unauthorized" };

  if (role !== "admin" && role !== "trainer" && role !== "staff") {
    return { error: "You don’t have permission to post to the feed." };
  }

  const trimmed = body.trim();
  if (!trimmed) return { error: "Write something before posting." };

  const { error: insertError } = await supabase.from("posts").insert({
    author_id: user.id,
    body: trimmed,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath("/");
  return { error: null };
}

export async function deletePostAction(
  id: string,
): Promise<{ error: string | null }> {
  const { supabase, user, role, error } = await requireSignedInProfile();
  if (error || !user || !role) return { error: error ?? "Unauthorized" };

  if (role === "staff") {
    return { error: "Staff can’t delete feed posts." };
  }

  if (role !== "admin" && role !== "trainer") {
    return { error: "You don’t have permission to delete posts." };
  }

  const { data: post } = await supabase
    .from("posts")
    .select("author_id, kind")
    .eq("id", id)
    .maybeSingle();

  if (!post) return { error: "Post not found." };

  const kind = String((post as { kind?: string }).kind ?? "user");
  if (kind === "birthday" || kind === "anniversary") {
    if (role !== "admin") {
      return { error: "Only admins can remove celebration posts." };
    }
  } else if (role === "trainer" && post.author_id !== user.id) {
    return { error: "Trainers can only delete their own posts." };
  }

  const { error: deleteError } = await supabase
    .from("posts")
    .delete()
    .eq("id", id);

  if (deleteError) return { error: deleteError.message };

  revalidatePath("/");
  return { error: null };
}

export async function createPostCommentAction(
  postId: string,
  body: string,
): Promise<{ error: string | null }> {
  const { supabase, user, role, error } = await requireSignedInProfile();
  if (error || !user || !role) return { error: error ?? "Unauthorized" };

  if (role !== "admin" && role !== "trainer" && role !== "staff") {
    return { error: "You don’t have permission to comment." };
  }

  const trimmed = body.trim();
  if (!trimmed) return { error: "Write something before commenting." };
  if (trimmed.length > 2000) {
    return { error: "Comments must be 2,000 characters or fewer." };
  }

  const { error: insertError } = await supabase.from("post_comments").insert({
    post_id: postId,
    author_id: user.id,
    body: trimmed,
  });

  if (insertError) {
    if (/post_comments|relation|does not exist/i.test(insertError.message)) {
      return {
        error:
          "Comments aren’t available yet — run migration 083 in Supabase.",
      };
    }
    return { error: insertError.message };
  }

  revalidatePath("/");
  return { error: null };
}

export async function deletePostCommentAction(
  id: string,
): Promise<{ error: string | null }> {
  const { supabase, user, role, error } = await requireSignedInProfile();
  if (error || !user || !role) return { error: error ?? "Unauthorized" };

  if (role === "guest") {
    return { error: "Guests can’t delete comments." };
  }

  const { data: comment } = await supabase
    .from("post_comments")
    .select("author_id")
    .eq("id", id)
    .maybeSingle();

  if (!comment) return { error: "Comment not found." };

  if (role !== "admin" && comment.author_id !== user.id) {
    return { error: "You can only delete your own comments." };
  }

  const { error: deleteError } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", id);

  if (deleteError) return { error: deleteError.message };

  revalidatePath("/");
  return { error: null };
}
