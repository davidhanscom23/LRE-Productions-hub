"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Palette, X } from "lucide-react";
import { updateProfileColorAction } from "@/app/(app)/people/actions";
import {
  normalizeHexColor,
  type StaffColorEntry,
} from "@/lib/people/color";

type TeamColorsLegendProps = {
  staff: StaffColorEntry[];
  isAdmin: boolean;
};

function TeamColorRow({
  person,
  isAdmin,
  onEdit,
}: {
  person: StaffColorEntry;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  const name = person.full_name?.trim() || person.email;
  const hex = normalizeHexColor(person.color);
  const row = (
    <span className="flex min-w-0 items-center gap-2.5 px-3 py-1.5 text-sm text-[var(--foreground)]/85">
      <span
        className="h-3 w-3 shrink-0 rounded-full border border-[var(--border)]"
        style={{
          backgroundColor: hex ?? "var(--muted)",
          opacity: hex ? 1 : 0.35,
        }}
        aria-hidden
      />
      <span className="truncate leading-snug">{name}</span>
    </span>
  );

  return (
    <li>
      {isAdmin ? (
        <button
          type="button"
          onClick={onEdit}
          className="flex w-full rounded-lg text-left transition-colors hover:bg-[var(--surface-hover)]"
          title={`Set color for ${name}`}
        >
          {row}
        </button>
      ) : (
        row
      )}
    </li>
  );
}

export function TeamColorsLegend({ staff, isAdmin }: TeamColorsLegendProps) {
  const [editing, setEditing] = useState<StaffColorEntry | null>(null);

  const visible = staff
    .filter((p) => p.is_active)
    .sort((a, b) =>
      (a.full_name || a.email).localeCompare(b.full_name || b.email),
    );

  if (visible.length === 0) return null;

  return (
    <>
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 px-3 text-[10px] font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
          <Palette className="h-3 w-3" />
          Team colors
        </p>
        <ul className="space-y-0.5">
          {visible.map((person) => (
            <TeamColorRow
              key={person.id}
              person={person}
              isAdmin={isAdmin}
              onEdit={() => setEditing(person)}
            />
          ))}
        </ul>
        {isAdmin ? (
          <p className="mt-1 px-3 text-[10px] leading-snug text-[var(--muted)]">
            Click a name to change their color.
          </p>
        ) : null}
      </div>

      {editing ? (
        <ColorEditModal
          person={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function ColorEditModal({
  person,
  onClose,
}: {
  person: StaffColorEntry;
  onClose: () => void;
}) {
  const router = useRouter();
  const [hex, setHex] = useState(person.color ?? "#52525B");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const name = person.full_name?.trim() || person.email;
  const preview = normalizeHexColor(hex) ?? "#52525B";

  function save(next: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await updateProfileColorAction({
        id: person.id,
        color: next,
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--foreground)]/35"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-[var(--foreground)]">
              Color for {name}
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Pick from the wheel or paste a hex code.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="color"
            value={preview}
            onChange={(e) => setHex(e.target.value.toUpperCase())}
            className="h-12 w-14 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--background)] p-1"
            aria-label="Color wheel"
          />
          <input
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            placeholder="#0084C6"
            maxLength={7}
            className="h-10 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
          />
          <span
            className="h-10 w-10 shrink-0 rounded-lg border border-[var(--border)]"
            style={{ backgroundColor: preview }}
            title={preview}
          />
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => save(null)}
            className="h-9 rounded-lg px-3 text-sm text-[var(--muted)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="h-9 rounded-lg px-3 text-sm text-[var(--muted)] hover:bg-[var(--surface-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !normalizeHexColor(hex)}
            onClick={() => save(hex)}
            className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
