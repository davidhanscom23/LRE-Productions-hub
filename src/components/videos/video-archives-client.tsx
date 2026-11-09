"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Film,
  FolderOpen,
  Play,
  Plus,
  RefreshCw,
  Search,
  Video,
  X,
} from "lucide-react";
import {
  createVideoAction,
  importZoomRecordingsAction,
} from "@/app/(app)/videos/actions";
import type { ArchiveVideoListItem } from "@/lib/types/video-archives";

type Props = {
  videos: ArchiveVideoListItem[];
  canManage: boolean;
};

const ALL = "All";

export function VideoArchivesClient({ videos, canManage }: Props) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);
  const [presenter, setPresenter] = useState<string>(ALL);
  const [tag, setTag] = useState<string>(ALL);
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function importZoom() {
    setImporting(true);
    setImportMsg(null);
    const res = await importZoomRecordingsAction(30);
    setImporting(false);
    if (res.error) {
      setImportMsg(res.error);
      return;
    }
    const r = res.result;
    setImportMsg(
      r
        ? `Imported ${r.imported} new recording${r.imported === 1 ? "" : "s"} (${r.skipped} already there) · ${r.chatLines} chat lines · ${r.assets} shared links.`
        : "Import complete.",
    );
    router.refresh();
  }

  const options = useMemo(() => {
    const years = new Set<string>();
    const cats = new Set<string>();
    const presenters = new Set<string>();
    const tags = new Set<string>();
    for (const v of videos) {
      years.add(String(v.year));
      if (v.category) cats.add(v.category);
      if (v.presenter) presenters.add(v.presenter);
      v.tags.forEach((t) => tags.add(t));
      v.topics.forEach((t) => tags.add(t));
    }
    return {
      years: [ALL, ...Array.from(years).sort((a, b) => Number(b) - Number(a))],
      cats: [ALL, ...Array.from(cats).sort()],
      presenters: [ALL, ...Array.from(presenters).sort()],
      tags: [ALL, ...Array.from(tags).sort()],
    };
  }, [videos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return videos.filter((v) => {
      if (year !== ALL && String(v.year) !== year) return false;
      if (category !== ALL && v.category !== category) return false;
      if (presenter !== ALL && v.presenter !== presenter) return false;
      if (tag !== ALL && !v.tags.includes(tag) && !v.topics.includes(tag))
        return false;
      if (q) {
        const hay = [v.title, v.description, v.presenter, ...v.tags, ...v.topics]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [videos, query, year, category, presenter, tag]);

  // Group by year -> category.
  const grouped = useMemo(() => {
    const byYear = new Map<number, Map<string, ArchiveVideoListItem[]>>();
    for (const v of filtered) {
      const cats = byYear.get(v.year) ?? new Map<string, ArchiveVideoListItem[]>();
      const list = cats.get(v.category) ?? [];
      list.push(v);
      cats.set(v.category, list);
      byYear.set(v.year, cats);
    }
    return [...byYear.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([yr, cats]) => ({
        year: yr,
        categories: [...cats.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      }));
  }, [filtered]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Video Archives
            </h1>
            <p className="text-sm text-[var(--muted)]">
              {videos.length} video{videos.length === 1 ? "" : "s"} · training,
              meetings, and recordings
            </p>
          </div>
        </div>
        {canManage ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={importZoom}
              disabled={importing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-60"
              title="Import recent Zoom cloud recordings"
            >
              <RefreshCw className={`h-4 w-4 ${importing ? "animate-spin" : ""}`} />
              {importing ? "Importing…" : "Import from Zoom"}
            </button>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add video
            </button>
          </div>
        ) : null}
      </header>

      {importMsg ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--foreground)]">
          {importMsg}
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, description, or tag…"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Filter label="Year" allLabel="All years" value={year} onChange={setYear} options={options.years} />
          <Filter label="Category" allLabel="All categories" value={category} onChange={setCategory} options={options.cats} />
          <Filter label="Presenter" allLabel="All presenters" value={presenter} onChange={setPresenter} options={options.presenters} />
          <Filter label="Tag / Topic" allLabel={"All tags & topics"} value={tag} onChange={setTag} options={options.tags} />
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-12 text-center text-sm text-[var(--muted)]">
          No videos match your filters.
        </p>
      ) : (
        grouped.map((yg) => (
          <section key={yg.year} className="space-y-4">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              {yg.year}
            </h2>
            {yg.categories.map(([cat, list]) => (
              <div key={cat} className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                  <FolderOpen className="h-4 w-4 text-[var(--brand)]" />
                  {cat}
                  <span className="rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
                    {list.length}
                  </span>
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((v) => (
                    <VideoCard key={v.id} video={v} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))
      )}

      {adding ? <AddVideoModal onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

function Filter({
  label,
  allLabel,
  value,
  onChange,
  options,
}: {
  label: string;
  allLabel: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block text-sm">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 text-sm text-[var(--foreground)]"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "All" ? allLabel : o}
          </option>
        ))}
      </select>
    </label>
  );
}

function VideoCard({ video }: { video: ArchiveVideoListItem }) {
  return (
    <Link
      href={`/videos/${video.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm hover:border-[var(--brand)]/40"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-[var(--surface-hover)]">
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--muted)]">
            <Film className="h-8 w-8" />
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white">
            <Play className="h-5 w-5" />
          </span>
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h4 className="line-clamp-2 text-sm font-semibold text-[var(--foreground)]">
          {video.title}
        </h4>
        {video.presenter ? (
          <p className="mt-0.5 text-xs text-[var(--muted)]">{video.presenter}</p>
        ) : null}
        {video.tags.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {video.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function AddVideoModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(formData: FormData) {
    setSaving(true);
    setError(null);
    const res = await createVideoAction(formData);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
    if (res.id) router.push(`/videos/${res.id}`);
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            Add video
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form action={submit} className="mt-4 space-y-3">
          <Field label="Title" name="title" required />
          <Field label="Description" name="description" textarea />
          <Field
            label="Video URL (YouTube, Vimeo, Drive, .mp4, or Zoom share link)"
            name="video_url"
            required
          />
          <Field label="Thumbnail image URL (optional)" name="thumbnail_url" />
          <div className="flex flex-wrap gap-2">
            <Field label="Category" name="category" defaultValue="Zoom Meetings" />
            <Field
              label="Year"
              name="year"
              defaultValue={String(new Date().getFullYear())}
            />
          </div>
          <Field label="Presenter" name="presenter" />
          <Field label="Topics (comma-separated)" name="topics" />
          <Field label="Tags (comma-separated)" name="tags" />
          <Field
            label="Zoom recording ID (optional)"
            name="zoom_recording_id"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Add video"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  required,
  textarea,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  textarea?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block flex-1 text-sm">
      <span className="mb-1 block font-medium text-[var(--foreground)]">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {textarea ? (
        <textarea
          name={name}
          rows={2}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
        />
      ) : (
        <input
          name={name}
          required={required}
          defaultValue={defaultValue}
          className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
        />
      )}
    </label>
  );
}
