"use client";

import { useEffect } from "react";
import { ExternalLink, X } from "lucide-react";
import {
  getVideoEmbed,
  iframeAllowFor,
  type VideoEmbed,
} from "@/lib/resources/video-embed";

type VideoModalProps = {
  title: string;
  url: string;
  onClose: () => void;
};

export function ResourceVideoModal({ title, url, onClose }: VideoModalProps) {
  const embed = getVideoEmbed(url);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--foreground)]/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-[900px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <p className="min-w-0 truncate font-medium text-[var(--foreground)]">
            {title}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              Open original
              <ExternalLink className="h-3 w-3" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {embed ? (
          <Player embed={embed} title={title} />
        ) : (
          <div className="space-y-3 p-6 text-center">
            <p className="text-sm text-[var(--muted)]">
              This video could not be embedded. Open the original instead.
            </p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              <ExternalLink className="h-4 w-4" />
              Open original
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function Player({ embed, title }: { embed: VideoEmbed; title: string }) {
  if (embed.kind === "file") {
    return (
      <div className="aspect-video bg-black">
        <video
          src={embed.embedUrl}
          controls
          playsInline
          className="h-full w-full"
          title={title}
        />
      </div>
    );
  }

  const allow = iframeAllowFor(embed.kind) ?? undefined;
  return (
    <div className="aspect-video bg-black">
      <iframe
        src={embed.embedUrl}
        title={title}
        className="h-full w-full"
        allow={allow}
        allowFullScreen
      />
    </div>
  );
}
