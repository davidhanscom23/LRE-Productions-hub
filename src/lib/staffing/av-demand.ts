import "server-only";

import { isIsoDateKey } from "@/lib/av-erp/crew-date-filter";
import {
  expandNeedsByDate,
  flattenNeedsUnique,
  opportunitiesNeedingCrew,
  type AvDemandOpportunity,
} from "@/lib/staffing/av-demand-logic";
import type { StaffingCrewNeed } from "@/lib/types/staffing";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Load AV quotation/order jobs in the window that still need confirmed crew.
 * Safe for admin/Lead Staffing viewers (RLS allows staff SELECT).
 */
export async function loadAvCrewDemandByDay(
  supabase: SupabaseClient,
  fromKey: string,
  toKey: string,
): Promise<Map<string, StaffingCrewNeed[]>> {
  if (!isIsoDateKey(fromKey) || !isIsoDateKey(toKey)) {
    return new Map();
  }

  const fromIso = `${fromKey}T00:00:00.000Z`;
  const toIso = `${toKey}T23:59:59.999Z`;

  const { data: oppRows, error: oppErr } = await supabase
    .from("av_opportunities")
    .select("id, reference, subject, status, gear_starts_at, gear_ends_at")
    .in("status", ["quotation", "order"])
    .not("gear_starts_at", "is", null)
    .not("gear_ends_at", "is", null)
    .lte("gear_starts_at", toIso)
    .gte("gear_ends_at", fromIso)
    .order("gear_starts_at", { ascending: true })
    .limit(200);

  if (oppErr || !oppRows?.length) {
    return new Map();
  }

  const opps: AvDemandOpportunity[] = oppRows.map((r) => ({
    id: r.id as string,
    reference: String(r.reference ?? ""),
    subject: String(r.subject ?? ""),
    status: String(r.status ?? ""),
    gear_starts_at: String(r.gear_starts_at ?? ""),
    gear_ends_at: String(r.gear_ends_at ?? ""),
  }));

  const ids = opps.map((o) => o.id);
  const { data: bookingRows } = await supabase
    .from("av_contractor_bookings")
    .select("opportunity_id, status")
    .in("opportunity_id", ids)
    .eq("status", "confirmed");

  const confirmed = new Set(
    (bookingRows ?? []).map((b) => b.opportunity_id as string),
  );
  const gaps = opportunitiesNeedingCrew(opps, confirmed);
  return expandNeedsByDate(gaps, fromKey, toKey);
}

/** Flat list of unique gap jobs for For You (next N days). */
export async function listAvCrewCoverageGaps(
  supabase: SupabaseClient,
  options?: { days?: number },
): Promise<StaffingCrewNeed[]> {
  const dayCount = options?.days ?? 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + dayCount - 1);
  const fromKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  const toKey = [
    end.getFullYear(),
    String(end.getMonth() + 1).padStart(2, "0"),
    String(end.getDate()).padStart(2, "0"),
  ].join("-");

  const byDay = await loadAvCrewDemandByDay(supabase, fromKey, toKey);
  return flattenNeedsUnique(byDay);
}
