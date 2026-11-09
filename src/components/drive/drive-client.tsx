"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUp,
  ExternalLink,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderPlus,
  Home,
  Image as ImageIcon,
  Search,
  Upload,
  Video,
  X,
} from "lucide-react";
import type { DriveItem } from "@/lib/drive/browse";
import {
  createDriveFolderAction,
  uploadToDriveAction,
} from "@/app/(app)/drive/actions";

type Props = {
  mode: "browse" | "search";
  query: string;
  items: DriveItem[];
  folderId: string;
  folderName: string;
  parentId: string | null;
  isRoot: boolean;
  /** Admin-only link to change the Drive root folder. */
  adminSettingsHref?: string | null;
};

function iconFor(item: DriveItem) {
  if (item.isFolder) return Folder;
  const m = item.mimeType;
  if (m.includes("image")) return ImageIcon;
  if (m.includes("video")) return Video;
  if (m.includes("spreadsheet") || m.includes("excel") || m.includes("csv"))
    return FileSpreadsheet;
  if (m.includes("document") || m.includes("pdf") || m.includes("text"))
    return FileText;
  return FileIcon;
}

function formatSize(size: string | null): string {
  if (!size) return "";
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function DriveClientView({
  mode,
  query,
  items,
  folderId,
  folderName,
  parentId,
  isRoot,
  adminSettingsHref = null,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(query);
  const [uploading, startUpload] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [addingFolder, setAddingFolder] = useState(false);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    router.push(q ? `/drive?q=${encodeURIComponent(q)}` : "/drive");
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("folder_id", folderId);
    startUpload(async () => {
      const res = await uploadToDriveAction(fd);
      if (res.error) setUploadError(res.error);
      else router.refresh();
    });
    e.target.value = "";
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
            <Folder className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Google Drive
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Browse, upload, and manage company files
              {adminSettingsHref ? (
                <>
                  {" · "}
                  <Link
                    href={adminSettingsHref}
                    className="text-[var(--brand)] underline-offset-2 hover:underline"
                  >
                    Root folder settings
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAddingFolder(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          >
            <FolderPlus className="h-4 w-4" /> New folder
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload"}
            <input
              type="file"
              onChange={onUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </header>

      <form onSubmit={submitSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search in Drive…"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white hover:opacity-90"
        >
          Search
        </button>
      </form>

      {uploadError ? (
        <p className="text-sm text-red-600">{uploadError}</p>
      ) : null}

      {/* Breadcrumb / context row */}
      {mode === "search" ? (
        <div className="flex items-center justify-between text-sm text-[var(--muted)]">
          <span>
            Results for “{query}” · {items.length}
          </span>
          <Link href="/drive" className="text-[var(--brand)] hover:underline">
            Clear search
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/drive"
            className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <Home className="h-4 w-4" /> Company Drive
          </Link>
          {!isRoot ? (
            <>
              <span className="text-[var(--muted)]">/</span>
              <span className="font-medium text-[var(--foreground)]">
                {folderName}
              </span>
              {parentId ? (
                <Link
                  href={`/drive?folder=${parentId}`}
                  className="ml-2 inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                >
                  <ArrowUp className="h-3.5 w-3.5" /> Up
                </Link>
              ) : null}
            </>
          ) : null}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-6 py-12 text-center text-sm text-[var(--muted)]">
          {mode === "search" ? "No files match your search." : "This folder is empty."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = iconFor(item);
            const inner = (
              <div className="flex h-full items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm transition-colors hover:border-[var(--brand)]/40">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    item.isFolder
                      ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                      : "bg-[var(--surface-hover)] text-[var(--muted)]"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-[var(--foreground)]">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {item.isFolder ? "Folder" : formatSize(item.size) || "File"}
                    {item.modifiedTime
                      ? ` · ${new Date(item.modifiedTime).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                {!item.isFolder && item.webViewLink ? (
                  <ExternalLink className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                ) : null}
              </div>
            );

            if (item.isFolder) {
              return (
                <Link key={item.id} href={`/drive?folder=${item.id}`}>
                  {inner}
                </Link>
              );
            }
            return item.webViewLink ? (
              <a
                key={item.id}
                href={item.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {inner}
              </a>
            ) : (
              <div key={item.id}>{inner}</div>
            );
          })}
        </div>
      )}

      {addingFolder ? (
        <NewFolderModal
          folderId={folderId}
          onClose={() => setAddingFolder(false)}
        />
      ) : null}
    </div>
  );
}

function NewFolderModal({
  folderId,
  onClose,
}: {
  folderId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function create() {
    setError(null);
    startSaving(async () => {
      const res = await createDriveFolderAction({ parentId: folderId, name });
      if (res.error) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            New folder
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Folder name"
          className="mt-4 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          autoFocus
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={create}
            className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
