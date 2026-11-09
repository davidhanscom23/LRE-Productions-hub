"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { listSubmissions } from "@/app/(app)/inquiry-forms/actions";
import { formatEasternTimestamp } from "@/lib/inquiry-forms/dates";
import { FunnelTiles } from "./funnel-tiles";
import { NEEDS_MIGRATION_MESSAGE } from "./list-types";
import { Chip, cls, Notice } from "./list-ui";
import { SubmissionDrawer } from "./submission-drawer";
import {
  DATE_RESULT_LABEL,
  DATE_RESULT_TONE,
  LOCATION_RESULT_LABEL,
  LOCATION_RESULT_TONE,
  SCORE_LABEL_TEXT,
  SCORE_LABEL_TONE,
  STAGE_FILTERS,
  STAGE_LABEL,
  STAGE_TONE,
  CRM_WORDS,
  formatYmd,
} from "./submissions-format";
import type { StageFilter, SubmissionListResult, SubmissionListRow } from "./submissions-types";

/**
 * Submissions tab of the form editor: funnel tiles, stage filter, paged table, and a drawer per
 * submission. Deep link: ?tab=submissions&s=<submission id> opens that submission's drawer.
 */
export default function SubmissionsPanel({ formId }: { formId: string }) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-[var(--muted)]" role="status">
          Loading submissions...
        </p>
      }
    >
      <SubmissionsPanelInner formId={formId} />
    </Suspense>
  );
}

export { SubmissionsPanel };

type View =
  | { state: "loading" }
  | { state: "error"; message: string; needsMigration: boolean }
  | { state: "ready"; data: SubmissionListResult };

const OFFLINE_VIEW: View = {
  state: "error",
  message: "Could not reach the Hub. Check your connection and try again.",
  needsMigration: false,
};

function viewFrom(res: SubmissionListResult): View {
  if (res.error || res.needsMigration) {
    return {
      state: "error",
      message: res.needsMigration ? NEEDS_MIGRATION_MESSAGE : (res.error ?? "Could not load submissions."),
      needsMigration: Boolean(res.needsMigration),
    };
  }
  return { state: "ready", data: res };
}

function SubmissionsPanelInner({ formId }: { formId: string }) {
  const searchParams = useSearchParams();
  const openId = searchParams.get("s");
  const [stage, setStage] = useState<StageFilter>("all");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>({ state: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  /** Only the newest request may update the view (fast filter clicks can answer out of order). */
  const requestRef = useRef(0);

  useEffect(() => {
    const ticket = ++requestRef.current;
    listSubmissions({ formId, stage: "all", page: 1 }).then(
      (res) => {
        if (ticket === requestRef.current) setView(viewFrom(res));
      },
      () => {
        if (ticket === requestRef.current) setView(OFFLINE_VIEW);
      },
    );
  }, [formId]);

  function load(nextStage: StageFilter, nextPage: number) {
    const ticket = ++requestRef.current;
    setRefreshing(true);
    listSubmissions({ formId, stage: nextStage, page: nextPage }).then(
      (res) => {
        if (ticket !== requestRef.current) return;
        setView(viewFrom(res));
        // The server moves past-the-end requests back to the last page.
        if (typeof res.page === "number" && res.page !== nextPage) setPage(res.page);
        setRefreshing(false);
      },
      () => {
        if (ticket !== requestRef.current) return;
        setView(OFFLINE_VIEW);
        setRefreshing(false);
      },
    );
  }

  function changeStage(next: StageFilter) {
    if (next === stage) return;
    setStage(next);
    setPage(1);
    load(next, 1);
  }

  function changePage(next: number) {
    setPage(next);
    load(stage, next);
  }

  function refresh() {
    load(stage, page);
  }

  function setOpen(id: string | null) {
    const params = new URLSearchParams(window.location.search);
    if (id) {
      params.set("tab", "submissions");
      params.set("s", id);
    } else {
      params.delete("s");
    }
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }

  const data = view.state === "ready" ? view.data : null;
  const pageSize = data?.pageSize ?? 25;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(total, page * pageSize);
  const windowDays = data?.funnel.windowDays ?? 30;

  return (
    <div className="space-y-5">
      {data ? (
        <FunnelTiles
          caption={`Last ${windowDays} days`}
          views={data.funnel.views}
          starts={data.funnel.starts}
          completes={data.funnel.completes}
          perStepReached={data.funnel.perStepReached}
          stepLabels={data.funnel.stepLabels}
        />
      ) : null}

      <section className="space-y-3" aria-labelledby="submissions-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="submissions-heading" className={cls.sectionTitle}>
            Submissions
          </h2>
          <button type="button" className={cls.btnSmall} onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div role="group" aria-label="Filter by stage" className="flex flex-wrap gap-2">
          {STAGE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={stage === f.value}
              onClick={() => changeStage(f.value)}
              className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${
                stage === f.value
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--foreground)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <p className="text-sm text-[var(--muted)]" aria-live="polite">
          {view.state === "loading"
            ? "Loading submissions..."
            : refreshing
              ? "Updating the list..."
              : data
                ? total === 0
                  ? "No submissions here yet."
                  : `Showing ${firstRow}-${lastRow} of ${total}.`
                : null}
        </p>

        {view.state === "error" ? (
          <Notice tone={view.needsMigration ? "warn" : "bad"} title={view.needsMigration ? "Database update needed" : "Could not load submissions"}>
            {view.message}
          </Notice>
        ) : null}

        {data && data.rows.length > 0 ? (
          <>
            <SubmissionTable rows={data.rows} onOpen={(id) => setOpen(id)} busy={refreshing} />
            <SubmissionCards rows={data.rows} onOpen={(id) => setOpen(id)} busy={refreshing} />
          </>
        ) : null}

        {data && pageCount > 1 ? (
          <nav className="flex items-center justify-between gap-3" aria-label="Pages">
            <button
              type="button"
              className={cls.btnSecondary}
              onClick={() => changePage(page - 1)}
              disabled={page <= 1 || refreshing}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </button>
            <span className="text-sm text-[var(--foreground)]">
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              className={cls.btnSecondary}
              onClick={() => changePage(page + 1)}
              disabled={page >= pageCount || refreshing}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        ) : null}
      </section>

      {openId ? (
        <SubmissionDrawer
          key={openId}
          submissionId={openId}
          onClose={() => setOpen(null)}
          onChanged={() => load(stage, page)}
        />
      ) : null}
    </div>
  );
}

function contactLine(r: SubmissionListRow): string {
  return [r.email, r.phone].filter(Boolean).join(" · ");
}

function SubmissionTable({
  rows,
  onOpen,
  busy,
}: {
  rows: SubmissionListRow[];
  onOpen: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div className={`hidden overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] md:block ${busy ? "opacity-70" : ""}`}>
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            <th scope="col" className="px-3 py-2">Person</th>
            <th scope="col" className="px-3 py-2">Received</th>
            <th scope="col" className="px-3 py-2">Stage</th>
            <th scope="col" className="px-3 py-2">Event date</th>
            <th scope="col" className="px-3 py-2">Date check</th>
            <th scope="col" className="px-3 py-2">Travel</th>
            <th scope="col" className="px-3 py-2">Score</th>
            <th scope="col" className="px-3 py-2">Source</th>
            <th scope="col" className="px-3 py-2">{CRM_WORDS.column}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onOpen(r.id)}
              className="cursor-pointer border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-hover)]"
            >
              <td className="max-w-[16rem] px-3 py-2 align-top">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(r.id);
                  }}
                  className="block max-w-full truncate text-left font-semibold text-[var(--foreground)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
                  aria-label={`Open submission from ${r.name || r.email || r.phone || "a visitor"}`}
                >
                  {r.name || "No name yet"}
                </button>
                <span className="block truncate text-xs text-[var(--muted)]">{contactLine(r) || "No contact yet"}</span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 align-top text-[var(--foreground)]">{formatEasternTimestamp(r.createdAt)}</td>
              <td className="px-3 py-2 align-top">
                <Chip tone={STAGE_TONE[r.stage]}>{STAGE_LABEL[r.stage]}</Chip>
              </td>
              <td className="whitespace-nowrap px-3 py-2 align-top text-[var(--foreground)]">{r.eventDate ? formatYmd(r.eventDate) : "-"}</td>
              <td className="px-3 py-2 align-top">
                {r.dateResult ? <Chip tone={DATE_RESULT_TONE[r.dateResult]}>{DATE_RESULT_LABEL[r.dateResult]}</Chip> : <span className="text-[var(--muted)]">-</span>}
              </td>
              <td className="px-3 py-2 align-top">
                {r.locationResult ? (
                  <Chip tone={LOCATION_RESULT_TONE[r.locationResult]}>{LOCATION_RESULT_LABEL[r.locationResult]}</Chip>
                ) : (
                  <span className="text-[var(--muted)]">-</span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2 align-top">
                {r.score === null ? (
                  <span className="text-[var(--muted)]">-</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[var(--foreground)]">
                    <span className="tabular-nums">{r.score}</span>
                    {r.scoreLabel ? <Chip tone={SCORE_LABEL_TONE[r.scoreLabel]}>{SCORE_LABEL_TEXT[r.scoreLabel]}</Chip> : null}
                  </span>
                )}
              </td>
              <td className="max-w-[12rem] px-3 py-2 align-top">
                <span className="block truncate text-[var(--foreground)]" title={r.source}>
                  {r.source}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 align-top">
                {r.crmHref ? (
                  <span className="text-[var(--foreground)]">{CRM_WORDS.onCrm}</span>
                ) : (
                  <span className="text-[var(--muted)]">{CRM_WORDS.notYet}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubmissionCards({
  rows,
  onOpen,
  busy,
}: {
  rows: SubmissionListRow[];
  onOpen: (id: string) => void;
  busy: boolean;
}) {
  return (
    <ul className={`space-y-2 md:hidden ${busy ? "opacity-70" : ""}`}>
      {rows.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onOpen(r.id)}
            className="block w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
          >
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 truncate font-semibold text-[var(--foreground)]">{r.name || "No name yet"}</span>
              <Chip tone={STAGE_TONE[r.stage]}>{STAGE_LABEL[r.stage]}</Chip>
            </span>
            <span className="mt-1 block truncate text-sm text-[var(--muted)]">{contactLine(r) || "No contact yet"}</span>
            <span className="mt-2 flex flex-wrap gap-2 text-sm">
              {r.eventDate ? <span className="text-[var(--foreground)]">{formatYmd(r.eventDate)}</span> : null}
              {r.dateResult ? <Chip tone={DATE_RESULT_TONE[r.dateResult]}>{DATE_RESULT_LABEL[r.dateResult]}</Chip> : null}
              {r.locationResult ? (
                <Chip tone={LOCATION_RESULT_TONE[r.locationResult]}>{LOCATION_RESULT_LABEL[r.locationResult]}</Chip>
              ) : null}
              {r.scoreLabel ? <Chip tone={SCORE_LABEL_TONE[r.scoreLabel]}>{`Score ${r.score ?? ""} ${SCORE_LABEL_TEXT[r.scoreLabel]}`}</Chip> : null}
            </span>
            <span className="mt-2 block text-xs text-[var(--muted)]">
              {formatEasternTimestamp(r.createdAt)} · {r.source}
              {r.crmHref ? ` · ${CRM_WORDS.onCrm}` : ""}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
