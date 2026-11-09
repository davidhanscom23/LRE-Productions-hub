"use client";

import { useState } from "react";
import {
  listThumbBackfillCandidatesAction,
  uploadThumbBackfillAction,
  type ThumbBackfillCandidate,
} from "@/app/(app)/event-media/thumb-backfill-actions";
import { makeThumbnailFile } from "@/lib/media/optimize-image";

type Phase = "idle" | "scanning" | "ready" | "running" | "done";

export function ThumbnailBackfill() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [candidates, setCandidates] = useState<ThumbBackfillCandidate[]>([]);
  const [totalImages, setTotalImages] = useState(0);
  const [progress, setProgress] = useState({ done: 0, failed: 0 });
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);

  async function scan() {
    setPhase("scanning");
    setError(null);
    const result = await listThumbBackfillCandidatesAction();
    if (result.error) {
      setError(result.error);
      setPhase("idle");
      return;
    }
    setCandidates(result.candidates);
    setTotalImages(result.total_images);
    setPhase(result.candidates.length === 0 ? "done" : "ready");
  }

  async function run() {
    setPhase("running");
    setProgress({ done: 0, failed: 0 });
    const failed: string[] = [];
    let done = 0;

    for (const item of candidates) {
      try {
        const response = await fetch(item.signed_url);
        if (!response.ok) throw new Error(`Download failed (${response.status}).`);
        const blob = await response.blob();
        const file = new File([blob], item.file_name, {
          type: blob.type || "image/jpeg",
        });
        const thumb = await makeThumbnailFile(file);
        if (!thumb) throw new Error("Could not render a thumbnail.");
        const formData = new FormData();
        formData.set("storage_path", item.storage_path);
        formData.set("file", thumb);
        const upload = await uploadThumbBackfillAction(formData);
        if (upload.error) throw new Error(upload.error);
        done += 1;
      } catch (err) {
        failed.push(
          `${item.file_name}: ${err instanceof Error ? err.message : "failed"}`,
        );
      }
      setProgress({ done, failed: failed.length });
    }

    setFailures(failed);
    setPhase("done");
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      ) : null}

      {phase === "idle" || phase === "scanning" ? (
        <button
          type="button"
          onClick={scan}
          disabled={phase === "scanning"}
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {phase === "scanning" ? "Scanning…" : "Scan for missing thumbnails"}
        </button>
      ) : null}

      {phase === "ready" ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--foreground)]">
            {candidates.length} of {totalImages} photos need thumbnails.
          </p>
          <button
            type="button"
            onClick={run}
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
          >
            Generate {candidates.length} thumbnails
          </button>
        </div>
      ) : null}

      {phase === "running" ? (
        <p className="text-sm text-[var(--foreground)]">
          Working… {progress.done + progress.failed} / {candidates.length}
          {progress.failed > 0 ? ` (${progress.failed} failed)` : ""}
        </p>
      ) : null}

      {phase === "done" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            {candidates.length === 0
              ? `All ${totalImages} photos already have thumbnails.`
              : `Done — ${progress.done} thumbnails created${
                  progress.failed > 0 ? `, ${progress.failed} failed` : ""
                }.`}
          </p>
          {failures.length > 0 ? (
            <ul className="list-disc pl-5 text-xs text-[var(--muted)]">
              {failures.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
