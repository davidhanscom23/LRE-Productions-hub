"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  deleteResourceAction,
  getFileDownloadUrlAction,
  awardResourceVideoPlayAction,
} from "@/app/(app)/resources/actions";
import { ResourceFormModal } from "@/components/resources/add-resource-modal";
import { ResourceVideoModal } from "@/components/resources/video-modal";
import { getVideoEmbed } from "@/lib/resources/video-embed";
import {
  VISIBILITY_LABELS,
  type Resource,
} from "@/lib/types/resources";

type ResourcesPageClientProps = {
  resources: Resource[];
  canAdd: boolean;
  canManage: boolean;
  canDelete: boolean;
  showHandbook?: boolean;
};

export function ResourcesPageClient({
  resources,
  canAdd,
  canManage,
  canDelete,
  showHandbook = false,
}: ResourcesPageClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [playing, setPlaying] = useState<Resource | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of resources) {
      if (r.category.trim()) set.add(r.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [resources]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (!q) return true;
      const haystack = [r.title, r.category, r.description, r.type]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [resources, category, query]);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(resource: Resource) {
    setEditing(resource);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function handleOpenLink(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleDownload(path: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await getFileDownloadUrlAction(path);
      if (result.error || !result.url) {
        setActionError(result.error ?? "Download failed.");
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  function handleDelete(id: string, title: string) {
    if (!confirm(`Delete “${title}”? This cannot be undone.`)) return;
    setActionError(null);
    startTransition(async () => {
      const result = await deleteResourceAction(id);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Resources
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Shared files and links for the team.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/documents"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          >
            <BookOpen className="h-4 w-4 text-[var(--brand)]" />
            Documents
          </Link>
          {canAdd && (
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add resource
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          {actionError}
        </div>
      )}

      <div className="mt-6 relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search resources…"
          className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pr-3 pl-9 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
          aria-label="Search resources"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip active={category === "all"} onClick={() => setCategory("all")}>
          All
        </Chip>
        {categories.map((c) => (
          <Chip
            key={c}
            active={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 px-6 py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-[var(--muted)]/50" />
          <p className="mt-3 font-medium text-[var(--foreground)]">
            No resources yet
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {canAdd
              ? "Click Add resource to share a link or upload a file."
              : "Nothing matches your search, or nothing has been shared yet."}
          </p>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {filtered.map((resource) => (
            <li
              key={resource.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                  {resource.type === "link" ? (
                    <Link2 className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--foreground)]">
                    {resource.title}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]">
                    {resource.category ? (
                      <span className="rounded-md bg-[var(--background)] px-1.5 py-0.5 text-xs font-medium">
                        {resource.category}
                      </span>
                    ) : (
                      <span className="text-xs">Uncategorized</span>
                    )}
                    <span className="text-xs">
                      {VISIBILITY_LABELS[resource.visibility]}
                    </span>
                    {resource.description && (
                      <span className="truncate">{resource.description}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => openEdit(resource)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    aria-label={`Edit ${resource.title}`}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                ) : null}
                {canDelete && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleDelete(resource.id, resource.title)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-red-600 disabled:opacity-50"
                    aria-label={`Delete ${resource.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                {resource.type === "link" ? (
                  getVideoEmbed(resource.url) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPlaying(resource);
                        void awardResourceVideoPlayAction(resource.id);
                      }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Play
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenLink(resource.url)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleDownload(resource.url)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {playing ? (
        <ResourceVideoModal
          title={playing.title}
          url={playing.url}
          onClose={() => setPlaying(null)}
        />
      ) : null}

      {(canAdd || canManage) && (
        <ResourceFormModal
          key={formOpen ? (editing?.id ?? "new") : "closed"}
          open={formOpen}
          onClose={closeForm}
          categories={categories}
          resource={editing}
        />
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--brand)] text-white"
          : "bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
