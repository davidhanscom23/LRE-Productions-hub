/** Free-to-promise helpers for product holds over a gear window. */

export type HoldWindow = {
  product_id: string;
  qty: number;
  starts_at: string;
  ends_at: string;
  opportunity_id?: string;
};

export function windowsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  if (![as, ae, bs, be].every(Number.isFinite)) return false;
  return as < be && bs < ae;
}

/** Extend an ISO end by turnaround hours (post-rent unavailability). */
export function extendEndByTurnaround(
  endsAt: string,
  turnaroundHours: number,
): string {
  const hours = Math.max(0, turnaroundHours || 0);
  if (hours === 0) return endsAt;
  const t = new Date(endsAt).getTime();
  if (!Number.isFinite(t)) return endsAt;
  return new Date(t + hours * 60 * 60 * 1000).toISOString();
}

/** Qty available after buffer, before holds. */
export function quotableOwned(qtyOwned: number, bufferPct: number): number {
  const buffer = Math.min(100, Math.max(0, bufferPct)) / 100;
  return Math.max(0, qtyOwned * (1 - buffer));
}

/**
 * Free qty for a product in [startsAt, endsAt], excluding holds on
 * `excludeOpportunityId` (this quote’s own reservations).
 */
export function freeQtyForWindow(input: {
  qtyOwned: number;
  bufferPct: number;
  startsAt: string;
  endsAt: string;
  holds: HoldWindow[];
  excludeOpportunityId?: string;
  /** Applied to this quote’s window and each hold’s end when checking overlap. */
  turnaroundHours?: number;
}): number {
  const turnaround = Math.max(0, input.turnaroundHours ?? 0);
  const needEnd = extendEndByTurnaround(input.endsAt, turnaround);
  const base = quotableOwned(input.qtyOwned, input.bufferPct);
  let held = 0;
  for (const h of input.holds) {
    if (
      input.excludeOpportunityId &&
      h.opportunity_id === input.excludeOpportunityId
    ) {
      continue;
    }
    const holdEnd = extendEndByTurnaround(h.ends_at, turnaround);
    if (windowsOverlap(input.startsAt, needEnd, h.starts_at, holdEnd)) {
      held += h.qty;
    }
  }
  return Math.max(0, base - held);
}

export function shortageForLine(input: {
  qtyNeeded: number;
  qtyOwned: number;
  bufferPct: number;
  startsAt: string | null;
  endsAt: string | null;
  holds: HoldWindow[];
  excludeOpportunityId?: string;
  turnaroundHours?: number;
}): { free: number; shortage: number } | null {
  if (!input.startsAt || !input.endsAt) return null;
  const free = freeQtyForWindow({
    qtyOwned: input.qtyOwned,
    bufferPct: input.bufferPct,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    holds: input.holds,
    excludeOpportunityId: input.excludeOpportunityId,
    turnaroundHours: input.turnaroundHours,
  });
  return { free, shortage: Math.max(0, input.qtyNeeded - free) };
}

/**
 * How much to reserve when confirming past a shortage.
 * Reserves available free qty; short qty stays unreserved.
 */
export function reserveQtyForShortage(
  qtyNeeded: number,
  free: number,
): { reserve: number; short: number } {
  const needed = Math.max(0, qtyNeeded);
  const available = Math.max(0, free);
  const reserve = Math.min(needed, available);
  return { reserve, short: Math.max(0, needed - reserve) };
}
