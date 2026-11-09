"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createForm } from "@/app/(app)/inquiry-forms/actions";
import { useModalFocus } from "./list-modal-focus";
import { ModalPortal } from "./modal-portal";
import { cls, Notice } from "./list-ui";

export interface BrandOption {
  key: string;
  name: string;
  accentColor: string;
}

/**
 * "New form" dialog: a name and a brand. Mount it only while open (state resets on every open).
 * Closes with X, Cancel or Escape; a click outside does nothing (it holds typed input).
 */
export function NewFormDialog(props: { brands: BrandOption[]; defaultBrand: string; onClose: () => void }) {
  // Under <body>, so the hub's skin art never paints over the dialog.
  return (
    <ModalPortal>
      <NewFormPanel {...props} />
    </ModalPortal>
  );
}

function NewFormPanel({
  brands,
  defaultBrand,
  onClose,
}: {
  brands: BrandOption[];
  defaultBrand: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const nameId = useId();
  const brandId = useId();
  const errorId = useId();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState(
    brands.some((b) => b.key === defaultBrand) ? defaultBrand : (brands[0]?.key ?? ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useModalFocus(true, panelRef, () => {
    if (!pending) onClose();
  }, nameRef);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!name.trim()) {
      setError("Give the form a name.");
      nameRef.current?.focus();
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await createForm({ name, brand });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push(`/inquiry-forms/${res.id}`);
      } catch {
        setError("Could not reach the Hub. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      {/* Backdrop is visual only: an outside click must not close a dialog with typed input. */}
      <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] backdrop-blur-md p-5 shadow-xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-[var(--foreground)]">
              New form
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              It starts as a draft with a contact step. Nothing is public until you publish it.
            </p>
          </div>
          <button type="button" className={cls.iconBtn} onClick={onClose} aria-label="Close" disabled={pending}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <label htmlFor={nameId} className={cls.label}>
              Form name
            </label>
            <input
              ref={nameRef}
              id={nameId}
              type="text"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wedding inquiry"
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={`${cls.input} mt-1 ${error ? cls.inputInvalid : ""}`}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">Staff see this name. Visitors see the step titles.</p>
          </div>

          <div>
            <label htmlFor={brandId} className={cls.label}>
              Brand
            </label>
            <select
              id={brandId}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className={`${cls.select} mt-1`}
            >
              {brands.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--muted)]">Sets the logo, accent color and contact details on the form.</p>
          </div>

          {error ? (
            <div id={errorId}>
              <Notice tone="bad">{error}</Notice>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button type="button" className={cls.btnSecondary} onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className={cls.btnPrimary} disabled={pending} aria-busy={pending}>
              {pending ? "Creating the form..." : "Create form"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
