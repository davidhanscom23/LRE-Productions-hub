"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelTimeOffAction,
  reviewTimeOffAction,
  saveAvailabilityAction,
  submitTimeOffAction,
} from "@/app/(app)/time-off/actions";
import type {
  TeamTimeOff,
  TimeOffRequest,
  TimeOffStatus,
} from "@/lib/types/time-off";
import {
  TIME_OFF_TYPES,
  WEEKDAYS,
  timeOffTypeLabel,
} from "@/lib/types/time-off";
import { DEFAULT_AVAILABLE_DAYS } from "@/lib/calendar/availability";

type Props = {
  isAdmin: boolean;
  myRequests: TimeOffRequest[];
  teamTimeOff: TeamTimeOff[];
  adminRequests: TimeOffRequest[];
  /** Current weekly availability pattern (empty = default all days). */
  myAvailableDays: string[];
  myAvailabilityNote: string;
};

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtRange(start: string, end: string): string {
  return start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`;
}

const STATUS_STYLES: Record<TimeOffStatus, string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  approved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  denied: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
  cancelled:
    "bg-[var(--surface-hover)] text-[var(--muted)]",
};

function StatusBadge({ status }: { status: TimeOffStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

export function TimeOffClient({
  isAdmin,
  myRequests,
  teamTimeOff,
  adminRequests,
  myAvailableDays,
  myAvailabilityNote,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [availError, setAvailError] = useState<string | null>(null);
  const [availMessage, setAvailMessage] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>(() =>
    myAvailableDays.length ? myAvailableDays : [...DEFAULT_AVAILABLE_DAYS],
  );
  const [availNote, setAvailNote] = useState(myAvailabilityNote);

  // Request form state
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState<string>("unavailable");
  const [note, setNote] = useState("");

  const pendingAdmin = adminRequests.filter((r) => r.status === "pending");
  const reviewedAdmin = adminRequests.filter((r) => r.status !== "pending");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFormMessage(null);
    startTransition(async () => {
      const result = await submitTimeOffAction({
        startDate,
        endDate,
        type,
        note,
      });
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setStartDate("");
      setEndDate("");
      setNote("");
      setType("unavailable");
      setFormMessage("Request submitted. An admin will review it.");
      router.refresh();
    });
  }

  function handleCancel(id: string) {
    if (!confirm("Cancel this request?")) return;
    startTransition(async () => {
      const result = await cancelTimeOffAction(id);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  function handleReview(id: string, decision: "approved" | "denied") {
    startTransition(async () => {
      const result = await reviewTimeOffAction({ id, decision });
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }


  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Time Off
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Request time off, set weekly availability, and see who’s out.
        </p>
      </header>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Weekly availability
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Days you’re usually free for events. Calendar Staff Availability uses
          this (everyone defaults to all days until you customize).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => {
            const on = days.includes(d.key);
            return (
              <button
                key={d.key}
                type="button"
                onClick={() =>
                  setDays((prev) =>
                    on ? prev.filter((x) => x !== d.key) : [...prev, d.key],
                  )
                }
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  on
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <label className="mt-3 block space-y-1.5">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Note <span className="text-[var(--muted)]">(optional)</span>
          </span>
          <input
            type="text"
            value={availNote}
            onChange={(e) => setAvailNote(e.target.value)}
            placeholder="e.g. Prefer weekends off"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
          />
        </label>
        {availError ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            {availError}
          </p>
        ) : null}
        {availMessage ? (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            {availMessage}
          </p>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setAvailError(null);
            setAvailMessage(null);
            startTransition(async () => {
              const result = await saveAvailabilityAction({
                days,
                note: availNote,
              });
              if (result.error) {
                setAvailError(result.error);
                return;
              }
              setAvailMessage("Availability saved.");
              router.refresh();
            });
          }}
          className="mt-3 inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save availability"}
        </button>
      </Card>

      {/* Admin: pending approvals first */}
      {isAdmin ? (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Pending approvals
            {pendingAdmin.length > 0 ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--brand)]">
                {pendingAdmin.length}
              </span>
            ) : null}
          </h2>
          {pendingAdmin.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No requests waiting on you.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {pendingAdmin.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {r.requester_name}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        {timeOffTypeLabel(r.type)} · {fmtRange(r.start_date, r.end_date)}
                      </p>
                      {r.note ? (
                        <p className="mt-1 text-sm text-[var(--foreground)]/80">
                          “{r.note}”
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleReview(r.id, "approved")}
                        className="inline-flex h-8 items-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleReview(r.id, "denied")}
                        className="inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {/* Request time off */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Request time off
        </h2>
        <form onSubmit={handleSubmit} className="mt-3 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Start date
              </span>
              <input
                type="date"
                required
                min={today}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || endDate < e.target.value)
                    setEndDate(e.target.value);
                }}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">
                End date
              </span>
              <input
                type="date"
                required
                min={startDate || today}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
              />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Type
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
            >
              {TIME_OFF_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Note <span className="text-[var(--muted)]">(optional)</span>
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Anything the admin should know"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
            />
          </label>
          {formError ? (
            <p className="text-sm text-red-700 dark:text-red-300">{formError}</p>
          ) : null}
          {formMessage ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {formMessage}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending || !startDate || !endDate}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit request"}
          </button>
        </form>
      </Card>

      {/* My requests */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          My requests
        </h2>
        {myRequests.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            You haven’t requested any time off yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {myRequests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {timeOffTypeLabel(r.type)} · {fmtRange(r.start_date, r.end_date)}
                  </p>
                  {r.note ? (
                    <p className="text-sm text-[var(--muted)]">“{r.note}”</p>
                  ) : null}
                  {r.status === "denied" && r.review_note ? (
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Admin: {r.review_note}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={r.status} />
                  {r.status === "pending" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleCancel(r.id)}
                      className="text-xs font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Team time off (approved) */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Who’s off
        </h2>
        {teamTimeOff.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No approved time off coming up.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {teamTimeOff.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 py-2.5"
              >
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {t.full_name}
                </span>
                <span className="text-sm text-[var(--muted)]">
                  {timeOffTypeLabel(t.type)} · {fmtRange(t.start_date, t.end_date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Admin: recently reviewed */}
      {isAdmin && reviewedAdmin.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Recently reviewed
          </h2>
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {reviewedAdmin.slice(0, 20).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <span className="text-sm text-[var(--foreground)]">
                  {r.requester_name} · {timeOffTypeLabel(r.type)} ·{" "}
                  {fmtRange(r.start_date, r.end_date)}
                </span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
