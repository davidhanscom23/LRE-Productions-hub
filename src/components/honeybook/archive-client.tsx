"use client";

import { createArchiveUpload, registerArchiveDocument } from "@/app/(app)/honeybook/archive-actions";
import { guessKind, matchProject, type ArchiveKind, type MatchProject } from "@/lib/honeybook/archive-match";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

type Item = {
  key: string;
  file: File;
  projectId: string;
  kind: ArchiveKind;
  confident: boolean;
  status: "ready" | "uploading" | "done" | "error";
  message: string;
};

const input = "rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm";

export function ArchiveClient({ projects }: { projects: MatchProject[] }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Item[] = Array.from(files).map((file, i) => {
      const m = matchProject(file.name, projects);
      return {
        key: `${file.name}-${file.size}-${Date.now()}-${i}`,
        file,
        projectId: m?.projectId ?? "",
        kind: guessKind(file.name),
        confident: Boolean(m?.confident),
        status: "ready",
        message: "",
      };
    });
    setItems((cur) => [...cur, ...next]);
  };

  const patch = (key: string, p: Partial<Item>) => setItems((cur) => cur.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const uploadAll = async () => {
    setBusy(true);
    const supabase = createClient();
    for (const it of items) {
      if (it.status === "done" || !it.projectId) continue;
      patch(it.key, { status: "uploading", message: "" });
      try {
        const up = await createArchiveUpload({ projectId: it.projectId, fileName: it.file.name });
        if (up.error !== null) throw new Error(up.error);
        const { error } = await supabase.storage
          .from("honeybook-archive")
          .uploadToSignedUrl(up.path, up.token, it.file, { contentType: it.file.type || "application/octet-stream", cacheControl: "31536000" });
        if (error) throw new Error(error.message);
        const reg = await registerArchiveDocument({ projectId: it.projectId, kind: it.kind, path: up.path, fileName: it.file.name, sizeBytes: it.file.size });
        if (reg.error) throw new Error(reg.error);
        patch(it.key, { status: "done", message: "Filed" });
      } catch (e) {
        patch(it.key, { status: "error", message: e instanceof Error ? e.message : "Upload failed" });
      }
    }
    setBusy(false);
  };

  const pending = items.filter((i) => i.status !== "done");
  const missing = pending.filter((i) => !i.projectId).length;

  return (
    <div className="mt-4 space-y-3">
      <label className="block rounded-xl border border-dashed border-[var(--border)] p-4 text-center text-sm">
        <span className="font-medium">Choose files</span> <span className="text-[var(--muted)]">(PDFs, images, Word, Excel; up to 12 MB each)</span>
        <input type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </label>

      {items.length > 0 ? (
        <>
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.key} className="rounded-xl border border-[var(--border)] p-3 text-sm">
                <p className="truncate font-medium">{it.file.name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select className={`${input} min-w-0 flex-1`} value={it.projectId} disabled={it.status === "done"} onChange={(e) => patch(it.key, { projectId: e.target.value, confident: true })} aria-label="Project">
                    <option value="">Choose a project…</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.clientName ? ` — ${p.clientName}` : ""}</option>)}
                  </select>
                  <select className={input} value={it.kind} disabled={it.status === "done"} onChange={(e) => patch(it.key, { kind: e.target.value as ArchiveKind })} aria-label="Document type">
                    <option value="contract">Contract</option>
                    <option value="invoice">Invoice</option>
                    <option value="proposal">Proposal</option>
                    <option value="other">Other</option>
                  </select>
                  <button type="button" className="text-xs text-[var(--muted)] underline" disabled={busy || it.status === "uploading"} onClick={() => setItems((cur) => cur.filter((x) => x.key !== it.key))}>Remove</button>
                </div>
                <p className={`mt-1 text-xs ${it.status === "error" ? "text-red-600" : it.status === "done" ? "text-green-700" : it.projectId && !it.confident ? "text-amber-700" : "text-[var(--muted)]"}`}>
                  {it.status === "uploading" ? "Uploading…" : it.message || (!it.projectId ? "No match found. Choose the project." : it.confident ? "Matched from the file name." : "Best guess. Please check it.")}
                </p>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="rounded-lg bg-[var(--accent,#2563eb)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40" disabled={busy || pending.length === 0 || missing > 0} onClick={uploadAll}>
              {busy ? "Uploading…" : `Upload ${pending.length} file${pending.length === 1 ? "" : "s"}`}
            </button>
            {missing > 0 ? <span className="text-xs text-amber-700">{missing} still need a project.</span> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
