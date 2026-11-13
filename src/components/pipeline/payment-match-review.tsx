"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  linkPaymentToProjectAction,
  markPaymentNoProjectAction,
  rejectPaymentSuggestionAction,
} from "@/app/(app)/pipeline/payment-match-actions";
import {
  needsMatchReview,
  paymentProjectName,
  rejectedProjectIds,
  suggestProjectsForPayment,
} from "@/lib/pipeline/payment-matching";
import {
  formatPipelineMoney,
  type PipelineClient,
  type PipelinePayment,
  type PipelineProject,
} from "@/lib/types/pipeline";

/** Payments with no project, each with the Hub's best guesses. Admins approve, reject or pick another. */
export function PaymentMatchReview({
  payments,
  projects,
  clients,
}: {
  payments: PipelinePayment[];
  projects: PipelineProject[];
  clients: PipelineClient[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [other, setOther] = useState<Record<string, string>>({});

  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );
  const emailByClient = useMemo(
    () => new Map(clients.map((c) => [c.id, c.email])),
    [clients],
  );
  const projectsByClient = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const p of payments) {
      if (!p.client_id || !p.project_id) continue;
      const s = m.get(p.client_id) ?? new Set<string>();
      s.add(p.project_id);
      m.set(p.client_id, s);
    }
    return m;
  }, [payments]);

  const queue = useMemo(
    () =>
      payments
        .filter((p) => needsMatchReview(p))
        .map((p) => ({
          pay: p,
          suggestions: suggestProjectsForPayment(
            {
              id: p.id,
              client_id: p.client_id,
              client_email: p.client_id ? emailByClient.get(p.client_id) : null,
              paid_at: p.paid_at,
              note: p.note,
              raw: p.raw,
            },
            projects,
            {
              rejectedProjectIds: rejectedProjectIds(p.raw),
              clientProjectIds: p.client_id
                ? projectsByClient.get(p.client_id)
                : undefined,
            },
          ),
        })),
    [payments, projects, emailByClient, projectsByClient],
  );

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );

  if (queue.length === 0) return null;

  function run(fn: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/30">
      <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
        Needs review ({queue.length})
      </h2>
      <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-100/80">
        These payments are not linked to a project yet. The Hub guessed the most likely
        matches from the project name, client and dates. Approve the right one, reject a
        wrong guess, or pick another project. Nothing is linked until you approve it.
      </p>
      {error ? (
        <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-300">{error}</p>
      ) : null}
      <ul className="mt-3 space-y-3">
        {queue.map(({ pay, suggestions }) => {
          const hbName = paymentProjectName(pay.raw);
          return (
            <li
              key={pay.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {formatPipelineMoney(pay.amount, pay.currency)}
                  <span className="ml-2 font-normal text-[var(--muted)]">
                    {pay.paid_at ? new Date(pay.paid_at).toLocaleDateString() : "no date"}
                    {pay.client_name ? ` · ${pay.client_name}` : ""}
                    {pay.note ? ` · ${pay.note}` : ""}
                  </span>
                </p>
                {hbName ? (
                  <p className="text-xs text-[var(--muted)]">Pipeline says: {hbName}</p>
                ) : null}
              </div>

              {suggestions.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  No likely match found. Pick a project below, or mark it as having none.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {suggestions.map((s) => {
                    const proj = projectById.get(s.projectId);
                    if (!proj) return null;
                    return (
                      <li
                        key={s.projectId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--background)] px-3 py-2"
                      >
                        <span className="text-sm">
                          <span className="font-medium text-[var(--foreground)]">
                            {proj.name}
                          </span>
                          <span className="ml-2 text-xs text-[var(--muted)]">
                            {s.reasons.join(" · ")}
                          </span>
                        </span>
                        <span className="flex gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(() =>
                                linkPaymentToProjectAction({
                                  paymentId: pay.id,
                                  projectId: s.projectId,
                                }),
                              )
                            }
                            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(() =>
                                rejectPaymentSuggestionAction({
                                  paymentId: pay.id,
                                  projectId: s.projectId,
                                }),
                              )
                            }
                            className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--foreground)] disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={other[pay.id] ?? ""}
                  onChange={(e) =>
                    setOther((o) => ({ ...o, [pay.id]: e.target.value }))
                  }
                  className="min-w-[14rem] rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)]"
                  aria-label="Pick another project"
                >
                  <option value="">Pick another project…</option>
                  {sortedProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={pending || !other[pay.id]}
                  onClick={() =>
                    run(() =>
                      linkPaymentToProjectAction({
                        paymentId: pay.id,
                        projectId: other[pay.id],
                      }),
                    )
                  }
                  className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--foreground)] disabled:opacity-50"
                >
                  Link to this one
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => markPaymentNoProjectAction({ paymentId: pay.id }))}
                  className="text-xs text-[var(--muted)] underline disabled:opacity-50"
                >
                  No project for this payment
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
