"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Trash2, X } from "lucide-react";
import { deleteEventReportAction } from "@/app/(app)/end-of-event-report/actions";
import { formatEventTypeLabel } from "@/lib/event-packets/format-event-type";
import type { EventReport } from "@/lib/types/event-reports";

type EventReportListProps = {
  reports: EventReport[];
  canSeeAll: boolean;
  currentUserId: string;
  isAdmin: boolean;
};

type ListFilter = "all" | "follow-up";

export function EventReportList({
  reports,
  canSeeAll,
  currentUserId,
  isAdmin,
}: EventReportListProps) {
  const [filter, setFilter] = useState<ListFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const followUpCount = useMemo(
    () => reports.filter((report) => report.follow_up_needed).length,
    [reports],
  );

  const visibleReports = useMemo(() => {
    if (filter === "follow-up") {
      return reports.filter((report) => report.follow_up_needed);
    }
    return reports;
  }, [filter, reports]);

  const selected = useMemo(
    () => reports.find((r) => r.id === selectedId) ?? null,
    [reports, selectedId],
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
          Submitted reports
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {canSeeAll
            ? "All staff end-of-event reports."
            : "Your submitted end-of-event reports."}
        </p>
      </div>

      {reports.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label={`All (${reports.length})`}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterChip
            label={`Follow-up needed by admin (${followUpCount})`}
            active={filter === "follow-up"}
            onClick={() => setFilter("follow-up")}
          />
        </div>
      ) : null}

      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 px-6 py-10 text-center">
          <p className="font-medium text-[var(--foreground)]">No reports yet</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Submit your first report using the form above.
          </p>
        </div>
      ) : visibleReports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 px-6 py-10 text-center">
          <p className="font-medium text-[var(--foreground)]">
            No follow-up reports
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            None of these reports are marked as needing follow-up.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {visibleReports.map((report) => {
            const reporter =
              report.reporter?.full_name?.trim() ||
              report.reporter?.email ||
              "Staff";
            const eventTypeLabel = formatEventTypeLabel(report);
            return (
              <li key={report.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(report.id)}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--foreground)]">
                      {report.client_name} · {eventTypeLabel}
                    </p>
                    <p className="truncate text-sm text-[var(--muted)]">
                      {formatDate(report.event_date)}
                      {canSeeAll ? ` · ${reporter}` : ""}
                      {report.venue ? ` · ${report.venue}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium text-[var(--brand)]">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {report.rating}/5
                    {report.follow_up_needed && (
                      <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                        Follow-up
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <ReportDetailModal
          report={selected}
          canDelete={isAdmin || selected.reporter_id === currentUserId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function ReportDetailModal({
  report,
  canDelete,
  onClose,
}: {
  report: EventReport;
  canDelete: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const reporter =
    report.reporter?.full_name?.trim() || report.reporter?.email || "Staff";
  const eventTypeLabel = formatEventTypeLabel(report);

  function handleDelete() {
    if (!confirm("Delete this report?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteEventReportAction(report.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--foreground)]/30 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              {report.client_name}
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {eventTypeLabel} · {formatDate(report.event_date)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <dl className="space-y-3 text-sm">
          <Detail label="Submitted by" value={reporter} />
          <Detail label="Venue" value={report.venue || "—"} />
          <Detail label="Event type" value={eventTypeLabel} />
          <Detail label="Rating" value={`${report.rating} / 5`} />
          <Detail
            label="Equipment notes"
            value={report.equipment_notes || "—"}
          />
          <Detail
            label="Memorable moment"
            value={report.memorable_moment || "—"}
          />
          <Detail label="Issues" value={report.issues || "—"} />
          <Detail
            label="Client feedback"
            value={report.client_feedback || "—"}
          />
          <Detail
            label="Follow-up needed by admin"
            value={report.follow_up_needed ? "Yes" : "No"}
          />
          {report.follow_up_needed && (
            <Detail
              label="Notes for admin follow-up"
              value={report.follow_up_notes || "—"}
            />
          )}
        </dl>

        {canDelete && (
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={handleDelete}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {pending ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-[var(--foreground)]">
        {value}
      </dd>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
