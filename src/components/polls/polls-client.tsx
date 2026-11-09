"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPollAction,
  deletePollAction,
  setPollClosedAction,
  voteAction,
} from "@/app/(app)/polls/actions";
import type { Poll } from "@/lib/types/polls";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

function PollCard({
  poll,
  canManage,
}: {
  poll: Poll;
  canManage: boolean;
}) {
  // canManage here already accounts for admin/trainer OR being the creator.
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function vote(optionId: string) {
    if (poll.is_closed) return;
    startTransition(async () => {
      const r = await voteAction({ pollId: poll.id, optionId });
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }
  function setClosed(closed: boolean) {
    startTransition(async () => {
      await setPollClosedAction({ pollId: poll.id, closed });
      router.refresh();
    });
  }
  function remove() {
    if (!confirm("Delete this poll and its votes?")) return;
    startTransition(async () => {
      const r = await deletePollAction(poll.id);
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  const total = poll.total_votes;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold text-[var(--foreground)]">{poll.question}</h3>
        {poll.is_closed ? (
          <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">Closed</span>
        ) : null}
      </div>

      <ul className="mt-3 space-y-2">
        {poll.options.map((o) => {
          const pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
          const mine = poll.my_option_id === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={pending || poll.is_closed}
                onClick={() => vote(o.id)}
                className={`relative block w-full overflow-hidden rounded-lg border p-2.5 text-left transition-colors ${
                  mine ? "border-[var(--brand)]" : "border-[var(--border)]"
                } ${poll.is_closed ? "cursor-default" : "hover:border-[var(--brand)]/50"}`}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-[var(--brand-soft)]"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {mine ? "● " : ""}{o.label}
                  </span>
                  <span className="text-xs text-[var(--muted)]">{o.votes} · {pct}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
        <span>{total} vote{total === 1 ? "" : "s"}</span>
        {!poll.is_closed ? <span>· Tap an option to vote (you can change it)</span> : null}
        {canManage ? (
          <>
            <button type="button" onClick={() => setClosed(!poll.is_closed)} className="font-medium text-[var(--brand)] hover:underline">
              {poll.is_closed ? "Reopen" : "Close"}
            </button>
            <button type="button" onClick={remove} className="text-[var(--muted)] hover:text-red-600">Delete</button>
          </>
        ) : null}
      </div>
    </Card>
  );
}

export function PollsClient({
  polls,
  canManage,
  canCreate = false,
  currentUserId = "",
}: {
  polls: Poll[];
  canManage: boolean;
  canCreate?: boolean;
  currentUserId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [error, setError] = useState<string | null>(null);

  function setOption(i: number, val: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
  }
  function addOption() {
    setOptions((prev) => (prev.length >= 10 ? prev : [...prev, ""]));
  }
  function removeOption(i: number) {
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  }
  function create() {
    setError(null);
    startTransition(async () => {
      const r = await createPollAction({ question, options });
      if (r.error) { setError(r.error); return; }
      setQuestion("");
      setOptions(["", ""]);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">Polls</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Quick team polls. Everyone can vote; results update live.
        </p>
      </header>

      {canCreate ? (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">New poll</h2>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question…"
            className="mt-3 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
          <div className="mt-2 space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={o}
                  onChange={(e) => setOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="h-9 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                />
                {options.length > 2 ? (
                  <button type="button" onClick={() => removeOption(i)} className="text-xs text-[var(--muted)] hover:text-red-600">×</button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3">
            {options.length < 10 ? (
              <button type="button" onClick={addOption} className="text-xs font-medium text-[var(--brand)] hover:underline">+ Add option</button>
            ) : null}
          </div>
          {error ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
          <button type="button" disabled={pending || !question.trim()} onClick={create} className="mt-3 inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            Create poll
          </button>
        </Card>
      ) : null}

      {polls.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">No polls yet.</p>
        </Card>
      ) : (
        polls.map((p) => (
          <PollCard
            key={p.id}
            poll={p}
            canManage={canManage || p.created_by === currentUserId}
          />
        ))
      )}
    </div>
  );
}
