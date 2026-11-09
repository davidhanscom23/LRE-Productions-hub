"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import {
  AV_OPPORTUNITY_STATUS_LABELS,
  type AvOpportunityStatus,
} from "@/lib/av-erp/types";
import {
  addDaysYmd,
  ymdInZone,
  type GearJobWindow,
} from "@/lib/av-erp/ops-schedule";

type Props = { jobs: GearJobWindow[]; todayYmd: string };

const WEEKS = 4;

const STATUS_BAR: Record<string, string> = {
  draft: "bg-zinc-400",
  quotation: "bg-sky-500",
  order: "bg-[var(--brand)]",
  closed: "bg-zinc-500",
};

export function GearPlannerClient({ jobs, todayYmd }: Props) {
  const [anchor, setAnchor] = useState(todayYmd);

  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < WEEKS * 7; i++) out.push(addDaysYmd(anchor, i));
    return out;
  }, [anchor]);

  const endYmd = days[days.length - 1]!;

  const visible = useMemo(() => {
    return jobs.filter((j) => {
      const s = ymdInZone(j.gearStartsAt, "America/New_York");
      const e = ymdInZone(j.gearEndsAt, "America/New_York");
      return s <= endYmd && e >= anchor;
    });
  }, [jobs, anchor, endYmd]);

  function shiftWeeks(delta: number) {
    setAnchor(addDaysYmd(anchor, delta * 7));
  }

  return (
    <AvErpPage maxWidthClassName="max-w-5xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Planner</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Four weeks of Hub jobs by gear window. Color = status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftWeeks(-1)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            ← Week
          </button>
          <button
            type="button"
            onClick={() => setAnchor(todayYmd)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shiftWeeks(1)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Week →
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div
          className="grid min-w-[640px] gap-px bg-[var(--border)]"
          style={{ gridTemplateColumns: `10rem repeat(${days.length}, minmax(1.5rem, 1fr))` }}
        >
          <div className="bg-[var(--surface)] px-2 py-2 text-xs text-[var(--muted)]">
            Job
          </div>
          {days.map((d) => (
            <div
              key={d}
              className={`bg-[var(--surface)] px-0.5 py-2 text-center text-[10px] ${d === todayYmd ? "font-semibold text-[var(--brand)]" : "text-[var(--muted)]"}`}
            >
              {d.slice(8)}
            </div>
          ))}

          {visible.length === 0 ? (
            <div
              className="bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]"
              style={{ gridColumn: `1 / -1` }}
            >
              No jobs overlapping this window.
            </div>
          ) : (
            visible.map((job) => {
              const start = ymdInZone(job.gearStartsAt, "America/New_York");
              const end = ymdInZone(job.gearEndsAt, "America/New_York");
              const startIdx = Math.max(
                0,
                days.findIndex((d) => d >= start),
              );
              let endIdx = days.findIndex((d) => d > end);
              if (endIdx === -1) endIdx = days.length;
              const span = Math.max(1, endIdx - startIdx);
              return (
                <div key={job.id} className="contents">
                  <Link
                    href={`/rentals/quotes/${job.id}`}
                    className="truncate bg-[var(--surface)] px-2 py-2 text-xs font-medium hover:underline"
                  >
                    {job.reference}
                  </Link>
                  <div
                    className="relative bg-[var(--surface)]"
                    style={{ gridColumn: `2 / -1` }}
                  >
                    <div
                      className="absolute inset-y-1 rounded"
                      style={{
                        left: `calc(${(startIdx / days.length) * 100}% + 2px)`,
                        width: `calc(${(span / days.length) * 100}% - 4px)`,
                      }}
                    >
                      <Link
                        href={`/rentals/quotes/${job.id}`}
                        className={`flex h-full items-center truncate rounded px-1 text-[10px] text-white ${STATUS_BAR[job.status] ?? "bg-zinc-500"}`}
                        title={`${job.subject} · ${AV_OPPORTUNITY_STATUS_LABELS[job.status as AvOpportunityStatus] ?? job.status}`}
                      >
                        {job.subject}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AvErpPage>
  );
}
