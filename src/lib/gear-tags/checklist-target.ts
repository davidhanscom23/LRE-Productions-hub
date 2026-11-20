/** Which line of an event's gear checklist a scanned piece should tick. */

export type TargetItem = {
  id: string;
  product_id: string | null;
  qty_needed: number;
  qty_out: number;
  qty_back: number;
  origin: "contract" | "manual";
  removed_at: string | null;
  returns: boolean;
};

export type OutTarget =
  | { kind: "use"; itemId: string }
  | { kind: "bump"; itemId: string; qtyNeeded: number }
  | { kind: "create" };

function live(items: TargetItem[], productId: string): TargetItem[] {
  return items.filter((i) => i.product_id === productId && !i.removed_at);
}

/**
 * A piece is leaving. Use a line for its product that still has room (estimate lines first).
 * When every line is full, grow a hand-added line by one, or ask for a new hand-added line.
 * Estimate lines are never grown: the estimate owns their quantity.
 */
export function pickOutTarget(items: TargetItem[], productId: string): OutTarget {
  const lines = live(items, productId);
  const open = lines
    .filter((i) => i.qty_out < i.qty_needed)
    .sort((a, b) => (a.origin === b.origin ? 0 : a.origin === "contract" ? -1 : 1));
  if (open[0]) return { kind: "use", itemId: open[0].id };

  const manual = lines.find((i) => i.origin === "manual");
  if (manual) return { kind: "bump", itemId: manual.id, qtyNeeded: manual.qty_needed + 1 };
  return { kind: "create" };
}

/** A piece is coming back. Tick a line for its product that still has something out. */
export function pickBackTarget(items: TargetItem[], productId: string): string | null {
  const line = live(items, productId).find((i) => i.returns && i.qty_back < i.qty_out);
  return line?.id ?? null;
}
