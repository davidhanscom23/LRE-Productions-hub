"use client";

import { useMemo, useState } from "react";
import {
  ExternalLink,
  Film,
  Image as ImageIcon,
  Megaphone,
  Play,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  getVideoEmbed,
  iframeAllowFor,
} from "@/lib/resources/video-embed";
import {
  MARKETING_VIDEO_CATEGORIES,
  type MarketingLink,
  type MarketingVideo,
} from "@/lib/types/marketing-library";
import {
  createMarketingLinkAction,
  createMarketingVideoAction,
  deleteMarketingLinkAction,
  deleteMarketingVideoAction,
} from "@/app/(app)/marketing-library/actions";

type Props = {
  reviewLinks: MarketingLink[];
  photoLinks: MarketingLink[];
  videos: MarketingVideo[];
  canManage: boolean;
};

export function MarketingLibraryClient({
  reviewLinks,
  photoLinks,
  videos,
  canManage,
}: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [playing, setPlaying] = useState<MarketingVideo | null>(null);
  const [addingVideo, setAddingVideo] = useState(false);
  const [addingLink, setAddingLink] = useState<null | "reviews" | "photos">(null);

  const categories = useMemo(() => {
    const set = new Set<string>(MARKETING_VIDEO_CATEGORIES);
    videos.forEach((v) => v.category && set.add(v.category));
    return ["All", ...Array.from(set)];
  }, [videos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return videos.filter((v) => {
      if (category !== "All" && v.category !== category) return false;
      if (!q) return true;
      const haystack = [
        v.title,
        v.description,
        v.category,
        v.dj_name,
        ...(v.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [videos, query, category]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Megaphone className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Marketing Library
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Review links, photo galleries, and highlight reels
          </p>
        </div>
      </header>

      {/* Reviews */}
      <LinkSection
        icon={<Star className="h-5 w-5" />}
        title="Reviews"
        subtitle="Google review links to share with clients"
        links={reviewLinks}
        canManage={canManage}
        onAdd={() => setAddingLink("reviews")}
      />

      {/* Photo Library */}
      <LinkSection
        icon={<ImageIcon className="h-5 w-5" />}
        title="Photo Library"
        subtitle="Event photos and gallery resources"
        links={photoLinks}
        canManage={canManage}
        onAdd={() => setAddingLink("photos")}
      />

      {/* Video Library */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Video Library
              </h2>
              <p className="text-sm text-[var(--muted)]">
                Marketing, events, and highlight reels
              </p>
            </div>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={() => setAddingVideo(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add video
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search videos, tags, or team members…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => {
              const active = c === category;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    active
                      ? "bg-[var(--brand)] text-white"
                      : "bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)]",
                  ].join(" ")}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--muted)]">
            No videos match your search.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                canManage={canManage}
                onPlay={() => setPlaying(v)}
              />
            ))}
          </div>
        )}
      </section>

      {playing ? (
        <VideoModal video={playing} onClose={() => setPlaying(null)} />
      ) : null}
      {addingVideo ? (
        <AddVideoModal onClose={() => setAddingVideo(false)} />
      ) : null}
      {addingLink ? (
        <AddLinkModal section={addingLink} onClose={() => setAddingLink(null)} />
      ) : null}
    </div>
  );
}

function LinkSection({
  icon,
  title,
  subtitle,
  links,
  canManage,
  onAdd,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  links: MarketingLink[];
  canManage: boolean;
  onAdd: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
            {icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {title}
            </h2>
            <p className="text-sm text-[var(--muted)]">{subtitle}</p>
          </div>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          >
            <Plus className="h-4 w-4" /> Add link
          </button>
        ) : null}
      </div>

      {links.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No links yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {links.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5"
            >
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--brand)] hover:underline"
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                {l.label}
              </a>
              {canManage ? <DeleteLinkButton id={l.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VideoCard({
  video,
  canManage,
  onPlay,
}: {
  video: MarketingVideo;
  canManage: boolean;
  onPlay: () => void;
}) {
  const embeddable = Boolean(getVideoEmbed(video.url));
  return (
    <div className="group flex flex-col rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--brand)]">
          {video.category}
        </span>
        {canManage ? <DeleteVideoButton id={video.id} /> : null}
      </div>
      <button
        type="button"
        onClick={embeddable ? onPlay : undefined}
        className="mt-2 text-left"
      >
        <h3 className="flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
          {embeddable ? (
            <Play className="h-4 w-4 shrink-0 text-[var(--brand)]" />
          ) : null}
          {video.title}
        </h3>
      </button>
      {video.description ? (
        <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
          {video.description}
        </p>
      ) : null}
      {video.dj_name ? (
        <p className="mt-1 text-xs font-medium text-[var(--foreground)]">
          {video.dj_name}
        </p>
      ) : null}
      {video.tags?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {video.tags.slice(0, 6).map((t) => (
            <span
              key={t}
              className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-3">
        {embeddable ? (
          <button
            type="button"
            onClick={onPlay}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
          >
            <Play className="h-4 w-4" /> Play
          </button>
        ) : null}
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ExternalLink className="h-4 w-4" /> Open
        </a>
      </div>
    </div>
  );
}

function VideoModal({
  video,
  onClose,
}: {
  video: MarketingVideo;
  onClose: () => void;
}) {
  const embed = getVideoEmbed(video.url);
  return (
    <ModalShell onClose={onClose} wide>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">
          {video.title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg bg-black">
        {embed && embed.kind === "file" ? (
          <video src={embed.embedUrl} controls className="h-full w-full" />
        ) : embed ? (
          <iframe
            src={embed.embedUrl}
            allow={iframeAllowFor(embed.kind) ?? undefined}
            allowFullScreen
            className="h-full w-full"
          />
        ) : null}
      </div>
    </ModalShell>
  );
}

function AddVideoModal({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(formData: FormData) {
    setSaving(true);
    setError(null);
    const res = await createMarketingVideoAction(formData);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
  }

  return (
    <ModalShell onClose={onClose}>
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
        <Field label="Description" name="description" />
        <Field
          label="Video URL (YouTube, Vimeo, Google Drive, or .mp4)"
          name="url"
          required
        />
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--foreground)]">
            Category
          </span>
          <select
            name="category"
            defaultValue="Wedding"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
          >
            {MARKETING_VIDEO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <Field label="Team member (optional)" name="dj_name" />
        <Field label="Tags (comma-separated)" name="tags" />
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
    </ModalShell>
  );
}

function AddLinkModal({
  section,
  onClose,
}: {
  section: "reviews" | "photos";
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(formData: FormData) {
    setSaving(true);
    setError(null);
    formData.set("section", section);
    const res = await createMarketingLinkAction(formData);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">
          Add {section === "reviews" ? "review" : "photo"} link
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
        <Field label="Label" name="label" required />
        <Field label="URL" name="url" required />
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
            {saving ? "Saving…" : "Add link"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function DeleteVideoButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Delete this video?")) return;
        setBusy(true);
        await deleteMarketingVideoAction(id);
        setBusy(false);
      }}
      className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-red-600 disabled:opacity-50"
      aria-label="Delete video"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function DeleteLinkButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Delete this link?")) return;
        setBusy(true);
        await deleteMarketingLinkAction(id);
        setBusy(false);
      }}
      className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-red-600 disabled:opacity-50"
      aria-label="Delete link"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function Field({
  label,
  name,
  required,
}: {
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-[var(--foreground)]">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <input
        name={name}
        required={required}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
      />
    </label>
  );
}

function ModalShell({
  children,
  onClose,
  wide,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={[
          "w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl",
          wide ? "max-w-3xl" : "max-w-md",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
