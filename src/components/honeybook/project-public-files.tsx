"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CRM_FILE_BUCKET,
  CRM_FILE_ITEMS,
  CRM_MAX_FILE_BYTES,
  crmFileItemLabel,
  type CrmFileItemKey,
  type CrmProjectFile,
} from "@/lib/honeybook/file-requests";
import {
  prepareCrmUploadAction,
  registerCrmUploadAction,
  removeCrmUploadAction,
} from "@/app/project/[token]/actions";

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectPublicFiles({
  token,
  files,
}: {
  token: string;
  files: CrmProjectFile[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [itemKey, setItemKey] = useState<CrmFileItemKey>("inspiration");

  function onPick(filesList: FileList | null) {
    if (!filesList?.length) return;
    const list = Array.from(filesList);
    setMessage(null);
    startTransition(async () => {
      const supabase = createClient();
      for (const file of list) {
        if (file.size > CRM_MAX_FILE_BYTES) {
          setMessage(`${file.name} is over 50 MB.`);
          continue;
        }
        const prep = await prepareCrmUploadAction({
          token,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          itemKey,
        });
        if (!prep.ok || !prep.data) {
          setMessage(prep.ok ? "Upload failed." : prep.error);
          continue;
        }
        const { error: upErr } = await supabase.storage
          .from(CRM_FILE_BUCKET)
          .uploadToSignedUrl(prep.data.path, prep.data.uploadToken, file);
        if (upErr) {
          setMessage(`${file.name} did not upload. Please try again.`);
          continue;
        }
        const reg = await registerCrmUploadAction({
          token,
          path: prep.data.path,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          itemKey: prep.data.itemKey,
        });
        if (!reg.ok) {
          setMessage(reg.error);
          continue;
        }
      }
      router.refresh();
    });
  }

  return (
    <section className="mt-8 border-t border-[var(--border)] pt-6">
      <h2 className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
        Share files with us
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Upload references, timelines, and documents. We can see them on your
        project in the Hub.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
          value={itemKey}
          disabled={pending}
          onChange={(e) => setItemKey(e.target.value as CrmFileItemKey)}
        >
          {CRM_FILE_ITEMS.map((i) => (
            <option key={i.key} value={i.key}>
              {i.label}
            </option>
          ))}
        </select>
        <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white hover:opacity-90">
          {pending ? "Uploading…" : "Choose files"}
          <input
            type="file"
            className="sr-only"
            multiple
            disabled={pending}
            onChange={(e) => {
              onPick(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {CRM_FILE_ITEMS.find((i) => i.key === itemKey)?.hint} · Max 50 MB each
      </p>
      {message ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{message}</p>
      ) : null}

      {files.length > 0 ? (
        <ul className="mt-5 space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--foreground)]">
                  {f.file_name}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {crmFileItemLabel(f.item_key)} · {fmtSize(f.size_bytes)}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                className="shrink-0 text-xs text-red-700 hover:underline dark:text-red-300"
                onClick={() => {
                  startTransition(async () => {
                    const r = await removeCrmUploadAction({
                      token,
                      fileId: f.id,
                    });
                    if (!r.ok) setMessage(r.error);
                    else router.refresh();
                  });
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">No files yet.</p>
      )}
    </section>
  );
}
