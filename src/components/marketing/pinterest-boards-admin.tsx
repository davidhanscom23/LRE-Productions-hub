"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Settings2, Trash2, X } from "lucide-react";
import {
  deletePinterestBoardAction,
  savePinterestBoardAction,
} from "@/app/(app)/marketing/actions";
import type { PinterestBoard } from "@/lib/social/pinterest-boards-types";

type PinterestBoardsAdminProps = {
  boards: PinterestBoard[];
};

/**
 * Collapsed-by-default admin registry for Pinterest boards.
 * Daily posting uses the per-draft Board dropdown — this is setup only.
 */
export function PinterestBoardsAdmin({ boards }: PinterestBoardsAdminProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Always start collapsed so Marketing Queue opens on the queue itself.
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [boardId, setBoardId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function startCreate() {
    setEditingId(null);
    setLabel("");
    setBoardId("");
    setError(null);
    setMessage(null);
  }

  function startEdit(board: PinterestBoard) {
    setEditingId(board.id);
    setLabel(board.label);
    setBoardId(board.board_id);
    setError(null);
    setMessage(null);
    setOpen(true);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await savePinterestBoardAction({
        id: editingId,
        label,
        boardId,
        sortOrder: boards.length,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(editingId ? "Board updated." : "Board added.");
      startCreate();
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deletePinterestBoardAction(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (editingId === id) startCreate();
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
        <p className="text-xs text-[var(--muted)]">
          Pinterest board registry ({boards.length} board
          {boards.length === 1 ? "" : "s"}) — used by the per-draft Board picker.
        </p>
        <button
          type="button"
          onClick={() => {
            startCreate();
            setOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Manage Pinterest boards
        </button>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Pinterest boards
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Register boards for the per-draft Board picker. Selecting a board
            pins only to that board; leave a draft on &quot;Default board&quot;
            to use the account&apos;s default.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            startCreate();
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
      </div>

      {boards.length > 0 ? (
        <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
          {boards.map((board) => (
            <li
              key={board.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div>
                <p className="font-medium text-[var(--foreground)]">
                  {board.label}
                </p>
                <p className="text-xs text-[var(--muted)]">{board.board_id}</p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startEdit(board)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleDelete(board.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-[var(--muted)]">
          No boards yet — add label + numeric Pinterest board id to enable the
          draft Board picker.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-3 space-y-2 border-t border-[var(--border)] pt-3"
      >
        <p className="text-xs font-medium text-[var(--foreground)]">
          {editingId ? "Edit board" : "Add board"}
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Label (e.g. Weddings)"
            required
            className="h-9 min-w-[10rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
          />
          <input
            value={boardId}
            onChange={(event) => setBoardId(event.target.value)}
            placeholder="Board id (numeric)"
            required
            className="h-9 min-w-[10rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {editingId ? "Save" : "Add"}
          </button>
        </div>
        {error ? (
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        ) : null}
        {message ? (
          <p className="text-xs text-emerald-800 dark:text-emerald-200">
            {message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
