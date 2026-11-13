"use client";

import {
  clearStaffUnavailableAction,
  markStaffUnavailableAction,
} from "@/app/(app)/staffing/actions";
import { timeOffTypeLabel, type TimeOffType } from "@/lib/types/time-off";
import type {
  DayCoverage,
  StaffingPerson,
  TimeOffSource,
} from "@/lib/types/staffing";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function fmtHeading(dateKey: string, weekdayLabel: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  return `${weekdayLabel} · ${d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

function sourceHint(sources: TimeOffSource[]): string {
  const hub = sources.includes("hub");
  const fromFeed = sources.includes("feed");
  if (hub && fromFeed) return "Hub + feed";
  if (fromFeed) return "Calendar feed";
  return "Hub";
}

function shiftDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function StaffingClient({
  days,
  dayCount,
  fromDate,
  icalConfigured,
  icalError,
  unmatchedFeedTimeOff,
  canEdit,
  isAdmin,
}: {
  days: DayCoverage[];
  dayCount: number;
  fromDate: string | null;
  icalConfigured: boolean;
  icalError: string | null;
  unmatchedFeedTimeOff: number;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const startKey = fromDate ?? days[0]?.dateKey ?? null;

  function goWindow(nextFrom: string, nextDays = dayCount) {
    const q = new URLSearchParams();
    q.set("days", String(nextDays));
    q.set("from", nextFrom);
    router.push(`/staffing?${q.toString()}`);
  }

  function markUnavailable(person: StaffingPerson, dateKey: string) {
    const key = `mark:${dateKey}:${person.id}`;
    setActionError(null);
    setBusyKey(key);
    startTransition(async () => {
      const result = await markStaffUnavailableAction({
        userId: person.id,
        dateKey,
      });
      setBusyKey(null);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function clearUnavailable(requestId: string, dateKey: string) {
    const key = `clear:${dateKey}:${requestId}`;
    setActionError(null);
    setBusyKey(key);
    startTransition(async () => {
      const result = await clearStaffUnavailableAction({ requestId });
      setBusyKey(null);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Staffing / coverage
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Next {dayCount} days — who’s available, who’s off, calendar load, and
          AV jobs that still need confirmed crew. Mark someone unavailable to
          supersede the default-available rule; clear single-day Hub marks
          here. {isAdmin ? "Admins and Leads." : "Lead access."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            disabled={!startKey}
            onClick={() => startKey && goWindow(shiftDateKey(startKey, -7))}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-50"
          >
            ← Prev week
          </button>
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              const y = today.getFullYear();
              const m = String(today.getMonth() + 1).padStart(2, "0");
              const d = String(today.getDate()).padStart(2, "0");
              goWindow(`${y}-${m}-${d}`, 28);
            }}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface)]"
          >
            Today · 28 days
          </button>
          <button
            type="button"
            disabled={!startKey}
            onClick={() => startKey && goWindow(shiftDateKey(startKey, 7))}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-50"
          >
            Next week →
          </button>
          <label className="ml-1 flex items-center gap-1.5 text-xs text-[var(--muted)]">
            Horizon
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)]"
              value={dayCount}
              onChange={(e) => {
                if (!startKey) return;
                goWindow(startKey, Number(e.target.value));
              }}
            >
              <option value={14}>14 days</option>
              <option value={28}>28 days</option>
              <option value={42}>42 days</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {!icalConfigured
            ? "Pipeline calendar is not connected — event load will be empty. Set it on Calendar."
            : icalError
              ? `Calendar feed error: ${icalError}`
              : "Event load from the shared Pipeline calendar."}{" "}
          {unmatchedFeedTimeOff > 0 ? (
            <span className="text-amber-800 dark:text-amber-200">
              {unmatchedFeedTimeOff} feed time-off row
              {unmatchedFeedTimeOff === 1 ? "" : "s"} couldn’t match a Hub
              profile (check People names vs the calendar feed).{" "}
            </span>
          ) : null}
          <Link href="/time-off" className="text-[var(--brand)] hover:underline">
            Time Off
          </Link>
          {" · "}
          <Link href="/calendar" className="text-[var(--brand)] hover:underline">
            Calendar
          </Link>
          {" · "}
          <Link
            href="/rentals/crew"
            className="text-[var(--brand)] hover:underline"
          >
            AV Crew
          </Link>
        </p>
        {actionError ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            {actionError}
          </p>
        ) : null}
      </header>

      <ul className="space-y-4">
        {days.map((day) => (
          <li
            key={day.dateKey}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                {fmtHeading(day.dateKey, day.weekdayLabel)}
              </h2>
              <p className="text-xs text-[var(--muted)]">
                {day.events.length} event{day.events.length === 1 ? "" : "s"} ·{" "}
                {day.available.length} available · {day.onTimeOff.length} off
                {day.needsCrew.length > 0
                  ? ` · ${day.needsCrew.length} need crew`
                  : ""}
                {" · "}
                <Link
                  href={`/rentals/crew?date=${day.dateKey}`}
                  className="text-[var(--brand)] hover:underline"
                >
                  AV crew this day
                </Link>
              </p>
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="mb-1 text-[10px] font-semibold tracking-[0.1em] text-[var(--muted)] uppercase">
                  Available
                </p>
                {day.available.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">
                    Everyone is on time off this day.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {day.available.map((p) => {
                      const key = `mark:${day.dateKey}:${p.id}`;
                      const busy = pending && busyKey === key;
                      return (
                        <li
                          key={p.id}
                          className="flex items-baseline justify-between gap-2 text-sm text-[var(--foreground)]"
                        >
                          <span>
                            {p.full_name}
                            {p.departments.length > 0 ? (
                              <span className="text-[var(--muted)]">
                                {" "}
                                · {p.departments.join(", ")}
                              </span>
                            ) : null}
                          </span>
                          {canEdit ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => markUnavailable(p, day.dateKey)}
                              className="shrink-0 text-[11px] font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline disabled:opacity-50"
                            >
                              {busy ? "Saving…" : "Unavailable"}
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold tracking-[0.1em] text-[var(--muted)] uppercase">
                  Time off
                </p>
                {day.onTimeOff.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">Nobody off.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {day.onTimeOff.map(
                      ({ person, type, sources, hubRequestId, clearable }) => {
                        const key = hubRequestId
                          ? `clear:${day.dateKey}:${hubRequestId}`
                          : null;
                        const busy = Boolean(
                          key && pending && busyKey === key,
                        );
                        return (
                          <li
                            key={person.id}
                            className="flex items-baseline justify-between gap-2 text-sm text-[var(--foreground)]"
                          >
                            <span>
                              {person.full_name}
                              <span className="text-[var(--muted)]">
                                {" "}
                                · {timeOffTypeLabel(type as TimeOffType)}
                                {" · "}
                                {sourceHint(sources)}
                              </span>
                            </span>
                            {canEdit && clearable && hubRequestId ? (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                  clearUnavailable(hubRequestId, day.dateKey)
                                }
                                className="shrink-0 text-[11px] font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline disabled:opacity-50"
                              >
                                {busy ? "Clearing…" : "Clear Hub"}
                              </button>
                            ) : null}
                          </li>
                        );
                      },
                    )}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold tracking-[0.1em] text-[var(--muted)] uppercase">
                  Events
                </p>
                {day.events.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">No events.</p>
                ) : (
                  <ul className="space-y-1">
                    {day.events.map((e, idx) => (
                      <li
                        key={`${e.start}-${idx}`}
                        className="text-sm text-[var(--foreground)]"
                      >
                        {e.title}
                        {e.venue ? (
                          <span className="block text-xs text-[var(--muted)]">
                            {e.venue}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold tracking-[0.1em] text-[var(--muted)] uppercase">
                  Needs crew
                </p>
                {day.needsCrew.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">
                    No open AV jobs without confirmed crew.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {day.needsCrew.map((n) => (
                      <li key={n.opportunityId} className="text-sm">
                        <Link
                          href={`${n.href}&date=${day.dateKey}`}
                          className="font-medium text-[var(--brand)] hover:underline"
                        >
                          {n.reference}
                        </Link>
                        <span className="block text-xs text-[var(--muted)]">
                          {n.subject}
                          {n.status === "order" ? " · Order" : " · Quotation"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
