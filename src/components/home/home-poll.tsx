"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Vote } from "lucide-react";
import { voteAction } from "@/app/(app)/polls/actions";
import type { Poll } from "@/lib/types/polls";

export function HomePoll({ poll }: { poll: Poll | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!poll) return null;

  const total = poll.total_votes;

  function vote(optionId: string) {
    startTransition(async () => {
      await voteAction({ pollId: poll!.id, optionId });
      router.refresh();
    });
  }

  return (
    <div className="rounded-[var(--panel-radius)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Vote className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-[var(--foreground)]">{poll.question}</p>
            <Link href="/polls" className="text-xs font-medium text-[var(--brand)] hover:underline">
              All polls
            </Link>
          </div>
          <ul className="mt-2 space-y-1.5">
            {poll.options.map((o) => {
              const pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
              const mine = poll.my_option_id === o.id;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => vote(o.id)}
                    className={`relative block w-full overflow-hidden rounded-lg border p-2 text-left transition-colors ${
                      mine ? "border-[var(--brand)]" : "border-[var(--border)] hover:border-[var(--brand)]/50"
                    }`}
                  >
                    <span aria-hidden className="absolute inset-y-0 left-0 bg-[var(--brand-soft)]" style={{ width: `${pct}%` }} />
                    <span className="relative flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-[var(--foreground)]">{mine ? "● " : ""}{o.label}</span>
                      <span className="text-xs text-[var(--muted)]">{pct}%</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            {total} vote{total === 1 ? "" : "s"} · tap to vote
          </p>
        </div>
      </div>
    </div>
  );
}
