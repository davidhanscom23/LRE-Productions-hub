"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completeHowToLessonAction } from "@/app/(app)/training-portal/actions";

/** Share of the video that must actually play before the lesson counts. */
export const HOW_TO_REQUIRED_FRACTION = 0.9;

type HowToLessonPlayerProps = {
  lessonId: string;
  courseSlug: string;
  src: string;
  done: boolean;
  readOnly?: boolean;
};

/**
 * Plays a how-to video and counts only real played time: seeking ahead adds
 * nothing, and speed is locked to 1x. At 90% watched the lesson completes
 * (5 points once per lesson; 100-point bonus when every video is done).
 */
export function HowToLessonPlayer({
  lessonId,
  courseSlug,
  src,
  done,
  readOnly = false,
}: HowToLessonPlayerProps) {
  const router = useRouter();
  const ref = useRef<HTMLVideoElement>(null);
  const watched = useRef(0);
  const last = useRef<number | null>(null);
  const sent = useRef(done);
  const [percent, setPercent] = useState(done ? 100 : 0);
  const [error, setError] = useState<string | null>(null);

  function onTimeUpdate() {
    const video = ref.current;
    if (!video || !video.duration || video.seeking) return;
    const now = video.currentTime;
    if (last.current !== null) {
      const delta = now - last.current;
      if (delta > 0 && delta <= 1.25) watched.current += delta;
    }
    last.current = now;
    const pct = Math.min(
      100,
      Math.round((watched.current / video.duration) * 100),
    );
    setPercent((prev) => (done ? 100 : Math.max(prev, pct)));
    if (
      !sent.current &&
      !readOnly &&
      watched.current >= video.duration * HOW_TO_REQUIRED_FRACTION
    ) {
      sent.current = true;
      void completeHowToLessonAction(lessonId, courseSlug).then((result) => {
        if (result.error) {
          sent.current = false;
          setError(result.error);
          return;
        }
        router.refresh();
      });
    }
  }

  return (
    <div className="space-y-2">
      <video
        ref={ref}
        src={src}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full rounded-xl bg-black"
        onTimeUpdate={onTimeUpdate}
        onPlay={() => {
          last.current = ref.current?.currentTime ?? null;
        }}
        onSeeking={() => {
          last.current = null;
        }}
        onSeeked={() => {
          last.current = ref.current?.currentTime ?? null;
        }}
        onRateChange={() => {
          if (ref.current && ref.current.playbackRate !== 1) {
            ref.current.playbackRate = 1;
          }
        }}
      />
      <p className="text-xs text-[var(--muted)]">
        {done
          ? "Watched — this lesson is complete."
          : readOnly
            ? "Guest access is read-only — progress isn’t saved."
            : `Watch at least 90% to complete this lesson (${percent}% so far). Skipping ahead doesn’t count.`}
      </p>
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
