"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import {
  addDaysYmd,
  travelEventsForDay,
  type GearJobWindow,
} from "@/lib/av-erp/ops-schedule";

type Props = { jobs: GearJobWindow[]; todayYmd: string };

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
});

export function GearTravelClient({ jobs, todayYmd }: Props) {
  const [day, setDay] = useState(todayYmd);
  const events = useMemo(() => travelEventsForDay(jobs, day), [jobs, day]);

  return (
    <AvErpPage maxWidthClassName="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Travel</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Leave and return for the day (Eastern), in clock order. Shows
            reserved quotations, orders, and still-out jobs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDay(addDaysYmd(day, -1))}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            ←
          </button>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => setDay(todayYmd)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setDay(addDaysYmd(day, 1))}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            →
          </button>
        </div>
      </div>

      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {events.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            Nothing leaving or returning this day.
          </li>
        ) : (
          events.map((ev) => (
            <li key={`${ev.id}-${ev.bucket}`}>
              <Link
                href={`/rentals/quotes/${ev.id}`}
                className="flex flex-col gap-0.5 px-4 py-3 hover:bg-[var(--surface-hover)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    <span
                      className={
                        ev.bucket === "leave"
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-emerald-700 dark:text-emerald-300"
                      }
                    >
                      {ev.bucket === "leave" ? "Leave" : "Return"}
                    </span>{" "}
                    {TIME_FMT.format(new Date(ev.sortAt))} · {ev.reference}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {ev.subject}
                    {ev.venueName ? ` · ${ev.venueName}` : ""}
                    {ev.customerName ? ` · ${ev.customerName}` : ""}
                    {ev.stillOut ? " · still out" : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </AvErpPage>
  );
}
