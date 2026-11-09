"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import {
  AV_OPPORTUNITY_STATUS_LABELS,
  type AvOpportunityStatus,
} from "@/lib/av-erp/types";
import {
  coveredDaysInMonth,
  endOfMonthUtc,
  jobsInRange,
  startOfMonthUtc,
  type GearJobWindow,
} from "@/lib/av-erp/ops-schedule";

type Props = { jobs: GearJobWindow[]; initialYear: number; initialMonth: number };

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-zinc-400/80",
  quotation: "bg-sky-500/80",
  order: "bg-[var(--brand)]/80",
  closed: "bg-zinc-500/50",
};

export function GearCalendarClient({
  jobs,
  initialYear,
  initialMonth,
}: Props) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const monthJobs = useMemo(
    () =>
      jobsInRange(jobs, startOfMonthUtc(year, month), endOfMonthUtc(year, month)),
    [jobs, year, month],
  );

  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, 1)));

  function shift(delta: number) {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  }

  return (
    <AvErpPage maxWidthClassName="max-w-5xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Gear calendar</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            What is out, and when — Hub jobs spanning their gear window
            (Eastern days).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            ←
          </button>
          <span className="min-w-[10rem] text-center text-sm font-semibold">
            {label}
          </span>
          <button
            type="button"
            onClick={() => shift(1)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            →
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-[var(--muted)] sm:text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <MonthGrid
        year={year}
        month={month}
        daysInMonth={daysInMonth}
        jobs={monthJobs}
      />

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Out this month</h2>
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {monthJobs.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              No Hub jobs with gear dates in this month.
            </li>
          ) : (
            monthJobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/rentals/quotes/${job.id}`}
                  className="flex flex-col gap-0.5 px-4 py-3 hover:bg-[var(--surface-hover)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {job.reference}{" "}
                      <span className="font-normal text-[var(--muted)]">
                        · {job.subject}
                      </span>
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {job.customerName ?? "No customer"}
                      {job.venueName ? ` · ${job.venueName}` : ""} ·{" "}
                      {AV_OPPORTUNITY_STATUS_LABELS[
                        job.status as AvOpportunityStatus
                      ] ?? job.status}
                      {job.hasHolds ? " · reserved" : ""}
                      {job.stillOut ? " · still out" : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>
    </AvErpPage>
  );
}

function MonthGrid({
  year,
  month,
  daysInMonth,
  jobs,
}: {
  year: number;
  month: number;
  daysInMonth: number;
  jobs: GearJobWindow[];
}) {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = new Map<number, GearJobWindow[]>();
  for (const job of jobs) {
    for (const day of coveredDaysInMonth(
      job.gearStartsAt,
      job.gearEndsAt,
      year,
      month,
    )) {
      const list = byDay.get(day) ?? [];
      list.push(job);
      byDay.set(day, list);
    }
  }

  return (
    <div className="grid grid-cols-7 gap-1">
      {cells.map((day, idx) => (
        <div
          key={idx}
          className="min-h-[4.5rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1"
        >
          {day != null ? (
            <>
              <p className="text-[11px] text-[var(--muted)]">{day}</p>
              <div className="mt-0.5 space-y-0.5">
                {(byDay.get(day) ?? []).slice(0, 3).map((job) => (
                  <Link
                    key={job.id}
                    href={`/rentals/quotes/${job.id}`}
                    title={`${job.reference} ${job.subject}`}
                    className={`block truncate rounded px-1 py-0.5 text-[10px] text-white ${STATUS_COLOR[job.status] ?? "bg-zinc-500"}`}
                  >
                    {job.reference}
                  </Link>
                ))}
                {(byDay.get(day) ?? []).length > 3 ? (
                  <p className="text-[10px] text-[var(--muted)]">
                    +{(byDay.get(day) ?? []).length - 3}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}
