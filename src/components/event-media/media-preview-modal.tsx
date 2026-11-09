"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";

export type MediaPreviewItem = {
  id: string;
  file_name: string;
  media_type: string;
  preview_url: string | null;
};

type MediaPreviewModalProps = {
  item: MediaPreviewItem;
  onClose: () => void;
};

function isVideoMedia(mediaType: string) {
  const type = mediaType.toLowerCase();
  return type === "video" || type.startsWith("video/");
}

export function MediaPreviewModal({ item, onClose }: MediaPreviewModalProps) {
  const titleId = useId();
  const video = isVideoMedia(item.media_type);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <h2
            id={titleId}
            className="truncate text-sm font-semibold text-[var(--foreground)]"
          >
            {item.file_name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-black/90 p-3 sm:p-4">
          {item.preview_url ? (
            video ? (
              <video
                key={item.id}
                src={item.preview_url}
                controls
                autoPlay
                playsInline
                className="max-h-[min(78vh,820px)] w-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.preview_url}
                alt={item.file_name}
                className="max-h-[min(78vh,820px)] w-full object-contain"
              />
            )
          ) : (
            <p className="text-sm text-white/80">Preview unavailable.</p>
          )}
        </div>
      </div>
    </div>
  );
}
