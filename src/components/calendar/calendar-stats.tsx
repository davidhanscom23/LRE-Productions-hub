"use client";

import { useMemo } from "react";
import { CalendarDays, CalendarRange, Flame, PieChart } from "lucide-react";
import type { CalendarEvent } from "@/lib/calendar/events";
import { eventDayKey, gridDayKey, startOfWeek, addDays } from "@/lib/calendar/format";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--muted)]">
          {label}
        </p>
        <p className="truncate text-lg font-semibold text-[var(--foreground)]">
          {value}
        </p>
        {sub ? <p className="truncate text-xs text-[var(--muted)]">{sub}</p> : null}
      </div>
    </div>
  );
}

export function CalendarStats({ events }: { events: CalendarEvent[] }) {
  const stats = useMemo(() => {
    const work = events.filter(
      (e) => e.source === "work" || e.source === "pipeline",
    );
    const now = new Date();
    const todayKey = eventDayKey(now.toISOString());
    const monthPrefix = todayKey.slice(0, 7);

    const weekStart = startOfWeek(now);
    const weekKeys = new Set(
      Array.from({ length: 7 }, (_, i) => gridDayKey(addDays(weekStart, i))),
    );

    let thisMonth = 0;
    let thisWeek = 0;
    const byDay = new Map<string, number>();
    const byType = new Map<string, number>();

    for (const e of work) {
      const key = eventDayKey(e.start);
      if (key.startsWith(monthPrefix)) thisMonth += 1;
      if (weekKeys.has(key)) thisWeek += 1;
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
      const type = (e.eventType ?? "").trim();
      if (type) byType.set(type, (byType.get(type) ?? 0) + 1);
    }

    let busiestKey = "";
    let busiestCount = 0;
    for (const [key, count] of byDay) {
      if (count > busiestCount) {
        busiestCount = count;
        busiestKey = key;
      }
    }
    const busiestLabel = busiestKey
      ? new Date(`${busiestKey}T12:00:00Z`).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : "—";

    const topType = Array.from(byType.entries()).sort((a, b) => b[1] - a[1])[0];

    return {
      thisMonth,
      thisWeek,
      busiestLabel,
      busiestCount,
      topType,
      typeCount: byType.size,
    };
  }, [events]);

  const monthLabel = new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="This month" value={String(stats.thisMonth)} sub={monthLabel} icon={CalendarDays} />
      <StatCard label="This week" value={String(stats.thisWeek)} sub="events booked" icon={CalendarRange} />
      <StatCard
        label="Busiest day"
        value={stats.busiestLabel}
        sub={stats.busiestCount > 0 ? `${stats.busiestCount} event${stats.busiestCount > 1 ? "s" : ""}` : "no events"}
        icon={Flame}
      />
      <StatCard
        label="Top event type"
        value={stats.topType ? stats.topType[0] : "—"}
        sub={
          stats.topType
            ? `${stats.topType[1]} · ${stats.typeCount} type${stats.typeCount > 1 ? "s" : ""}`
            : "no data"
        }
        icon={PieChart}
      />
    </div>
  );
}
