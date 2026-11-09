"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { howToVideoSrc, type HowToVideo } from "@/lib/how-to/videos";

/** Popup player for a how-to video (shared by the page link and the Tools page). */
export function HowToVideoDialog({
  video,
  onClose,
}: {
  video: HowToVideo;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${video.title} how-to video`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {video.title} — how-to
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            aria-label="Close video"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <video
          key={video.slug}
          src={video.v ? `${howToVideoSrc(video)}?v=${video.v}` : howToVideoSrc(video)}
          controls
          autoPlay
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black"
        />
      </div>
    </div>
  );
}
