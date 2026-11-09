"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  deleteVenueAction,
  saveVenueAction,
} from "@/app/(app)/event-packets/actions";
import type { VenueWithAliases } from "@/lib/types/event-packets";

type VenuesAdminPanelProps = {
  venues: VenueWithAliases[];
};

export function VenuesAdminPanel({ venues }: VenuesAdminPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function startCreate() {
    setEditingId(null);
    setName("");
    setAliases("");
    setError(null);
    setMessage(null);
  }

  function startEdit(venue: VenueWithAliases) {
    setEditingId(venue.id);
    setName(venue.name);
    setAliases(venue.aliases.map((alias) => alias.alias).join("\n"));
    setError(null);
    setMessage(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveVenueAction({
        venueId: editingId ?? undefined,
        name,
        aliases: aliases
          .split(/\n|,/)
          .map((part) => part.trim())
          .filter(Boolean),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(
        editingId
          ? "Venue updated."
          : "Venue saved. Aliases will fold matching event names under this folder.",
      );
      setEditingId(null);
      setName("");
      setAliases("");
      router.refresh();
    });
  }

  function handleDelete(venueId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteVenueAction(venueId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (editingId === venueId) startCreate();
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Venue masters
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Master folders for event media. Add aliases so “The Treasury” and
          “The Treasury on the Plaza” land in the same parent folder.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-[var(--foreground)]">
            {editingId ? "Edit venue" : "Add venue"}
          </p>
          {editingId ? (
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <X className="h-3.5 w-3.5" />
              Cancel edit
            </button>
          ) : null}
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Master venue name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="The Treasury on the Plaza"
            required
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            Aliases (comma or new line)
          </span>
          <textarea
            value={aliases}
            onChange={(event) => setAliases(event.target.value)}
            placeholder={"The Treasury\nTreasury on the Plaza"}
            rows={3}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        {message ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {editingId ? (
            <>
              <Pencil className="h-4 w-4" />
              Save venue
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add venue
            </>
          )}
        </button>
      </form>

      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {venues.length === 0 ? (
          <p className="p-4 text-sm text-[var(--muted)]">
            No venues yet. Sync from the calendar or add one above.
          </p>
        ) : (
          venues.map((venue) => (
            <div
              key={venue.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <p className="font-medium text-[var(--foreground)]">
                  {venue.name}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  Folder: {venue.folder_slug}
                </p>
                {venue.aliases.length > 0 ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Aliases:{" "}
                    {venue.aliases.map((alias) => alias.alias).join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(venue)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 self-start rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface-hover)]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(venue.id)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 self-start rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
