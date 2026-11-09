"use client";

import { useMemo, useState } from "react";
import { CalendarOff, ChevronLeft, ChevronRight, TriangleAlert, Users } from "lucide-react";
import type { CalendarEvent } from "@/lib/calendar/events";
import { addDays, eventDayKey, gridDayKey, startOfWeek } from "@/lib/calendar/format";
import {
  weekdayKey,
  type StaffAvailabilityEntry,
  type TeamTimeOffRow,
} from "@/lib/calendar/availability";
import { timeOffTypeLabel, type TimeOffType } from "@/lib/types/time-off";

type Props = {
  staff: StaffAvailabilityEntry[];
  timeOff: TeamTimeOffRow[];
  events: CalendarEvent[];
};

type DayStatus = "available" | "booked" | "dayoff" | "none";
type Tab = "availability" | "timeoff" | "conflicts";

function fmtShort(day: Date): string {
  return day.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function nameMatches(assigned: string, fullName: string): boolean {
  const a = assigned.toLowerCase();
  const full = fullName.trim().toLowerCase();
  if (!full) return false;
  if (a.includes(full)) return true;
  const first = full.split(/\s+/)[0];
  if (first.length < 3) return false;
  return a.split(/[^a-z]+/).includes(first);
}

export function CalendarAvailability({ staff, timeOff, events }: Props) {
  const [tab, setTab] = useState<Tab>("availability");
  const [anchor, setAnchor] = useState<Date>(() => startOfWeek(new Date()));
  const [dept, setDept] = useState<string>("All");

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(anchor, i)),
    [anchor],
  );
  const weekStartKey = gridDayKey(weekDays[0]);
  const weekEndKey = gridDayKey(weekDays[6]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const s of staff) for (const d of s.departments) set.add(d);
    return ["All", ...Array.from(set).sort()];
  }, [staff]);

  const filteredStaff = useMemo(
    () =>
      (dept === "All" ? staff : staff.filter((s) => s.departments.includes(dept)))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [staff, dept],
  );

  // Approved time off ranges per user id.
  const timeOffByUser = useMemo(() => {
    const m = new Map<string, { start: string; end: string; type: string }[]>();
    for (const r of timeOff) {
      const list = m.get(r.user_id) ?? [];
      list.push({ start: r.start_date, end: r.end_date, type: r.type });
      m.set(r.user_id, list);
    }
    return m;
  }, [timeOff]);

  // Assigned-staff strings per day (work + HoneyBook events with Hub assignees).
  const assignedByDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of events) {
      if (
        (e.source !== "work" && e.source !== "honeybook") ||
        !e.assignedStaff
      ) {
        continue;
      }
      const key = eventDayKey(e.start);
      const list = m.get(key) ?? [];
      list.push(e.assignedStaff);
      m.set(key, list);
    }
    return m;
  }, [events]);

  function statusFor(s: StaffAvailabilityEntry, day: Date): DayStatus {
    const key = gridDayKey(day);
    const off = (timeOffByUser.get(s.id) ?? []).some(
      (r) => key >= r.start && key <= r.end,
    );
    if (off) return "dayoff";
    const assigned = assignedByDay.get(key) ?? [];
    const booked = assigned.some((a) => nameMatches(a, s.name));
    if (booked) return "booked";
    if (s.availableDays.includes(weekdayKey(day))) return "available";
    return "none";
  }

  const freePerDay = useMemo(
    () =>
      weekDays.map(
        (day) => filteredStaff.filter((s) => statusFor(s, day) === "available").length,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekDays, filteredStaff, timeOffByUser, assignedByDay],
  );

  const weekTimeOff = useMemo(
    () =>
      timeOff
        .filter((r) => r.end_date >= weekStartKey && r.start_date <= weekEndKey)
        .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [timeOff, weekStartKey, weekEndKey],
  );

  const conflicts = useMemo(() => {
    const out: string[] = [];
    const staffed = (e: CalendarEvent) =>
      (e.source === "work" || e.source === "honeybook") && e.assignedStaff;

    // Booked while on approved time off.
    for (const e of events) {
      if (!staffed(e) || !e.assignedStaff) continue;
      const key = eventDayKey(e.start);
      if (key < weekStartKey || key > weekEndKey) continue;
      for (const s of staff) {
        if (!nameMatches(e.assignedStaff, s.name)) continue;
        const off = (timeOffByUser.get(s.id) ?? []).some(
          (r) => key >= r.start && key <= r.end,
        );
        if (off) {
          out.push(`${s.name} is booked for “${e.title}” on ${fmtShort(new Date(`${key}T12:00:00Z`))} but has approved time off.`);
        }
      }
    }
    // Double-booked: same assigned staffer, 2+ events same day.
    const perStaffDay = new Map<string, number>();
    for (const e of events) {
      if (!staffed(e) || !e.assignedStaff) continue;
      const key = eventDayKey(e.start);
      if (key < weekStartKey || key > weekEndKey) continue;
      for (const s of staff) {
        if (nameMatches(e.assignedStaff, s.name)) {
          const k = `${s.id}|${key}`;
          perStaffDay.set(k, (perStaffDay.get(k) ?? 0) + 1);
        }
      }
    }
    for (const [k, n] of perStaffDay) {
      if (n >= 2) {
        const [id, key] = k.split("|");
        const s = staff.find((x) => x.id === id);
        if (s)
          out.push(`${s.name} is on ${n} events on ${fmtShort(new Date(`${key}T12:00:00Z`))} — check for a double-booking.`);
      }
    }
    return Array.from(new Set(out));
  }, [events, staff, timeOffByUser, weekStartKey, weekEndKey]);

  const rangeLabel = `${fmtShort(weekDays[0])} – ${fmtShort(weekDays[6])}`;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] px-4 py-2">
        {(
          [
            { id: "availability", label: "Staff Availability", icon: Users },
            { id: "timeoff", label: "Time Off", icon: CalendarOff },
            { id: "conflicts", label: "Conflicts", icon: TriangleAlert },
          ] as const
        ).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                active
                  ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.id === "conflicts" && conflicts.length > 0 ? (
                <span className="ml-1 rounded-full bg-red-100 px-1.5 text-[11px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                  {conflicts.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="p-4">
        {/* Week nav + department filter (shared by tabs) */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {departments.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDept(d)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  dept === d
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setAnchor((a) => addDays(a, -7))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)]" aria-label="Previous week">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setAnchor(startOfWeek(new Date()))} className="h-8 rounded-lg px-3 text-sm font-medium text-[var(--brand)] hover:bg-[var(--brand-soft)]">
              This week
            </button>
            <button type="button" onClick={() => setAnchor((a) => addDays(a, 7))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)]" aria-label="Next week">
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="ml-1 text-sm font-medium text-[var(--foreground)]">{rangeLabel}</span>
          </div>
        </div>

        {tab === "availability" ? (
          filteredStaff.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No staff match this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left font-medium text-[var(--muted)]">Staff</th>
                    {weekDays.map((day, i) => (
                      <th key={i} className="p-2 text-center font-medium">
                        <div className="text-[var(--foreground)]">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][day.getDay()]}</div>
                        <div className="text-xs text-[var(--muted)]">{fmtShort(day)}</div>
                        <div className="text-[11px] font-semibold text-[var(--brand)]">{freePerDay[i]} free</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((s) => (
                    <tr key={s.id} className="border-t border-[var(--border)]">
                      <td className="p-2 text-[var(--foreground)]">{s.name}</td>
                      {weekDays.map((day, i) => {
                        const st = statusFor(s, day);
                        const cell =
                          st === "available"
                            ? { t: "✓", c: "text-emerald-600 dark:text-emerald-400" }
                            : st === "booked"
                              ? { t: "✕", c: "text-red-600 dark:text-red-400" }
                              : st === "dayoff"
                                ? { t: "◐", c: "text-amber-600 dark:text-amber-400" }
                                : { t: "·", c: "text-[var(--muted)]/40" };
                        return (
                          <td key={i} className={`p-2 text-center text-base ${cell.c}`}>{cell.t}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
                <span><span className="text-emerald-600 dark:text-emerald-400">✓</span> Available</span>
                <span><span className="text-red-600 dark:text-red-400">✕</span> Booked</span>
                <span><span className="text-amber-600 dark:text-amber-400">◐</span> Day off</span>
              </div>
            </div>
          )
        ) : null}

        {tab === "timeoff" ? (
          weekTimeOff.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No approved time off this week.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {weekTimeOff.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">{r.full_name}</span>
                  <span className="text-sm text-[var(--muted)]">
                    {timeOffTypeLabel(r.type as TimeOffType)} · {fmtShort(new Date(`${r.start_date}T12:00:00Z`))}
                    {r.end_date !== r.start_date ? ` – ${fmtShort(new Date(`${r.end_date}T12:00:00Z`))}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === "conflicts" ? (
          conflicts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No conflicts detected this week.
              {events.filter(
                (e) =>
                  (e.source === "work" || e.source === "honeybook") &&
                  e.assignedStaff,
              ).length === 0
                ? " Assign staff on event cards to detect booking conflicts."
                : ""}
            </p>
          ) : (
            <ul className="space-y-2">
              {conflicts.map((c, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </section>
  );
}
