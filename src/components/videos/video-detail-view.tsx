"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  MessageSquare,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import { getVideoEmbed, iframeAllowFor } from "@/lib/resources/video-embed";
import {
  addVideoAssetAction,
  addVideoToForumAction,
  deleteVideoAssetAction,
} from "@/app/(app)/videos/actions";
import type {
  ArchiveVideo,
  ArchiveVideoAsset,
  ArchiveVideoChat,
} from "@/lib/types/video-archives";

type Props = {
  video: ArchiveVideo;
  assets: ArchiveVideoAsset[];
  chat: ArchiveVideoChat[];
  canManage: boolean;
};

function fmtTs(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function VideoDetailView({ video, assets, chat, canManage }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const embed = getVideoEmbed(video.video_url);

  function addToForum() {
    startTransition(async () => {
      const res = await addVideoToForumAction(video.id);
      if (res.error) {
        alert(res.error);
        return;
      }
      if (res.threadId) router.push(`/forum/${res.threadId}`);
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        href="/videos"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Video Archives
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {video.title}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] font-medium">
              {video.category}
            </span>
            <span>{video.year}</span>
            {video.presenter ? <span>· {video.presenter}</span> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={addToForum}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-60"
        >
          <MessageSquare className="h-4 w-4" /> Add to Forum
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        {/* Player */}
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-black">
          <div className="aspect-video w-full">
            {embed && embed.kind === "file" ? (
              <video src={embed.embedUrl} controls className="h-full w-full" />
            ) : embed ? (
              <iframe
                src={embed.embedUrl}
                allow={iframeAllowFor(embed.kind) ?? undefined}
                allowFullScreen
                className="h-full w-full"
                title={video.title}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center text-sm text-white/70">
                <a
                  href={video.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Open video ↗
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Meeting chat replay */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)]">
            <MessageSquare className="h-4 w-4" /> Meeting Chat
            {chat.length ? (
              <span className="rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                {chat.length}
              </span>
            ) : null}
          </div>
          {chat.length === 0 ? (
            <p className="p-4 text-sm text-[var(--muted)]">
              No meeting chat attached.
            </p>
          ) : (
            <ul className="max-h-[420px] space-y-3 overflow-auto p-4">
              {chat.map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="mr-2 text-[11px] font-medium text-[var(--muted)]">
                    {fmtTs(c.ts_seconds)}
                  </span>
                  {c.speaker ? (
                    <span className="font-semibold text-[var(--foreground)]">
                      {c.speaker}:{" "}
                    </span>
                  ) : null}
                  <span className="text-[var(--foreground)]">{c.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {video.description ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted)]">
          {video.description}
        </p>
      ) : null}

      {/* Shared assets */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <Paperclip className="h-4 w-4" /> Shared Assets
          <span className="rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
            {assets.length}
          </span>
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Documents, slides, links — anything shared in the meeting chat.
        </p>
        {canManage ? (
          <AddAssetForm videoId={video.id} />
        ) : null}
        {assets.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No shared assets yet.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {assets.map((a) => (
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
                {canManage ? (
                  <DeleteAssetButton id={a.id} videoId={video.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AddAssetForm({ videoId }: { videoId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await addVideoAssetAction({ videoId, title, url });
      if (res.error) {
        setError(res.error);
        return;
      }
      setTitle("");
      setUrl("");
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
        className="inline-flex h-9 items-center gap-1 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" /> Add link
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function DeleteAssetButton({ id, videoId }: { id: string; videoId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await deleteVideoAssetAction(id, videoId);
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
