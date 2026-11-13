import "server-only";

import {
  getCachedIcalPartition,
  type CalendarEvent,
  type FeedTimeOffAbsence,
} from "@/lib/calendar/events";
import { getSharedWorkIcalUrl } from "@/lib/calendar/settings";
import { matchAssignedStaffProfiles } from "@/lib/event-packets/match-staff";
import { loadAvCrewDemandByDay } from "@/lib/staffing/av-demand";
import type {
  DayCoverage,
  StaffingPerson,
  TimeOffSource,
} from "@/lib/types/staffing";
import type { TeamTimeOff, TimeOffType } from "@/lib/types/time-off";
import { WEEKDAYS } from "@/lib/types/time-off";
import type { SupabaseClient } from "@supabase/supabase-js";

function dateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function weekdayKeyFromDate(d: Date): string {
  return WEEKDAYS[d.getDay()]?.key ?? "sun";
}

function inRange(dateKey: string, start: string, end: string): boolean {
  return dateKey >= start && dateKey <= end;
}

function eventDateKey(iso: string): string {
  return dateKeyLocal(new Date(iso));
}

function coerceTimeOffType(raw: string | null | undefined): TimeOffType {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "vacation" || t === "sick" || t === "personal" || t === "unavailable") {
    return t;
  }
  if (t.includes("vacation") || t.includes("pto") || t.includes("holiday")) {
    return "vacation";
  }
  if (t.includes("sick")) return "sick";
  if (t.includes("personal")) return "personal";
  if (t.includes("unavailable") || t.includes("time off")) return "unavailable";
  return "other";
}

type MergedOff = {
  person: StaffingPerson;
  type: TimeOffType;
  sources: TimeOffSource[];
  hubRequestId: string | null;
  hubStart: string | null;
  hubEnd: string | null;
};

/**
 * Match a planner absence row to Hub profiles. Prefer assigned-staff slot; fall
 * back to the full summary string for name tokens.
 */
function matchFeedAbsencePeople(
  absence: FeedTimeOffAbsence,
  profiles: StaffingPerson[],
): StaffingPerson[] {
  const matchable = profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    is_active: true,
  }));

  const primary = matchAssignedStaffProfiles(
    absence.assignedStaff,
    matchable,
  );
  if (primary.length > 0) {
    return primary
      .map((m) => profiles.find((p) => p.id === m.id))
      .filter((p): p is StaffingPerson => Boolean(p));
  }

  // Summary often embeds the staff name near "Time Off".
  const fromSummary = matchAssignedStaffProfiles(
    absence.summary,
    matchable,
  );
  return fromSummary
    .map((m) => profiles.find((p) => p.id === m.id))
    .filter((p): p is StaffingPerson => Boolean(p));
}

/**
 * Build next N days of coverage from Hub + planner time off (de-duped) and planner
 * work events. Active staff default to available unless they are on Hub or
 * planner time off for that day — weekly availability patterns are not required.
 */
export async function buildStaffingCoverage(
  supabase: SupabaseClient,
  options?: { days?: number; fromDate?: string },
): Promise<{
  days: DayCoverage[];
  icalConfigured: boolean;
  icalError: string | null;
  unmatchedFeedTimeOff: number;
}> {
  const dayCount = options?.days ?? 28;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let start = today;
  if (options?.fromDate && /^\d{4}-\d{2}-\d{2}$/.test(options.fromDate)) {
    const parsed = new Date(`${options.fromDate}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      start = parsed;
    }
  }
  const end = addDays(start, dayCount - 1);
  const fromKey = dateKeyLocal(start);
  const toKey = dateKeyLocal(end);

  const [{ data: profiles }, { data: timeOffRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, departments")
      .eq("is_active", true)
      .neq("role", "guest")
      .order("full_name", { ascending: true }),
    supabase.rpc("list_team_time_off", {
      from_date: fromKey,
      to_date: toKey,
    }),
  ]);

  const people: StaffingPerson[] = (profiles ?? []).map((p) => ({
    id: p.id as string,
    full_name: (p.full_name as string) || (p.email as string) || "Staff",
    email: (p.email as string) ?? "",
    departments: Array.isArray(p.departments)
      ? (p.departments as string[])
      : [],
  }));
  const byId = new Map(people.map((p) => [p.id, p]));

  const teamOff = (timeOffRows ?? []) as TeamTimeOff[];

  let events: CalendarEvent[] = [];
  let feedAbsences: FeedTimeOffAbsence[] = [];
  let icalConfigured = false;
  let icalError: string | null = null;
  let unmatchedFeedTimeOff = 0;

  const icalUrl = await getSharedWorkIcalUrl();
  if (icalUrl) {
    icalConfigured = true;
    try {
      const partition = await getCachedIcalPartition(icalUrl);
      events = partition.workEvents;
      feedAbsences = partition.timeOff.filter(
        (a) => a.endDate >= fromKey && a.startDate <= toKey,
      );
    } catch (err) {
      icalError =
        err instanceof Error ? err.message : "Could not load company calendar.";
    }
  }

  // Pre-expand planner absences → personId → dateKeys + type
  const feedOffByDay = new Map<
    string,
    Map<string, { type: TimeOffType; label: string }>
  >();
  for (const absence of feedAbsences) {
    const matched = matchFeedAbsencePeople(absence, people);
    if (matched.length === 0) {
      unmatchedFeedTimeOff += 1;
      continue;
    }
    const type = coerceTimeOffType(absence.eventType);
    for (const person of matched) {
      // Walk inclusive date keys within the board window.
      let cursor = absence.startDate < fromKey ? fromKey : absence.startDate;
      const last = absence.endDate > toKey ? toKey : absence.endDate;
      while (cursor <= last) {
        const dayMap = feedOffByDay.get(cursor) ?? new Map();
        if (!dayMap.has(person.id)) {
          dayMap.set(person.id, { type, label: person.full_name });
        }
        feedOffByDay.set(cursor, dayMap);
        const d = new Date(`${cursor}T12:00:00`);
        d.setDate(d.getDate() + 1);
        cursor = dateKeyLocal(d);
      }
    }
  }

  let needsByDay = new Map<
    string,
    DayCoverage["needsCrew"]
  >();
  try {
    needsByDay = await loadAvCrewDemandByDay(supabase, fromKey, toKey);
  } catch {
    // AV tables may be missing pre-migration — Staffing still works.
    needsByDay = new Map();
  }

  const days: DayCoverage[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = addDays(start, i);
    const key = dateKeyLocal(d);
    const wd = weekdayKeyFromDate(d);
    const wdLabel = WEEKDAYS.find((w) => w.key === wd)?.label ?? wd;

    const merged = new Map<string, MergedOff>();

    for (const row of teamOff) {
      if (!inRange(key, row.start_date, row.end_date)) continue;
      const person = byId.get(row.user_id);
      if (!person) continue;
      merged.set(person.id, {
        person,
        type: row.type,
        sources: ["hub"],
        hubRequestId: row.id,
        hubStart: row.start_date,
        hubEnd: row.end_date,
      });
    }

    const feedDay = feedOffByDay.get(key);
    if (feedDay) {
      for (const [personId, info] of feedDay) {
        const existing = merged.get(personId);
        if (existing) {
          if (!existing.sources.includes("feed")) {
            existing.sources.push("feed");
          }
          // Prefer Hub type when both present.
        } else {
          const person = byId.get(personId);
          if (!person) continue;
          merged.set(personId, {
            person,
            type: info.type,
            sources: ["feed"],
            hubRequestId: null,
            hubStart: null,
            hubEnd: null,
          });
        }
      }
    }

    const onTimeOff = Array.from(merged.values())
      .map((row) => ({
        person: row.person,
        type: row.type,
        sources: row.sources,
        hubRequestId: row.hubRequestId,
        clearable: Boolean(
          row.hubRequestId &&
            row.hubStart &&
            row.hubEnd &&
            row.hubStart === row.hubEnd &&
            row.hubStart === key,
        ),
      }))
      .sort((a, b) => a.person.full_name.localeCompare(b.person.full_name));
    const offIds = new Set(onTimeOff.map((o) => o.person.id));

    // Default available: every active staffer not on Hub or planner time off.
    const available = people
      .filter((person) => !offIds.has(person.id))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    const dayEvents = events
      .filter((e) => eventDateKey(e.start) === key)
      .map((e) => ({
        title: e.title || e.clientName || "Event",
        start: e.start,
        venue: e.venue || null,
      }));

    days.push({
      dateKey: key,
      weekdayKey: wd,
      weekdayLabel: wdLabel,
      available,
      onTimeOff,
      events: dayEvents,
      needsCrew: needsByDay.get(key) ?? [],
    });
  }

  return { days, icalConfigured, icalError, unmatchedFeedTimeOff };
}
