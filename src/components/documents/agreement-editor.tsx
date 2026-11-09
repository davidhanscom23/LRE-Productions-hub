"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  saveAgreementContentAction,
  setAgreementDraftAction,
} from "@/app/(app)/documents/actions";
import type { HandbookBlock } from "@/lib/handbook/content";
import {
  DOCUMENT_ICON_NAMES,
  type AgreementContent,
  type DocumentIconName,
  type DocumentSection,
} from "@/lib/documents/types";

type AgreementEditorProps = {
  documentKey: string;
  initialContent: AgreementContent;
  isDraft: boolean;
  onCancel: () => void;
  onSaved: (content: AgreementContent, isDraft: boolean) => void;
};

function emptyBlock(): HandbookBlock {
  return { heading: "", paragraphs: [], items: [""], footnote: "" };
}

function emptySection(): DocumentSection {
  return {
    id: `section-${Date.now()}`,
    icon: "FileText",
    title: "New section",
    blocks: [emptyBlock()],
  };
}

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(value: string[] | undefined): string {
  return (value ?? []).join("\n");
}

function paragraphsToText(value: string[] | undefined): string {
  return (value ?? []).join("\n\n");
}

function textToParagraphs(value: string): string[] {
  return value
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function AgreementEditor({
  documentKey,
  initialContent,
  isDraft,
  onCancel,
  onSaved,
}: AgreementEditorProps) {
  const [draft, setDraft] = useState(() =>
    structuredClone(initialContent) as AgreementContent,
  );
  const [draftFlag, setDraftFlag] = useState(isDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateMeta<K extends keyof AgreementContent>(
    key: K,
    value: AgreementContent[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function updateSection(index: number, next: DocumentSection) {
    setDraft((prev) => {
      const sections = [...prev.sections];
      sections[index] = next;
      return { ...prev, sections };
    });
  }

  function moveSection(index: number, direction: -1 | 1) {
    setDraft((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.sections.length) return prev;
      const sections = [...prev.sections];
      const [item] = sections.splice(index, 1);
      sections.splice(target, 0, item);
      return { ...prev, sections };
    });
  }

  function save() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveAgreementContentAction(documentKey, draft, draftFlag);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Document saved.");
      onSaved(draft, draftFlag);
    });
  }

  function setPublished(nextDraft: boolean) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const saveResult = await saveAgreementContentAction(documentKey, draft, nextDraft);
      if (saveResult.error) {
        setError(saveResult.error);
        return;
      }
      const publishResult = await setAgreementDraftAction(documentKey, nextDraft);
      if (publishResult.error) {
        setError(publishResult.error);
        return;
      }
      setDraftFlag(nextDraft);
      setMessage(
        nextDraft
          ? "Saved as draft. Only admins can see this document."
          : "Published. All staff can see this document.",
      );
      onSaved(draft, nextDraft);
    });
  }

  return (
    <div className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Edit document
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Update copy below, then Save. Publish when it is ready for all staff.
            While draft, only admins can open this document.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          >
            Done
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save updates"}
          </button>
          {draftFlag ? (
            <button
              type="button"
              onClick={() => setPublished(false)}
              disabled={pending}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"
            >
              Publish for all staff
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPublished(true)}
              disabled={pending}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
            >
              Return to draft
            </button>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-[var(--foreground)]">
            Title
          </span>
          <input
            value={draft.title}
            onChange={(event) => updateMeta("title", event.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-[var(--foreground)]">
            Subtitle
          </span>
          <input
            value={draft.subtitle}
            onChange={(event) => updateMeta("subtitle", event.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-[var(--foreground)]">
            Introduction (blank line between paragraphs)
          </span>
          <textarea
            value={paragraphsToText(draft.introduction)}
            onChange={(event) =>
              updateMeta("introduction", textToParagraphs(event.target.value))
            }
            rows={8}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-[var(--foreground)]">
            Acknowledgment statement
          </span>
          <textarea
            value={draft.acknowledgment}
            onChange={(event) =>
              updateMeta("acknowledgment", event.target.value)
            }
            rows={3}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-[var(--foreground)]">
            Sign button label
          </span>
          <input
            value={draft.signButtonLabel}
            onChange={(event) =>
              updateMeta("signButtonLabel", event.target.value)
            }
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--foreground)]">
            Company line
          </span>
          <input
            value={draft.companyLine}
            onChange={(event) => updateMeta("companyLine", event.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--foreground)]">
            Owner / contact line
          </span>
          <input
            value={draft.ownerLine}
            onChange={(event) => updateMeta("ownerLine", event.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Sections
          </h3>
          <button
            type="button"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                sections: [...prev.sections, emptySection()],
              }))
            }
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-hover)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add section
          </button>
        </div>

        {draft.sections.map((section, sectionIndex) => (
          <div
            key={`${section.id}-${sectionIndex}`}
            className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={section.title}
                onChange={(event) =>
                  updateSection(sectionIndex, {
                    ...section,
                    title: event.target.value,
                  })
                }
                className="min-w-[12rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium"
                placeholder="Section title"
              />
              <select
                value={section.icon}
                onChange={(event) =>
                  updateSection(sectionIndex, {
                    ...section,
                    icon: event.target.value as DocumentIconName,
                  })
                }
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
              >
                {DOCUMENT_ICON_NAMES.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Move section up"
                onClick={() => moveSection(sectionIndex, -1)}
                className="rounded-lg border border-[var(--border)] p-1.5 hover:bg-[var(--surface-hover)]"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Move section down"
                onClick={() => moveSection(sectionIndex, 1)}
                className="rounded-lg border border-[var(--border)] p-1.5 hover:bg-[var(--surface-hover)]"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Remove section"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    sections: prev.sections.filter((_, i) => i !== sectionIndex),
                  }))
                }
                className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {section.blocks.map((block, blockIndex) => (
              <div
                key={blockIndex}
                className="space-y-2 rounded-md border border-dashed border-[var(--border)] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Block {blockIndex + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const blocks = section.blocks.filter(
                        (_, i) => i !== blockIndex,
                      );
                      updateSection(sectionIndex, { ...section, blocks });
                    }}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove block
                  </button>
                </div>
                <input
                  value={block.heading ?? ""}
                  onChange={(event) => {
                    const blocks = [...section.blocks];
                    blocks[blockIndex] = {
                      ...block,
                      heading: event.target.value,
                    };
                    updateSection(sectionIndex, { ...section, blocks });
                  }}
                  placeholder="Heading (optional)"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
                />
                <textarea
                  value={paragraphsToText(block.paragraphs)}
                  onChange={(event) => {
                    const blocks = [...section.blocks];
                    blocks[blockIndex] = {
                      ...block,
                      paragraphs: textToParagraphs(event.target.value),
                    };
                    updateSection(sectionIndex, { ...section, blocks });
                  }}
                  placeholder="Paragraphs (blank line between)"
                  rows={3}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
                />
                <textarea
                  value={listToLines(block.items)}
                  onChange={(event) => {
                    const blocks = [...section.blocks];
                    blocks[blockIndex] = {
                      ...block,
                      items: linesToList(event.target.value),
                    };
                    updateSection(sectionIndex, { ...section, blocks });
                  }}
                  placeholder="Bullet items (one per line). Use **bold** for emphasis."
                  rows={4}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
                />
                <input
                  value={block.footnote ?? ""}
                  onChange={(event) => {
                    const blocks = [...section.blocks];
                    blocks[blockIndex] = {
                      ...block,
                      footnote: event.target.value,
                    };
                    updateSection(sectionIndex, { ...section, blocks });
                  }}
                  placeholder="Footnote (optional)"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                updateSection(sectionIndex, {
                  ...section,
                  blocks: [...section.blocks, emptyBlock()],
                })
              }
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Add block
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {pending ? "Saving…" : "Save updates"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--surface-hover)]"
        >
          Done editing
        </button>
      </div>
    </div>
  );
}
