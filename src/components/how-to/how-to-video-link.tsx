"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { HowToVideoDialog } from "@/components/how-to/how-to-video-dialog";
import { howToVideoForPath } from "@/lib/how-to/videos";
import type { Profile } from "@/lib/types/database";

type HowToVideoLinkProps = {
  profile: Pick<Profile, "role" | "departments">;
};

/** "Watch how-to video" link + popup shown on pages that have a video. */
export function HowToVideoLink({ profile }: HowToVideoLinkProps) {
  const pathname = usePathname();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const video = howToVideoForPath(pathname, profile);
  const open = Boolean(video) && openFor === pathname;

  if (!video) return null;

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setOpenFor(pathname)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)] shadow-sm hover:bg-[var(--surface-hover)]"
        >
          <PlayCircle className="h-4 w-4" aria-hidden />
          Watch how-to video
        </button>
      </div>
      {open ? (
        <HowToVideoDialog video={video} onClose={() => setOpenFor(null)} />
      ) : null}
    </>
  );
}
