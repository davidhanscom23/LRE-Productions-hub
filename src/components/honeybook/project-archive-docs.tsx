"use client";

import { deleteArchiveDocument, getArchiveDownloadUrl } from "@/app/(app)/honeybook/archive-actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type ArchiveDocItem = { id: string; kind: string; fileName: string; sizeBytes: number; createdAt: string };

const KIND_LABEL: Record<string, string> = { contract: "Contract", invoice: "Invoice", proposal: "Proposal", other: "Document" };
const btn = "rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs font-medium disabled:opacity-40";

export function ProjectArchiveDocs({ docs, canManage }: { docs: ArchiveDocItem[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!docs.length) return null;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">Archived HoneyBook documents</h2>
      {error ? <p className="mt-2 text-sm text-red-600" role="alert">{error}</p> : null}
      <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
        {docs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="min-w-0 truncate">
              {d.fileName} <span className="text-xs text-[var(--muted)]">· {KIND_LABEL[d.kind] ?? "Document"} · {(d.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className={btn}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await getArchiveDownloadUrl(d.id);
                    if (r.error !== null) setError(r.error);
                    else window.open(r.url, "_blank", "noopener");
                  })
                }
              >
                Open
              </button>
              {canManage ? (
                <button
                  type="button"
                  className={btn}
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Remove “${d.fileName}” from the archive? This can’t be undone.`)) return;
                    start(async () => {
                      const r = await deleteArchiveDocument(d.id);
                      if (r.error) setError(r.error);
                      else router.refresh();
                    });
                  }}
                >
                  Remove
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
