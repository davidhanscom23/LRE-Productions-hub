"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, Cake, Trash2 } from "lucide-react";
import {
  createPostCommentAction,
  deletePostAction,
  deletePostCommentAction,
} from "@/app/(app)/actions";
import { NewPostBox } from "@/components/home/new-post-box";
import { formatFeedTime } from "@/lib/home/greeting";
import { COMPANY } from "@/lib/company";
import type { Post, PostComment, PostKind } from "@/lib/types/posts";

type CompanyFeedProps = {
  posts: Post[];
  currentUserId: string | null;
  canPost: boolean;
  canComment: boolean;
  isAdmin: boolean;
  /** Trainers/admins may delete their own posts; staff never get delete. */
  canDeleteOwnPosts: boolean;
};

export function CompanyFeed({
  posts,
  currentUserId,
  canPost,
  canComment,
  isAdmin,
  canDeleteOwnPosts,
}: CompanyFeedProps) {
  return (
    <section className="overflow-hidden rounded-[var(--panel-radius)] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
          The Feed
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Latest updates from the team.
        </p>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {canPost && <NewPostBox />}

        {posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/60 px-6 py-12 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- small static asset, no optimization needed */}
            <img
              src="/icon-192-v2.png"
              alt=""
              className="mx-auto mb-3 h-12 w-12 rounded-full"
            />
            <p className="font-medium text-[var(--foreground)]">
              The feed&apos;s taking a quick intermission
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {canPost
                ? "No fresh posts right now — be the first to share an update."
                : "No fresh posts right now. Check back soon."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => (
              <FeedPost
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                canComment={canComment}
                isAdmin={isAdmin}
                canDelete={
                  post.kind === "birthday" || post.kind === "anniversary"
                    ? isAdmin
                    : isAdmin ||
                      (canDeleteOwnPosts &&
                        currentUserId != null &&
                        post.author_id === currentUserId)
                }
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function celebrationLabel(kind: PostKind | undefined): string | null {
  if (kind === "birthday") return "Happy Birthday";
  if (kind === "anniversary") return "Company Anniversary";
  return null;
}

function FeedPost({
  post,
  canDelete,
  canComment,
  currentUserId,
  isAdmin,
}: {
  post: Post;
  canDelete: boolean;
  canComment: boolean;
  currentUserId: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const author = post.author;
  const isCelebration =
    post.kind === "birthday" || post.kind === "anniversary";
  const rawName = author?.full_name?.trim() || author?.email || "Staff";
  const personName = rawName;
  const name = isCelebration ? COMPANY.displayName : personName;
  const initial = isCelebration
    ? "Y"
    : rawName.charAt(0).toUpperCase();
  const hex =
    !isCelebration &&
    author?.color &&
    /^#[0-9A-Fa-f]{6}$/.test(author.color)
      ? author.color
      : null;
  const badge = celebrationLabel(post.kind);
  const comments = post.comments ?? [];

  function handleDelete() {
    if (!confirm("Delete this post?")) return;
    startTransition(async () => {
      const result = await deletePostAction(post.id);
      if (!result.error) router.refresh();
    });
  }

  function handleComment(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed) return;
    setCommentError(null);
    startTransition(async () => {
      const result = await createPostCommentAction(post.id, trimmed);
      if (result.error) {
        setCommentError(result.error);
        return;
      }
      setCommentText("");
      router.refresh();
    });
  }

  return (
    <li
      className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)]/40 p-4"
      style={
        hex
          ? { borderLeftWidth: 4, borderLeftColor: hex }
          : isCelebration
            ? {
                borderLeftWidth: 4,
                borderLeftColor: "var(--brand)",
              }
            : undefined
      }
    >
      <div className="flex items-start gap-3">
        {author?.avatar_url && !isCelebration ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.avatar_url}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
            style={hex ? { boxShadow: `0 0 0 2px ${hex}` } : undefined}
          />
        ) : author?.avatar_url && isCelebration ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.avatar_url}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
            style={{ boxShadow: "0 0 0 2px var(--brand)" }}
          />
        ) : (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            style={
              hex
                ? {
                    backgroundColor: `${hex}33`,
                    color: hex,
                    boxShadow: `0 0 0 2px ${hex}`,
                  }
                : {
                    backgroundColor: "var(--brand-soft)",
                    color: "var(--brand)",
                  }
            }
          >
            {isCelebration ? (
              post.kind === "birthday" ? (
                <Cake className="h-4 w-4" />
              ) : (
                <Award className="h-4 w-4" />
              )
            ) : (
              initial
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {badge ? (
                <p className="mb-0.5 inline-flex items-center gap-1 rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--brand)]">
                  {post.kind === "birthday" ? (
                    <Cake className="h-3 w-3" />
                  ) : (
                    <Award className="h-3 w-3" />
                  )}
                  {badge}
                </p>
              ) : null}
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                {name}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {formatFeedTime(post.created_at)}
              </p>
            </div>
            {canDelete && (
              <button
                type="button"
                disabled={pending}
                onClick={handleDelete}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-red-600 disabled:opacity-50"
                aria-label="Delete post"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
            {post.body}
          </p>

          <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-3">
            {comments.length > 0 ? (
              <ul className="space-y-2.5">
                {comments.map((comment) => (
                  <FeedComment
                    key={comment.id}
                    comment={comment}
                    canDelete={
                      isAdmin ||
                      (currentUserId != null &&
                        comment.author_id === currentUserId)
                    }
                  />
                ))}
              </ul>
            ) : null}

            {canComment ? (
              <form onSubmit={handleComment} className="flex flex-col gap-2">
                <label className="sr-only" htmlFor={`comment-${post.id}`}>
                  Comment
                </label>
                <textarea
                  id={`comment-${post.id}`}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={2}
                  placeholder={
                    isCelebration
                      ? "Leave a note to celebrate…"
                      : "Write a comment…"
                  }
                  className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
                />
                {commentError ? (
                  <p className="text-xs text-red-600 dark:text-red-300">
                    {commentError}
                  </p>
                ) : null}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={pending || !commentText.trim()}
                    className="inline-flex h-8 items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Comment
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

function FeedComment({
  comment,
  canDelete,
}: {
  comment: PostComment;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const author = comment.author;
  const rawName = author?.full_name?.trim() || author?.email || "Staff";
  const name = rawName;
  const initial = rawName.charAt(0).toUpperCase();

  function handleDelete() {
    if (!confirm("Delete this comment?")) return;
    startTransition(async () => {
      const result = await deletePostCommentAction(comment.id);
      if (!result.error) router.refresh();
    });
  }

  return (
    <li className="flex items-start gap-2.5">
      {author?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={author.avatar_url}
          alt=""
          className="mt-0.5 h-7 w-7 rounded-full object-cover"
        />
      ) : (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[10px] font-semibold text-[var(--brand)]">
          {initial}
        </div>
      )}
      <div className="min-w-0 flex-1 rounded-lg bg-[var(--surface)] px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[var(--foreground)]">
              {name}
              <span className="ml-1.5 font-normal text-[var(--muted)]">
                {formatFeedTime(comment.created_at)}
              </span>
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--foreground)]">
              {comment.body}
            </p>
          </div>
          {canDelete ? (
            <button
              type="button"
              disabled={pending}
              onClick={handleDelete}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-red-600 disabled:opacity-50"
              aria-label="Delete comment"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
