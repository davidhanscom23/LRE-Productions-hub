import { notFound, redirect } from "next/navigation";
import { ForumThreadView } from "@/components/forum/forum-thread-view";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type {
  ForumAttachment,
  ForumPost,
  ForumThreadDetail,
} from "@/lib/types/forum";

export default async function ForumThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("forum_threads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!thread) notFound();

  const [{ data: author }, { data: category }, { data: attachRows }, { data: postRows }, { data: follow }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, color")
        .eq("id", thread.author_id)
        .maybeSingle(),
      thread.category_id
        ? supabase
            .from("forum_categories")
            .select("name")
            .eq("id", thread.category_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("forum_attachments")
        .select("*")
        .eq("thread_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("forum_posts")
        .select("id, thread_id, author_id, body, created_at")
        .eq("thread_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("forum_follows")
        .select("thread_id")
        .eq("thread_id", id)
        .eq("user_id", profile.id)
        .maybeSingle(),
    ]);

  const posts = postRows ?? [];
  const posterIds = Array.from(new Set(posts.map((p) => p.author_id as string)));
  const { data: posterRows } = posterIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, color")
        .in("id", posterIds)
    : { data: [] as { id: string; full_name: string; color: string | null }[] };
  const posterMap = new Map(
    (posterRows ?? []).map((p) => [
      p.id as string,
      { name: (p.full_name as string) || "Staff", color: (p.color as string) ?? null },
    ]),
  );

  const detail: ForumThreadDetail = {
    id: thread.id as string,
    category_id: (thread.category_id as string) ?? null,
    category_name: (category as { name?: string } | null)?.name ?? null,
    author_id: thread.author_id as string,
    author_name: (author?.full_name as string) || "Staff",
    author_color: (author?.color as string) ?? null,
    title: thread.title as string,
    body: (thread.body as string) ?? "",
    is_pinned: Boolean(thread.is_pinned),
    created_at: thread.created_at as string,
    is_following: Boolean(follow),
    attachments: (attachRows ?? []) as ForumAttachment[],
  };

  const postList: ForumPost[] = posts.map((p) => ({
    id: p.id as string,
    thread_id: p.thread_id as string,
    author_id: p.author_id as string,
    author_name: posterMap.get(p.author_id as string)?.name ?? "Staff",
    author_color: posterMap.get(p.author_id as string)?.color ?? null,
    body: p.body as string,
    created_at: p.created_at as string,
  }));

  const isAdmin = profile.role === "admin";

  return (
    <ForumThreadView
      thread={detail}
      posts={postList}
      currentUserId={profile.id}
      isAdmin={isAdmin}
    />
  );
}
