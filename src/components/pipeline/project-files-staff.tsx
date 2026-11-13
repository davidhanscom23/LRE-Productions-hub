"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  deleteProjectFileAction,
  getProjectFileDownloadUrlAction,
} from "@/app/(app)/pipeline/actions";
import { crmFileItemLabel } from "@/lib/pipeline/file-requests";

type FileRow = {
  id: string;
  item_key: string;
  file_name: string;
  size_bytes: number;
  uploaded_at: string;
};

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectFilesStaff({
  files,
  canEdit,
}: {
  files: FileRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!files.length) return null;

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <p className="text-xs font-medium text-[var(--muted)]">
        Client files ({files.length})
      </p>
      <ul className="mt-2 space-y-1.5">
        {files.map((f) => (
          <li
            key={f.id}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span className="min-w-0 truncate text-[var(--foreground)]">
              {f.file_name}{" "}
              <span className="text-xs text-[var(--muted)]">
                · {crmFileItemLabel(f.item_key)} · {fmtSize(f.size_bytes)}
              </span>
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                className="text-xs font-medium text-[var(--brand)] hover:underline"
                onClick={() => {
                  startTransition(async () => {
                    const r = await getProjectFileDownloadUrlAction({
                      fileId: f.id,
                    });
                    if (r.error) alert(r.error);
                    else if (r.url) window.open(r.url, "_blank", "noopener");
                  });
                }}
              >
                Download
              </button>
              {canEdit ? (
                <button
                  type="button"
                  disabled={pending}
                  className="text-xs text-red-700 hover:underline dark:text-red-300"
                  onClick={() => {
                    if (!confirm(`Delete “${f.file_name}”?`)) return;
                    startTransition(async () => {
                      const r = await deleteProjectFileAction({
                        fileId: f.id,
                      });
                      if (r.error) alert(r.error);
                      else router.refresh();
                    });
                  }}
                >
                  Delete
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
