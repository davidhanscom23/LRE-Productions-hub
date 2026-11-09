import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GearJobWindow } from "@/lib/av-erp/ops-schedule";
import {
  stillOutByKey,
  type GearMovementRow,
} from "@/lib/av-erp/warehouse";

function customerName(raw: unknown): string | null {
  const v = raw as { name: string } | { name: string }[] | null | undefined;
  const row = Array.isArray(v) ? v[0] : v;
  return row?.name ?? null;
}

function venueName(raw: unknown): string | null {
  const v = raw as { name: string } | { name: string }[] | null | undefined;
  const row = Array.isArray(v) ? v[0] : v;
  return row?.name ?? null;
}

/** Open jobs with gear windows for calendar / planner / travel. */
export async function loadGearJobs(
  supabase: SupabaseClient,
): Promise<GearJobWindow[]> {
  const [oppsRes, holdsRes, movesRes] = await Promise.all([
    supabase
      .from("av_opportunities")
      .select(
        "id, reference, subject, status, gear_starts_at, gear_ends_at, av_customers ( name ), av_job_venues ( name )",
      )
      .not("gear_starts_at", "is", null)
      .not("gear_ends_at", "is", null)
      .in("status", ["draft", "quotation", "order"])
      .order("gear_starts_at", { ascending: true }),
    supabase.from("av_holds").select("opportunity_id"),
    supabase
      .from("av_gear_movements")
      .select("opportunity_id, product_id, direction, qty"),
  ]);

  if (oppsRes.error) throw new Error(oppsRes.error.message);

  const heldOppIds = new Set(
    (holdsRes.data ?? []).map((h) => h.opportunity_id as string),
  );
  const still = movesRes.error
    ? new Map<string, number>()
    : stillOutByKey((movesRes.data ?? []) as GearMovementRow[]);
  const stillOppIds = new Set(
    [...still.keys()].map((k) => k.split("::")[0]),
  );

  return (oppsRes.data ?? []).map((row) => ({
    id: row.id as string,
    reference: row.reference as string,
    subject: (row.subject as string) || "Untitled",
    status: row.status as string,
    gearStartsAt: row.gear_starts_at as string,
    gearEndsAt: row.gear_ends_at as string,
    customerName: customerName(row.av_customers),
    venueName: venueName(row.av_job_venues),
    hasHolds: heldOppIds.has(row.id as string),
    stillOut: stillOppIds.has(row.id as string),
  }));
}

export type ActivityRow = {
  id: string;
  subject: string;
  kind: string;
  due_at: string;
  opportunity_id: string | null;
  settled_at: string | null;
  notes: string;
  opportunity_reference: string | null;
  opportunity_subject: string | null;
  isOverdue: boolean;
};

export async function loadActivities(
  supabase: SupabaseClient,
  opts: { includeSettled?: boolean } = {},
): Promise<ActivityRow[]> {
  let q = supabase
    .from("av_activities")
    .select(
      "id, subject, kind, due_at, opportunity_id, settled_at, notes, av_opportunities ( reference, subject )",
    )
    .order("due_at", { ascending: true });
  if (!opts.includeSettled) {
    q = q.is("settled_at", null);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const nowMs = Date.now();
  return (data ?? []).map((row) => {
    const opp = row.av_opportunities as
      | { reference: string; subject: string }
      | { reference: string; subject: string }[]
      | null;
    const o = Array.isArray(opp) ? opp[0] : opp;
    const dueAt = row.due_at as string;
    const settledAt = (row.settled_at as string | null) ?? null;
    const dueMs = new Date(dueAt).getTime();
    return {
      id: row.id as string,
      subject: row.subject as string,
      kind: (row.kind as string) || "",
      due_at: dueAt,
      opportunity_id: (row.opportunity_id as string | null) ?? null,
      settled_at: settledAt,
      notes: (row.notes as string) || "",
      opportunity_reference: o?.reference ?? null,
      opportunity_subject: o?.subject ?? null,
      isOverdue: !settledAt && Number.isFinite(dueMs) && dueMs < nowMs,
    };
  });
}

export function activityCounts(
  activities: ActivityRow[],
  nowMs = Date.now(),
): { dueToday: number; overdue: number } {
  const tz = "America/New_York";
  const todayYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(nowMs));

  let dueToday = 0;
  let overdue = 0;
  for (const a of activities) {
    if (a.settled_at) continue;
    const due = new Date(a.due_at);
    if (Number.isNaN(due.getTime())) continue;
    const dueYmd = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(due);
    if (dueYmd === todayYmd) dueToday += 1;
    else if (due.getTime() < nowMs && dueYmd < todayYmd) overdue += 1;
  }
  return { dueToday, overdue };
}
