"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  addProjectNoteAction,
  setProjectNoteDoneAction,
} from "@/app/(app)/pipeline/notes-actions";
import type { PipelineProjectNote } from "@/lib/types/pipeline";

const CATEGORY_LABEL: Record<PipelineProjectNote["category"], string> = {
  note: "Note",
  email: "Email",
  change: "Change",
  action: "To do",
  status: "Status",
};

function sourceLabel(n: PipelineProjectNote): string {
  if (n.source === "system") return "Hub";
  return n.author_name || "Teammate";
}

export function ProjectNotes({
  projectId,
  notes,
  canEdit,
}: {
  projectId: string;
  notes: PipelineProjectNote[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [needsAction, setNeedsAction] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = notes.filter((n) => n.needs_action && !n.action_done_at);

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await addProjectNoteAction({ projectId, body, needsAction });
      if (res.error) {
        setError(res.error);
        return;
      }
      setBody("");
      setNeedsAction(false);
      router.refresh();
    });
  }

  function toggleDone(noteId: string, done: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setProjectNoteDoneAction({ projectId, noteId, done });
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">Notes and trail</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Everything discussed, added, or changed on this project, including summaries of
        client emails, so anyone can pick it up where the last person left off.
      </p>

      {open.length > 0 ? (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
          <p className="text-xs font-semibold text-[var(--foreground)]">
            Needs action ({open.length})
          </p>
          <ul className="mt-2 space-y-2">
            {open.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="whitespace-pre-wrap text-[var(--foreground)]">{n.body}</span>
                {canEdit ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => toggleDone(n.id, true)}
                    className="shrink-0 rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-50"
                  >
                    Mark done
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canEdit ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Add a note: what was discussed, promised, or changed…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <input
                type="checkbox"
                checked={needsAction}
                onChange={(e) => setNeedsAction(e.target.checked)}
              />
              Someone needs to act on this
            </label>
            <button
              type="button"
              disabled={pending || !body.trim()}
              onClick={add}
              className="h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Add note"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Only admins and people assigned to this project can add notes.
        </p>
      )}

      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}

      {notes.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No notes yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {notes.map((n) => {
            const done = n.needs_action && Boolean(n.action_done_at);
            return (
              <li
                key={n.id}
                className="border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 font-medium text-[var(--foreground)]">
                    {CATEGORY_LABEL[n.category]}
                  </span>
                  <span>{sourceLabel(n)}</span>
                  <span>·</span>
                  <span>{new Date(n.occurred_at).toLocaleString()}</span>
                  {done ? (
                    <>
                      <span>·</span>
                      <span>Done {new Date(n.action_done_at as string).toLocaleDateString()}</span>
                      {canEdit ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggleDone(n.id, false)}
                          className="underline disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <p
                  className={`mt-1 whitespace-pre-wrap text-sm ${
                    done ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"
                  }`}
                >
                  {n.body}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
