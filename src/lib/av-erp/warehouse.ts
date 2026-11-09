/** Warehouse still-out / checkout remaining helpers (pure). */

export type GearMovementDirection = "out" | "back";

export type GearMovementRow = {
  opportunity_id: string;
  product_id: string;
  direction: GearMovementDirection;
  qty: number;
};

export type HoldQtyRow = {
  opportunity_id: string;
  product_id: string;
  qty: number;
};

export function movementKey(opportunityId: string, productId: string): string {
  return `${opportunityId}::${productId}`;
}

/** Net qty still out per opportunity × product (never negative). */
export function stillOutByKey(
  movements: GearMovementRow[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of movements) {
    const key = movementKey(m.opportunity_id, m.product_id);
    const prev = map.get(key) ?? 0;
    const delta = m.direction === "out" ? m.qty : -m.qty;
    map.set(key, prev + delta);
  }
  for (const [k, v] of map) {
    if (v <= 0) map.delete(k);
    else map.set(k, Math.round(v * 100) / 100);
  }
  return map;
}

/** Held qty summed per opportunity × product. */
export function heldByKey(holds: HoldQtyRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const h of holds) {
    const key = movementKey(h.opportunity_id, h.product_id);
    map.set(key, (map.get(key) ?? 0) + h.qty);
  }
  return map;
}

/** How much more can still be checked out against holds. */
export function remainingToCheckOut(
  heldQty: number,
  stillOutQty: number,
): number {
  return Math.max(0, Math.round((heldQty - stillOutQty) * 100) / 100);
}

/** Total qty currently out across all jobs for one product. */
export function productQtyOut(
  movements: GearMovementRow[],
  productId: string,
): number {
  let net = 0;
  for (const m of movements) {
    if (m.product_id !== productId) continue;
    net += m.direction === "out" ? m.qty : -m.qty;
  }
  return Math.max(0, Math.round(net * 100) / 100);
}

export function isOverdue(
  stillOutQty: number,
  gearEndsAt: string | null,
  nowMs = Date.now(),
): boolean {
  if (stillOutQty <= 0 || !gearEndsAt) return false;
  const end = new Date(gearEndsAt).getTime();
  if (!Number.isFinite(end)) return false;
  return end < nowMs;
}
