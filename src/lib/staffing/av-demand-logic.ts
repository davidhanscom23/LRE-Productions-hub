import {
  bookingOverlapsDateKey,
  isIsoDateKey,
} from "@/lib/av-erp/crew-date-filter";
import type { StaffingCrewNeed } from "@/lib/types/staffing";

export type AvDemandOpportunity = {
  id: string;
  reference: string;
  subject: string;
  status: string;
  gear_starts_at: string;
  gear_ends_at: string;
};

/** Quotation/order jobs with a gear window and no confirmed crew booking. */
export function opportunitiesNeedingCrew(
  opps: AvDemandOpportunity[],
  confirmedOpportunityIds: Iterable<string>,
): AvDemandOpportunity[] {
  const confirmed = new Set(confirmedOpportunityIds);
  return opps.filter((o) => {
    if (o.status !== "quotation" && o.status !== "order") return false;
    if (!o.gear_starts_at || !o.gear_ends_at) return false;
    return !confirmed.has(o.id);
  });
}

/** Expand gap jobs onto each YYYY-MM-DD they overlap within [fromKey, toKey]. */
export function expandNeedsByDate(
  gaps: AvDemandOpportunity[],
  fromKey: string,
  toKey: string,
): Map<string, StaffingCrewNeed[]> {
  const byDay = new Map<string, StaffingCrewNeed[]>();
  if (!isIsoDateKey(fromKey) || !isIsoDateKey(toKey)) return byDay;

  for (const o of gaps) {
    const need: StaffingCrewNeed = {
      opportunityId: o.id,
      reference: o.reference,
      subject: o.subject || "Untitled",
      status: o.status as "quotation" | "order",
      href: `/rentals/crew?opportunity=${o.id}`,
    };
    let cursor = o.gear_starts_at.slice(0, 10);
    const last = o.gear_ends_at.slice(0, 10);
    if (!isIsoDateKey(cursor) || !isIsoDateKey(last)) continue;
    if (cursor < fromKey) cursor = fromKey;
    const end = last > toKey ? toKey : last;
    while (cursor <= end) {
      if (bookingOverlapsDateKey(o.gear_starts_at, o.gear_ends_at, cursor)) {
        const list = byDay.get(cursor) ?? [];
        list.push(need);
        byDay.set(cursor, list);
      }
      const d = new Date(`${cursor}T12:00:00`);
      d.setDate(d.getDate() + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      cursor = `${y}-${m}-${day}`;
    }
  }

  for (const [k, list] of byDay) {
    list.sort((a, b) => a.reference.localeCompare(b.reference));
    byDay.set(k, list);
  }
  return byDay;
}

/** Dedupe gap jobs walking days in order (soonest first). */
export function flattenNeedsUnique(
  byDay: Map<string, StaffingCrewNeed[]>,
): StaffingCrewNeed[] {
  const seen = new Set<string>();
  const out: StaffingCrewNeed[] = [];
  for (const key of Array.from(byDay.keys()).sort()) {
    for (const need of byDay.get(key) ?? []) {
      if (seen.has(need.opportunityId)) continue;
      seen.add(need.opportunityId);
      out.push({
        ...need,
        href: `/rentals/crew?opportunity=${need.opportunityId}&date=${key}`,
      });
    }
  }
  return out;
}
