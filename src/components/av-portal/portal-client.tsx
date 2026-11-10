"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, FileText, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  FILE_KEY_LABEL,
  MAX_FILE_BYTES,
  computeStatus,
  parseContact,
  type ItemDef,
  type StoredFileKey,
} from "@/lib/av-portals/items";
import {
  moveFileAction,
  prepareUploadAction,
  registerUploadAction,
  removeFileAction,
  saveValueAction,
} from "@/app/portal/[token]/actions";

const BUCKET = "av-portal-files";

type Show = {
  fileNo: string;
  eventName: string;
  dateLabel: string;
  venue: string;
  loadInTime: string;
  note: string;
  clientName: string;
};
type FileView = { id: string; itemKey: StoredFileKey; fileName: string };

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm";
const btnCls =
  "inline-flex items-center gap-2 rounded-lg bg-[var(--foreground)] px-3 py-2 text-sm font-medium text-[var(--background)] disabled:opacity-50";
const ghostCls =
  "inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium disabled:opacity-50";

export function PortalClient({
  token,
  show,
  values,
  files,
}: {
  token: string;
  show: Show;
  values: Record<string, unknown>;
  files: FileView[];
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const status = computeStatus(
    values,
    files.map((f) => ({ id: f.id, item_key: f.itemKey, file_name: f.fileName })),
  );
  const refresh = () => startRefresh(() => router.refresh());

  async function uploadFiles(list: FileList | File[], target: StoredFileKey | "auto") {
    const picked = Array.from(list);
    if (!picked.length) return;
    setMessage(null);
    const supabase = createClient();
    let okCount = 0;
    for (const file of picked) {
      setBusy(`Uploading ${file.name}…`);
      if (file.size > MAX_FILE_BYTES) {
        setMessage({ kind: "err", text: `${file.name} is over 50 MB. Please send it another way.` });
        continue;
      }
      const prep = await prepareUploadAction({
        token,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        itemKey: target,
      });
      if (!prep.ok || !prep.data) {
        setMessage({ kind: "err", text: prep.ok ? "Upload failed." : prep.error });
        continue;
      }
      const up = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(prep.data.path, prep.data.uploadToken, file);
      if (up.error) {
        setMessage({ kind: "err", text: `${file.name} did not upload. Please try again.` });
        continue;
      }
      const reg = await registerUploadAction({
        token,
        path: prep.data.path,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        itemKey: prep.data.itemKey,
        auto: target === "auto",
      });
      if (!reg.ok) {
        setMessage({ kind: "err", text: reg.error });
        continue;
      }
      okCount += 1;
    }
    setBusy(null);
    if (okCount) {
      setMessage({ kind: "ok", text: `${okCount} file${okCount === 1 ? "" : "s"} received. Thank you!` });
      refresh();
    }
  }

  async function saveValue(itemKey: "headcount" | "day_of_contact" | "load_in", value: unknown) {
    setBusy("Saving…");
    setMessage(null);
    const res = await saveValueAction({ token, itemKey, value });
    setBusy(null);
    if (!res.ok) return setMessage({ kind: "err", text: res.error });
    setMessage({ kind: "ok", text: "Saved. Thank you!" });
    refresh();
  }

  async function removeFile(id: string) {
    setBusy("Removing…");
    const res = await removeFileAction({ token, fileId: id });
    setBusy(null);
    if (!res.ok) return setMessage({ kind: "err", text: res.error });
    refresh();
  }

  async function moveFile(id: string, itemKey: StoredFileKey) {
    const res = await moveFileAction({ token, fileId: id, itemKey });
    if (!res.ok) return setMessage({ kind: "err", text: res.error });
    refresh();
  }

  const otherFiles = files.filter((f) => f.itemKey === "other");

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b-[3px] border-[var(--brand)] bg-black">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-5">
          {/* Header is black in both themes, so the white wordmark is used as-is. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="LRE Productions" className="h-8 w-auto object-contain" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/70">
            Show file <b className="font-normal text-[var(--brand)]">{show.fileNo}</b>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Audiovisual event portal</p>
        <h1 className="mt-2 text-3xl font-semibold uppercase tracking-wide">{show.eventName}</h1>
        <p className="mt-2 text-[var(--muted)]">
          {show.dateLabel}
          {show.venue ? ` · ${show.venue}` : ""}
          {show.loadInTime ? ` · Load-in ${show.loadInTime}` : ""}
        </p>
        {show.note && <p className="mt-4 rounded-lg bg-[var(--brand-soft)] p-3 text-sm">{show.note}</p>}

        <div className="mt-6 flex items-center gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full bg-[var(--brand)] transition-all"
              style={{ width: `${(status.completeCount / status.total) * 100}%` }}
            />
          </div>
          <span className="text-sm font-medium">
            {status.completeCount} of {status.total} received
          </span>
        </div>

        {status.allComplete && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm">
              <b>You&apos;re all set.</b> We have everything we need. You can still add or replace files any time, and
              changes go straight to our team.
            </p>
          </div>
        )}

        {(busy || message) && (
          <p
            role="status"
            className={`mt-4 rounded-lg px-3 py-2 text-sm ${
              busy
                ? "bg-[var(--brand-soft)]"
                : message?.kind === "err"
                  ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"
                  : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
            }`}
          >
            {busy ?? message?.text}
          </p>
        )}

        <ol className="mt-6 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {status.items.map((it, i) => (
            <li key={it.def.key} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2 p-4">
              <span className="pt-0.5 font-mono text-sm text-[var(--brand)]">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{it.def.label}</p>
                  {it.complete ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Received
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      <Circle className="h-3.5 w-3.5" /> Needed
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--muted)]">{it.def.hint}</p>
                {it.complete && it.via === "file" && (
                  <p className="mt-1 text-xs text-[var(--muted)]">Found in {it.fileNames.join(", ")}</p>
                )}

                <ItemInput
                  def={it.def}
                  values={values}
                  disabled={!!busy}
                  onSave={saveValue}
                  onFiles={(list) => uploadFiles(list, it.def.key as StoredFileKey)}
                />

                <ul className="mt-2 space-y-1">
                  {files
                    .filter((f) => f.itemKey === it.def.key)
                    .map((f) => (
                      <FileChip key={f.id} file={f} onRemove={() => removeFile(f.id)} />
                    ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-8 rounded-xl border border-dashed border-[var(--border)] p-5">
          <h2 className="text-lg font-semibold uppercase tracking-wide">Anything else</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Auction slides, a welcome loop, a sponsor list, a site map. Drop it here and we&apos;ll sort it onto the
            right item when we can tell what it is.
          </p>
          <DropZone disabled={!!busy} onFiles={(list) => uploadFiles(list, "auto")} />
          {otherFiles.length > 0 && (
            <ul className="mt-3 space-y-2">
              {otherFiles.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <FileChip file={f} onRemove={() => removeFile(f.id)} />
                  <select
                    aria-label={`Move ${f.fileName} to an item`}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
                    value="other"
                    onChange={(e) => moveFile(f.id, e.target.value as StoredFileKey)}
                  >
                    <option value="other">Keep as extra</option>
                    {(["floor_plan", "run_of_show", "load_in", "presentation"] as const).map((k) => (
                      <option key={k} value={k}>
                        This is the: {FILE_KEY_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-8 text-center text-xs text-[var(--muted)]">
          Questions? Reply to your check-in email or write hello@lreproductions.com. No login needed; keep this
          link handy.
        </p>
      </main>
    </div>
  );
}

function FileChip({ file, onRemove }: { file: FileView; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-lg bg-[var(--brand-soft)] px-2 py-1 text-xs">
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{file.fileName}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${file.fileName}`} className="shrink-0 opacity-70 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function DropZone({ onFiles, disabled }: { onFiles: (f: FileList | File[]) => void; disabled: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onFiles(e.dataTransfer.files);
      }}
      className={`mt-3 flex flex-col items-center gap-2 rounded-lg border border-[var(--border)] p-5 text-center ${over ? "bg-[var(--brand-soft)]" : ""}`}
    >
      <Upload className="h-5 w-5 text-[var(--brand)]" />
      <p className="text-sm">Drag files here, or</p>
      <button type="button" disabled={disabled} className={ghostCls} onClick={() => ref.current?.click()}>
        Choose files
      </button>
      <p className="text-xs text-[var(--muted)]">Up to 50 MB each</p>
      <input
        ref={ref}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ItemInput({
  def,
  values,
  disabled,
  onSave,
  onFiles,
}: {
  def: ItemDef;
  values: Record<string, unknown>;
  disabled: boolean;
  onSave: (k: "headcount" | "day_of_contact" | "load_in", v: unknown) => void;
  onFiles: (f: FileList | File[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const contact = parseContact(values.day_of_contact);
  const [headcount, setHeadcount] = useState(values.headcount ? String(values.headcount) : "");
  const [name, setName] = useState(contact?.name ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [loadIn, setLoadIn] = useState(typeof values.load_in === "string" ? values.load_in : "");

  const fileButton = (
    <>
      <button type="button" disabled={disabled} className={ghostCls} onClick={() => fileRef.current?.click()}>
        <Upload className="h-4 w-4" /> Add file
      </button>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );

  if (def.input === "file") return <div className="mt-3">{fileButton}</div>;

  if (def.input === "number") {
    return (
      <div className="mt-3 flex max-w-xs gap-2">
        <input
          className={inputCls}
          inputMode="numeric"
          placeholder="e.g. 150"
          aria-label="Final headcount"
          value={headcount}
          onChange={(e) => setHeadcount(e.target.value)}
        />
        <button type="button" disabled={disabled || !headcount.trim()} className={btnCls} onClick={() => onSave("headcount", headcount)}>
          Save
        </button>
      </div>
    );
  }

  if (def.input === "contact") {
    return (
      <div className="mt-3 grid max-w-md gap-2 sm:grid-cols-2">
        <input className={inputCls} placeholder="Name" aria-label="Day-of contact name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inputCls} placeholder="Cell number" inputMode="tel" aria-label="Day-of contact cell" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="sm:col-span-2">
          <button type="button" disabled={disabled || !name.trim() || !phone.trim()} className={btnCls} onClick={() => onSave("day_of_contact", { name, phone })}>
            Save contact
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        className={inputCls}
        rows={3}
        placeholder="Dock location, door or elevator access, parking for the crew, arrival window…"
        aria-label="Load-in, dock and parking"
        value={loadIn}
        onChange={(e) => setLoadIn(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled || loadIn.trim().length < 3} className={btnCls} onClick={() => onSave("load_in", loadIn)}>
          Save
        </button>
        {fileButton}
      </div>
    </div>
  );
}
