"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Trash2, Video } from "lucide-react";
import { deleteEventMediaAction } from "@/app/(app)/submit-event-photos/actions";
import {
  MediaPreviewModal,
  type MediaPreviewItem,
} from "@/components/event-media/media-preview-modal";
import {
  eventMediaGroupKey,
  type EventMedia,
} from "@/lib/types/event-media";

type EventMediaGalleryProps = {
  items: EventMedia[];
  currentUserId: string;
  isAdmin: boolean;
};

type EventGroup = {
  key: string;
  event_name: string;
  event_date: string;
  items: EventMedia[];
};

export function EventMediaGallery({
  items,
  currentUserId,
  isAdmin,
}: EventMediaGalleryProps) {
  const groups = useMemo(() => {
    const map = new Map<string, EventGroup>();
    for (const item of items) {
      const key = eventMediaGroupKey(item);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(key, {
          key,
          event_name: item.event_name,
          event_date: item.event_date,
          items: [item],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      b.event_date.localeCompare(a.event_date),
    );
  }, [items]);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 px-6 py-12 text-center">
        <ImageIcon className="mx-auto h-8 w-8 text-[var(--muted)]/50" />
        <p className="mt-3 font-medium text-[var(--foreground)]">
          No event media yet
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Upload photos or videos from an event to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key} className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--foreground)]">
              {group.event_name}
            </h3>
            <p className="text-sm text-[var(--muted)]">
              {formatDate(group.event_date)} · {group.items.length}{" "}
              {group.items.length === 1 ? "file" : "files"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {group.items.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                canDelete={isAdmin || item.uploader_id === currentUserId}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MediaCard({
  item,
  canDelete,
}: {
  item: EventMedia;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<MediaPreviewItem | null>(null);
  const uploader =
    item.uploader?.full_name?.trim() || item.uploader?.email || "Staff";
  const isVideo =
    item.media_type === "video" || item.media_type.startsWith("video/");

  function handleDelete() {
    if (!confirm(`Delete “${item.file_name}”?`)) return;
    startTransition(async () => {
      const result = await deleteEventMediaAction(item.id);
      if (!result.error) router.refresh();
    });
  }

  return (
    <>
      <article className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <button
          type="button"
          onClick={() =>
            setPreview({
              id: item.id,
              file_name: item.file_name,
              media_type: item.media_type,
              preview_url: item.signed_url ?? null,
            })
          }
          className="block w-full text-left"
          aria-label={`Preview ${item.file_name}`}
        >
          <div className="relative aspect-square bg-[var(--background)]">
            {item.signed_url ? (
              isVideo ? (
                <video
                  src={item.signed_url}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumb_url ?? item.signed_url}
                  alt={item.file_name}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                />
              )
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--muted)]">
                {isVideo ? (
                  <Video className="h-8 w-8" />
                ) : (
                  <ImageIcon className="h-8 w-8" />
                )}
              </div>
            )}
            {isVideo ? (
              <span className="absolute bottom-2 left-2 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
                Video
              </span>
            ) : null}
          </div>
          <div className="space-y-0.5 p-3">
            <p className="truncate text-xs font-medium text-[var(--foreground)]">
              {item.file_name}
            </p>
            <p className="truncate text-[11px] text-[var(--muted)]">
              {uploader} · {formatUploadedAt(item.created_at)}
            </p>
          </div>
        </button>
        {canDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={handleDelete}
            className="absolute top-2 right-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white opacity-100 transition-opacity hover:bg-black/70 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
            aria-label={`Delete ${item.file_name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </article>
      {preview ? (
        <MediaPreviewModal item={preview} onClose={() => setPreview(null)} />
      ) : null}
    </>
  );
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatUploadedAt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
