"use client";

import { FormEvent, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  upsertDepartmentLinkAction,
  upsertDepartmentVideoAction,
} from "@/app/(app)/teams/actions";
import type {
  DepartmentLink,
  DepartmentVideo,
  TeamDepartment,
} from "@/lib/types/teams";

const inputClass =
  "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]";

type LinkModalProps = {
  open: boolean;
  department: TeamDepartment;
  link: DepartmentLink | null;
  onClose: () => void;
};

export function LinkFormModal({
  open,
  department,
  link,
  onClose,
}: LinkModalProps) {
  const router = useRouter();
  const titleId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(link?.title ?? "");
  const [url, setUrl] = useState(link?.url ?? "");
  const [description, setDescription] = useState(link?.description ?? "");

  if (!open) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await upsertDepartmentLinkAction({
        id: link?.id,
        department,
        title,
        url,
        description,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <ModalShell
      titleId={titleId}
      title={link ? "Edit link" : "Add link"}
      description="Share a useful department link."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBox message={error} />}
        <Field label="Title">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="URL">
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={inputClass}
            placeholder="https://"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${inputClass} min-h-20 py-2`}
          />
        </Field>
        <ModalActions
          pending={pending}
          onClose={onClose}
          submitLabel={link ? "Save" : "Add link"}
        />
      </form>
    </ModalShell>
  );
}

type VideoModalProps = {
  open: boolean;
  department: TeamDepartment;
  video: DepartmentVideo | null;
  categories: string[];
  onClose: () => void;
};

export function VideoFormModal({
  open,
  department,
  video,
  categories,
  onClose,
}: VideoModalProps) {
  const router = useRouter();
  const titleId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(video?.title ?? "");
  const [description, setDescription] = useState(video?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(video?.video_url ?? "");
  const [category, setCategory] = useState(video?.category ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(video?.thumbnail_url ?? "");

  if (!open) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await upsertDepartmentVideoAction({
        id: video?.id,
        department,
        title,
        description,
        video_url: videoUrl,
        category,
        thumbnail_url: thumbnailUrl,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <ModalShell
      titleId={titleId}
      title={video ? "Edit video" : "Add video"}
      description="Add a tutorial or how-to video for this department."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBox message={error} />}
        <Field label="Title">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Video URL">
          <input
            required
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className={inputClass}
            placeholder="https://youtube.com/..."
          />
        </Field>
        <Field label="Category">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="team-video-categories"
            className={inputClass}
            placeholder="e.g. Setup, Software"
          />
          <datalist id="team-video-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Thumbnail URL (optional)">
          <input
            type="url"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            className={inputClass}
            placeholder="Auto for YouTube if blank"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${inputClass} min-h-20 py-2`}
          />
        </Field>
        <ModalActions
          pending={pending}
          onClose={onClose}
          submitLabel={video ? "Save" : "Add video"}
        />
      </form>
    </ModalShell>
  );
}

function ModalShell({
  titleId,
  title,
  description,
  onClose,
  children,
}: {
  titleId: string;
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--foreground)]/30 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold text-[var(--foreground)]"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-[var(--foreground)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function ModalActions({
  pending,
  onClose,
  submitLabel,
}: {
  pending: boolean;
  onClose: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={onClose}
        className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)]"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
      {message}
    </div>
  );
}
