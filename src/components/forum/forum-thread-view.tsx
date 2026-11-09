"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import {
  addAttachmentAction,
  createPostAction,
  deleteAttachmentAction,
  deletePostAction,
  deleteThreadAction,
  toggleFollowAction,
} from "@/app/(app)/forum/actions";
import type {
  ForumPost,
  ForumThreadDetail,
} from "@/lib/types/forum";

type Props = {
  thread: ForumThreadDetail;
  posts: ForumPost[];
  currentUserId: string;
  isAdmin: boolean;
};

function Avatar({ name, color }: { name: string; color: string | null }) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={{
        backgroundColor: color ? `${color}22` : "var(--brand-soft)",
        color: color || "var(--brand)",
        boxShadow: color ? `0 0 0 2px ${color}` : undefined,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ForumThreadView({ thread, posts, currentUserId, isAdmin }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [following, setFollowing] = useState(thread.is_following);
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [addingAsset, setAddingAsset] = useState(false);

  const canManageThread = isAdmin || thread.author_id === currentUserId;

  function toggleFollow() {
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      await toggleFollowAction(thread.id, next);
      router.refresh();
    });
  }

  function submitReply() {
    setReplyError(null);
    startTransition(async () => {
      const res = await createPostAction({ threadId: thread.id, body: reply });
      if (res.error) {
        setReplyError(res.error);
        return;
      }
      setReply("");
      router.refresh();
    });
  }

  function removeThread() {
    if (!confirm("Delete this discussion and all replies?")) return;
    startTransition(async () => {
      const res = await deleteThreadAction(thread.id);
      if (res.error) alert(res.error);
      else router.push("/forum");
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/forum"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to forum
      </Link>

      <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {thread.category_name ? (
            <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
              {thread.category_name}
            </span>
          ) : null}
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {thread.title}
        </h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]">
          <Avatar name={thread.author_name} color={thread.author_color} />
          <span className="font-medium text-[var(--foreground)]">
            {thread.author_name}
          </span>
          <span>· {when(thread.created_at)}</span>
        </div>
        {thread.body ? (
          <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--foreground)]">
            {thread.body}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleFollow}
            disabled={pending}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              following
                ? "border-[var(--brand)] text-[var(--brand)]"
                : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            {following ? "Following" : "Follow"}
          </button>
          {canManageThread ? (
            <button
              type="button"
              onClick={removeThread}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          ) : null}
        </div>
      </article>

      {/* Shared assets / attachments */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <Paperclip className="h-4 w-4" /> Shared assets
            <span className="rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
              {thread.attachments.length}
            </span>
          </h2>
          {canManageThread ? (
            <button
              type="button"
              onClick={() => setAddingAsset((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            >
              <Plus className="h-3.5 w-3.5" /> Add link
            </button>
          ) : null}
        </div>

        {addingAsset ? (
          <AddAssetForm threadId={thread.id} onDone={() => setAddingAsset(false)} />
        ) : null}

        {thread.attachments.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No shared assets yet.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {thread.attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              >
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--brand)] hover:underline"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  <span className="truncate">{a.title || a.url}</span>
                </a>
                {canManageThread ? (
                  <DeleteAssetButton id={a.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Replies */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          {posts.length} {posts.length === 1 ? "reply" : "replies"}
        </h2>
        {posts.map((p) => (
          <PostRow
            key={p.id}
            post={p}
            canDelete={isAdmin || p.author_id === currentUserId}
          />
        ))}

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            placeholder="Write a reply…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
          {replyError ? (
            <p className="mt-1 text-sm text-red-600">{replyError}</p>
          ) : null}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled={pending || !reply.trim()}
              onClick={submitReply}
              className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Posting…" : "Reply"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function PostRow({ post, canDelete }: { post: ForumPost; canDelete: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar name={post.author_name} color={post.author_color} />
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {post.author_name}
            </p>
            <p className="text-xs text-[var(--muted)]">{when(post.created_at)}</p>
          </div>
        </div>
        {canDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("Delete this reply?")) return;
              startTransition(async () => {
                await deletePostAction(post.id, post.thread_id);
                router.refresh();
              });
            }}
            className="rounded p-1 text-[var(--muted)] hover:text-red-600 disabled:opacity-50"
            aria-label="Delete reply"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
        {post.body}
      </p>
    </div>
  );
}

function AddAssetForm({
  threadId,
  onDone,
}: {
  threadId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await addAttachmentAction({ threadId, title, url });
      if (res.error) {
        setError(res.error);
        return;
      }
      setTitle("");
      setUrl("");
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Link title (optional)"
        className="h-9 min-w-[10rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
        className="h-9 min-w-[12rem] flex-[2] rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
      />
      <button
        type="button"
        disabled={pending || !url.trim()}
        onClick={add}
        className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        Add
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function DeleteAssetButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await deleteAttachmentAction(id);
          router.refresh();
        });
      }}
      className="rounded p-1 text-[var(--muted)] hover:text-red-600 disabled:opacity-50"
      aria-label="Delete asset"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
