"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createActivityAction,
  deleteActivityAction,
  reopenActivityAction,
  settleActivityAction,
} from "@/app/(app)/rentals/activities/actions";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import type { ActivityRow } from "@/lib/av-erp/ops-data";

type ActivityFilter = "all" | "due_today" | "overdue";

function isDueToday(dueAt: string, nowMs = Date.now()) {
  const tz = "America/New_York";
  const todayYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(nowMs));
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  const dueYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(due);
  return dueYmd === todayYmd;
}

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

type OppOption = { id: string; reference: string; subject: string };

type Props = {
  activities: ActivityRow[];
  opportunities: OppOption[];
  includeSettled: boolean;
  dueToday: number;
  overdue: number;
  initialFilter?: ActivityFilter;
};

export function ActivitiesClient({
  activities,
  opportunities,
  includeSettled,
  dueToday,
  overdue,
  initialFilter = "all",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>(initialFilter);

  const visible = useMemo(() => {
    if (filter === "all") return activities;
    if (filter === "due_today") {
      return activities.filter(
        (a) => !a.settled_at && isDueToday(a.due_at),
      );
    }
    return activities.filter((a) => !a.settled_at && a.isOverdue && !isDueToday(a.due_at));
  }, [activities, filter]);

  function setFilterAndUrl(next: ActivityFilter) {
    setFilter(next);
    const params = new URLSearchParams();
    if (includeSettled) params.set("settled", "1");
    if (next !== "all") params.set("filter", next);
    const qs = params.toString();
    router.replace(qs ? `/rentals/activities?${qs}` : "/rentals/activities");
  }

  function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("subject", subject);
    fd.set("kind", kind);
    fd.set("due_at", dueAt);
    fd.set("opportunity_id", opportunityId);
    fd.set("notes", notes);
    run(async () => {
      const result = await createActivityAction(fd);
      if (result.ok) {
        setSubject("");
        setKind("");
        setDueAt("");
        setOpportunityId("");
        setNotes("");
      }
      return result;
    });
  }

  return (
    <AvErpPage maxWidthClassName="max-w-3xl">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Activities</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          What has to happen before a job goes out. Due times are Eastern.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {(
          [
            ["all", "All"],
            ["due_today", "Due today"],
            ["overdue", "Overdue"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilterAndUrl(id)}
            className={
              filter === id
                ? "rounded-lg bg-[var(--brand)] px-2.5 py-1.5 text-xs font-semibold text-white"
                : "rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--muted)]"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setFilterAndUrl("due_today")}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left hover:bg-[var(--surface-hover)]"
        >
          <p className="text-2xl font-semibold">{dueToday}</p>
          <p className="text-xs text-[var(--muted)]">Due today</p>
        </button>
        <button
          type="button"
          onClick={() => setFilterAndUrl("overdue")}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left hover:bg-[var(--surface-hover)]"
        >
          <p
            className={`text-2xl font-semibold ${overdue > 0 ? "text-amber-700 dark:text-amber-300" : ""}`}
          >
            {overdue}
          </p>
          <p className="text-xs text-[var(--muted)]">Overdue</p>
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={onCreate}
        className="mb-6 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2"
      >
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-[var(--muted)]">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={fieldClass}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Kind</span>
          <input
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            placeholder="Prep, call, …"
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Due (Eastern)</span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className={fieldClass}
            required
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-[var(--muted)]">Estimate (optional)</span>
          <select
            value={opportunityId}
            onChange={(e) => setOpportunityId(e.target.value)}
            className={fieldClass}
          >
            <option value="">—</option>
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.reference} · {o.subject}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-[var(--muted)]">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={fieldClass}
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add activity
          </button>
        </div>
      </form>

      <div className="mb-2 flex justify-end">
        <Link
          href={(() => {
            const params = new URLSearchParams();
            if (!includeSettled) params.set("settled", "1");
            if (filter !== "all") params.set("filter", filter);
            const qs = params.toString();
            return qs ? `/rentals/activities?${qs}` : "/rentals/activities";
          })()}
          className="text-xs font-semibold text-[var(--brand)] hover:underline"
        >
          {includeSettled ? "Hide settled" : "Show settled too"}
        </Link>
      </div>

      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {visible.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            No open activities.
          </li>
        ) : (
          visible.map((a) => {
            return (
              <li key={a.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {a.subject}
                      {a.settled_at ? (
                        <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                          Settled
                        </span>
                      ) : a.isOverdue ? (
                        <span className="ml-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                          Overdue
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      Due {DATE_FMT.format(new Date(a.due_at))}
                      {a.kind ? ` · ${a.kind}` : ""}
                      {a.opportunity_reference ? (
                        <>
                          {" · "}
                          <Link
                            href={`/rentals/quotes/${a.opportunity_id}`}
                            className="text-[var(--brand)] hover:underline"
                          >
                            {a.opportunity_reference}
                          </Link>
                        </>
                      ) : null}
                    </p>
                    {a.notes ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">{a.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!a.settled_at ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("id", a.id);
                          run(() => settleActivityAction(fd));
                        }}
                        className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-medium"
                      >
                        Settle
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("id", a.id);
                          run(() => reopenActivityAction(fd));
                        }}
                        className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-medium"
                      >
                        Reopen
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("id", a.id);
                        run(() => deleteActivityAction(fd));
                      }}
                      className="rounded-lg px-2 py-1 text-xs text-red-700 dark:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </AvErpPage>
  );
}
