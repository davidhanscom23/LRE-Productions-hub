"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  createResourceAction,
  updateResourceAction,
} from "@/app/(app)/resources/actions";
import {
  RESOURCE_VISIBILITIES,
  SUGGESTED_CATEGORIES,
  VISIBILITY_LABELS,
  type Resource,
  type ResourceType,
  type ResourceVisibility,
} from "@/lib/types/resources";

type ResourceFormModalProps = {
  open: boolean;
  onClose: () => void;
  categories: string[];
  /** When set, modal edits this resource instead of creating. */
  resource?: Resource | null;
};

export function ResourceFormModal({
  open,
  onClose,
  categories,
  resource = null,
}: ResourceFormModalProps) {
  const router = useRouter();
  const titleId = useId();
  const isEdit = Boolean(resource);
  const [type, setType] = useState<ResourceType>(resource?.type ?? "link");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const categoryOptions = Array.from(
    new Set([...SUGGESTED_CATEGORIES, ...categories]),
  ).sort((a, b) => a.localeCompare(b));

  if (!open) return null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("type", type);

    startTransition(async () => {
      const result = isEdit && resource
        ? await updateResourceAction(resource.id, formData)
        : await createResourceAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

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
              {isEdit ? "Edit resource" : "Add resource"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {isEdit
                ? "Update title, category, visibility, description, or link URL."
                : "Share a link or upload a file for the team."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form key={resource?.id ?? "new"} onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
              {error}
            </div>
          )}

          {!isEdit ? (
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-1">
              <TypeTab active={type === "link"} onClick={() => setType("link")}>
                External link
              </TypeTab>
              <TypeTab active={type === "file"} onClick={() => setType("file")}>
                Upload file
              </TypeTab>
            </div>
          ) : (
            <p className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted)]">
              Type: {type === "link" ? "External link" : "Uploaded file"}
              {type === "file"
                ? " — replace the file by deleting and adding a new resource."
                : ""}
            </p>
          )}

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Title</span>
            <input
              name="title"
              required
              defaultValue={resource?.title ?? ""}
              className={inputClass}
              placeholder="e.g. Venue load-in checklist"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Category</span>
            <input
              name="category"
              list="resource-categories"
              defaultValue={resource?.category ?? ""}
              className={inputClass}
              placeholder="e.g. Guides"
            />
            <datalist id="resource-categories">
              {categoryOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          {type === "link" ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">URL</span>
              <input
                name="url"
                type="url"
                required
                defaultValue={
                  isEdit && resource?.type === "link" ? resource.url : ""
                }
                className={inputClass}
                placeholder="https://"
              />
            </label>
          ) : !isEdit ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">File</span>
              <input
                name="file"
                type="file"
                required
                className="block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand-soft)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--brand)]"
              />
            </label>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Visibility</span>
            <select
              name="visibility"
              defaultValue={
                (resource?.visibility ??
                  "everyone") satisfies ResourceVisibility
              }
              className={inputClass}
            >
              {RESOURCE_VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {VISIBILITY_LABELS[v]}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Description</span>
            <textarea
              name="description"
              rows={3}
              defaultValue={resource?.description ?? ""}
              className={`${inputClass} min-h-20 py-2`}
              placeholder="Optional short note"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add resource"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** @deprecated Use ResourceFormModal — kept as alias for older imports. */
export const AddResourceModal = ResourceFormModal;

function TypeTab({
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
        "rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
          : "text-[var(--muted)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]";
