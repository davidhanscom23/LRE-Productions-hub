import { redirect } from "next/navigation";
import { ForumClient } from "@/components/forum/forum-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type {
  ForumCategory,
  ForumThreadListItem,
} from "@/lib/types/forum";

export default async function ForumPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const supabase = await createClient();

  const { data: catRows, error } = await supabase
    .from("forum_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Forum needs a database update</p>
        <p className="mt-2">
          Run migration <code>107_forum.sql</code> in Supabase, then refresh.
        </p>
      </div>
    );
  }
  const categories = (catRows ?? []) as ForumCategory[];

  const { data: threadRows } = await supabase
    .from("forum_threads")
    .select(
      "id, category_id, author_id, title, body, is_pinned, created_at, last_activity_at",
    )
    .order("is_pinned", { ascending: false })
    .order("last_activity_at", { ascending: false })
    .limit(300);
  const threads = threadRows ?? [];
  const threadIds = threads.map((t) => t.id as string);

  // Author names.
  const authorIds = Array.from(new Set(threads.map((t) => t.author_id as string)));
  const { data: authorRows } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", authorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const authorName = new Map(
    (authorRows ?? []).map((a) => [a.id as string, (a.full_name as string) || "Staff"]),
  );

  // Reply + attachment counts.
  const replyCount = new Map<string, number>();
  const attachCount = new Map<string, number>();
  if (threadIds.length) {
    const { data: postRows } = await supabase
      .from("forum_posts")
      .select("thread_id")
      .in("thread_id", threadIds);
    for (const p of postRows ?? []) {
      const id = p.thread_id as string;
      replyCount.set(id, (replyCount.get(id) ?? 0) + 1);
    }
    const { data: attRows } = await supabase
      .from("forum_attachments")
      .select("thread_id")
      .in("thread_id", threadIds);
    for (const a of attRows ?? []) {
      const id = a.thread_id as string;
      attachCount.set(id, (attachCount.get(id) ?? 0) + 1);
    }
  }

  // Threads the current user follows.
  const { data: followRows } = await supabase
    .from("forum_follows")
    .select("thread_id")
    .eq("user_id", profile.id);
  const following = new Set((followRows ?? []).map((f) => f.thread_id as string));

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const items: ForumThreadListItem[] = threads.map((t) => ({
    id: t.id as string,
    category_id: (t.category_id as string) ?? null,
    category_name: t.category_id ? categoryName.get(t.category_id) ?? null : null,
    author_id: t.author_id as string,
    author_name: authorName.get(t.author_id as string) ?? "Staff",
    title: t.title as string,
    body: (t.body as string) ?? "",
    is_pinned: Boolean(t.is_pinned),
    created_at: t.created_at as string,
    last_activity_at: t.last_activity_at as string,
    reply_count: replyCount.get(t.id as string) ?? 0,
    attachment_count: attachCount.get(t.id as string) ?? 0,
    is_following: following.has(t.id as string),
  }));

  return (
    <ForumClient
      categories={categories}
      threads={items}
      currentUserId={profile.id}
    />
  );
}
