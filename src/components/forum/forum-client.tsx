"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MessagesSquare,
  Paperclip,
  Pin,
  Plus,
  Search,
  X,
} from "lucide-react";
import { createThreadAction, toggleFollowAction } from "@/app/(app)/forum/actions";
import {
  FORUM_SORTS,
  type ForumCategory,
  type ForumSort,
  type ForumThreadListItem,
} from "@/lib/types/forum";

type Props = {
  categories: ForumCategory[];
  threads: ForumThreadListItem[];
  currentUserId: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ForumClient({ categories, threads, currentUserId }: Props) {
  const [category, setCategory] = useState<string | "all">("all");
  const [sort, setSort] = useState<ForumSort>("active");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const countByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of threads) {
      if (t.category_id) m.set(t.category_id, (m.get(t.category_id) ?? 0) + 1);
    }
    return m;
  }, [threads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = threads.filter((t) => {
      if (category !== "all" && t.category_id !== category) return false;
      if (sort === "following" && !t.is_following) return false;
      if (sort === "mine" && t.author_id !== currentUserId) return false;
      if (sort === "unanswered" && t.reply_count > 0) return false;
      if (q) {
        const hay = `${t.title} ${t.body} ${t.author_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === "newest") {
      list = [...list].sort(
        (a, b) =>
          Number(b.is_pinned) - Number(a.is_pinned) ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }
    return list;
  }, [threads, category, sort, query, currentUserId]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
            <MessagesSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Community Forum
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Ask questions, share wins, and talk shop with the team.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New discussion
        </button>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:items-start">
        {/* Categories */}
        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-sm">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
              category === "all"
                ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            All discussions
            <span className="text-xs text-[var(--muted)]">{threads.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${
                category === c.id
                  ? "bg-[var(--brand-soft)] font-medium text-[var(--brand)]"
                  : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {c.name}
              <span className="text-xs text-[var(--muted)]">
                {countByCategory.get(c.id) ?? 0}
              </span>
            </button>
          ))}
        </aside>

        {/* Threads */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search discussions…"
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {FORUM_SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSort(s.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    sort === s.id
                      ? "bg-[var(--brand)] text-white"
                      : "bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
              No discussions here yet. Start one!
            </p>
          ) : (
            <ul className="space-y-3">
              {visible.map((t) => (
                <ThreadRow key={t.id} thread={t} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {creating ? (
        <NewThreadModal
          categories={categories}
          defaultCategory={category === "all" ? "" : category}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </div>
  );
}

function ThreadRow({ thread }: { thread: ForumThreadListItem }) {
  const router = useRouter();
  const [following, setFollowing] = useState(thread.is_following);
  const [pending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      await toggleFollowAction(thread.id, next);
      router.refresh();
    });
  }

  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm hover:border-[var(--brand)]/40">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/forum/${thread.id}`} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {thread.is_pinned ? (
              <Pin className="h-3.5 w-3.5 text-[var(--brand)]" />
            ) : null}
            <h3 className="font-semibold text-[var(--foreground)]">
              {thread.title}
            </h3>
            {thread.category_name ? (
              <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                {thread.category_name}
              </span>
            ) : null}
          </div>
          {thread.body ? (
            <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
              {thread.body}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
            <span>{thread.author_name}</span>
            <span>{timeAgo(thread.created_at)}</span>
            <span className="inline-flex items-center gap-1">
              <MessagesSquare className="h-3.5 w-3.5" />
              {thread.reply_count}
            </span>
            {thread.attachment_count > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" />
                {thread.attachment_count}
              </span>
            ) : null}
            <span>· active {timeAgo(thread.last_activity_at)}</span>
          </div>
        </Link>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
            following
              ? "border-[var(--brand)] text-[var(--brand)]"
              : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)]"
          }`}
        >
          {following ? "Following" : "Follow"}
        </button>
      </div>
    </li>
  );
}

function NewThreadModal({
  categories,
  defaultCategory,
  onClose,
}: {
  categories: ForumCategory[];
  defaultCategory: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategory);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createThreadAction({
        title,
        body,
        categoryId: categoryId || null,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onClose();
      if (res.id) router.push(`/forum/${res.id}`);
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            New discussion
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Discussion title"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]"
          >
            <option value="">Choose a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="What do you want to discuss?"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending || !title.trim()}
              onClick={submit}
              className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Posting…" : "Post discussion"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
