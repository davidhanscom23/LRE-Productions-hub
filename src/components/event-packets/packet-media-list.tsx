"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Trash2, Video } from "lucide-react";
import { deleteEventMediaAction } from "@/app/(app)/submit-event-photos/actions";
import {
  MediaPreviewModal,
  type MediaPreviewItem,
} from "@/components/event-media/media-preview-modal";
import { isImageMediaItem } from "@/lib/media/file-kind";
import { resolveDisplayableImageUrl } from "@/lib/media/resolve-preview-url";

export type PacketMediaListItem = {
  id: string;
  file_name: string;
  original_file_name: string;
  media_type: string;
  sequence_number: number | null;
  folder_path: string;
  storage_path: string;
  storage_provider: "supabase" | "bunny" | null;
  uploader_id: string;
  signed_url: string | null;
  /** Small grid thumbnail; the grid falls back to signed_url when null. */
  thumb_url: string | null;
};

type PacketMediaListProps = {
  media: PacketMediaListItem[];
  currentUserId: string;
  isAdmin: boolean;
  isTrainer?: boolean;
  /** Packet assignee can remove media on their own packet. */
  isAssignee?: boolean;
};

function isVideoMedia(item: Pick<PacketMediaListItem, "media_type" | "file_name">) {
  const type = item.media_type.toLowerCase();
  if (type === "video" || type.startsWith("video/")) return true;
  return /\.(mp4|mov|m4v|webm|avi|mkv|3gp)$/i.test(item.file_name);
}

export function PacketMediaList({
  media,
  currentUserId,
  isAdmin,
  isTrainer = false,
  isAssignee = false,
}: PacketMediaListProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaPreviewItem | null>(null);
  const [displayUrls, setDisplayUrls] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const sorted = useMemo(
    () =>
      [...media].sort((a, b) => {
        const aSeq = a.sequence_number ?? 0;
        const bSeq = b.sequence_number ?? 0;
        return aSeq - bSeq || a.file_name.localeCompare(b.file_name);
      }),
    [media],
  );

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    async function loadDisplayUrls() {
      const next: Record<string, string> = {};
      await Promise.all(
        sorted.map(async (item) => {
          if (!item.signed_url) return;
          // New uploads have a JPEG thumbnail — use it directly and skip the
          // HEIC probe, which downloads the full-size original.
          if (item.thumb_url) {
            next[item.id] = item.thumb_url;
            return;
          }
          if (isVideoMedia(item) || !isImageMediaItem(item)) {
            next[item.id] = item.signed_url;
            return;
          }
          try {
            const url = await resolveDisplayableImageUrl({
              url: item.signed_url,
              fileName: item.file_name,
            });
            if (cancelled) {
              if (url.startsWith("blob:")) URL.revokeObjectURL(url);
              return;
            }
            if (url.startsWith("blob:")) objectUrls.push(url);
            next[item.id] = url;
          } catch {
            next[item.id] = item.signed_url;
          }
        }),
      );
      if (!cancelled) setDisplayUrls(next);
    }

    void loadDisplayUrls();
    return () => {
      cancelled = true;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [sorted]);

  function canDelete(item: PacketMediaListItem) {
    return (
      isAdmin ||
      isTrainer ||
      isAssignee ||
      item.uploader_id === currentUserId
    );
  }

  function handleDelete(item: PacketMediaListItem) {
    if (!confirm(`Delete “${item.file_name}” from this packet?`)) return;
    setError(null);
    setPendingId(item.id);
    startTransition(async () => {
      const result = await deleteEventMediaAction(item.id);
      setPendingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (preview?.id === item.id) setPreview(null);
      router.refresh();
    });
  }

  function openPreview(item: PacketMediaListItem) {
    setPreview({
      id: item.id,
      file_name: item.file_name,
      media_type: item.media_type,
      // Items with a thumbnail store it in displayUrls for the grid; the
      // lightbox should always show the full-size original.
      preview_url: item.thumb_url
        ? item.signed_url
        : (displayUrls[item.id] ?? item.signed_url),
    });
  }

  if (sorted.length === 0) {
    return <p className="mt-2 text-sm text-[var(--muted)]">No media yet.</p>;
  }

  return (
    <div className="mt-3 space-y-3">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((item) => {
          const video = isVideoMedia(item);
          const url = displayUrls[item.id] ?? item.signed_url;
          const deleting = pendingId === item.id;
          return (
            <article
              key={item.id}
              className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)]"
            >
              <button
                type="button"
                onClick={() => openPreview(item)}
                className="relative block aspect-square w-full overflow-hidden text-left"
                aria-label={`Preview ${item.file_name}`}
              >
                {url ? (
                  video ? (
                    <video
                      src={url}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={item.file_name}
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  )
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--muted)]">
                    {video ? (
                      <Video className="h-8 w-8" />
                    ) : (
                      <ImageIcon className="h-8 w-8" />
                    )}
                  </div>
                )}
                {video ? (
                  <span className="absolute bottom-2 left-2 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    Video
                  </span>
                ) : null}
              </button>

              <div className="flex items-start justify-between gap-2 p-2.5">
                <button
                  type="button"
                  onClick={() => openPreview(item)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-xs font-medium text-[var(--foreground)]">
                    {item.file_name}
                  </p>
                  <p className="truncate text-[11px] text-[var(--muted)]">
                    {item.folder_path || "—"}
                  </p>
                </button>
                {canDelete(item) ? (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => handleDelete(item)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-200"
                    aria-label={`Delete ${item.file_name}`}
                    title="Delete upload"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {preview ? (
        <MediaPreviewModal item={preview} onClose={() => setPreview(null)} />
      ) : null}
    </div>
  );
}
