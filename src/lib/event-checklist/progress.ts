/** Pure progress math for the event gear checklist. */
import type { ChecklistItem, ChecklistPass, ChecklistSource } from "./types";

export type PassTotals = {
  needed: number;
  done: number;
  /** Whole percent, rounded down so 99.6% never reads as 100%. */
  percent: number;
  complete: boolean;
  /** Items that still need something for this pass. */
  remainingItems: number;
};

export type ItemState = "none" | "partial" | "done";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isActive(item: Pick<ChecklistItem, "removed_at">): boolean {
  return !item.removed_at;
}

/** Does this item count toward the given pass? Sold / used-up items only need the OUT check. */
export function countsForPass(
  item: Pick<ChecklistItem, "returns" | "removed_at">,
  pass: ChecklistPass,
): boolean {
  if (!isActive(item)) return false;
  return pass === "out" ? true : item.returns;
}

export function checkedQty(
  item: Pick<ChecklistItem, "qty_out" | "qty_back">,
  pass: ChecklistPass,
): number {
  return Math.max(0, pass === "out" ? item.qty_out : item.qty_back);
}

export function itemState(
  item: Pick<ChecklistItem, "qty_needed" | "qty_out" | "qty_back">,
  pass: ChecklistPass,
): ItemState {
  const done = checkedQty(item, pass);
  if (done <= 0) return "none";
  return done >= item.qty_needed ? "done" : "partial";
}

export function passTotals(
  items: Pick<
    ChecklistItem,
    "returns" | "removed_at" | "qty_needed" | "qty_out" | "qty_back"
  >[],
  pass: ChecklistPass,
): PassTotals {
  let needed = 0;
  let done = 0;
  let remainingItems = 0;
  for (const item of items) {
    if (!countsForPass(item, pass)) continue;
    needed += item.qty_needed;
    const checked = Math.min(item.qty_needed, checkedQty(item, pass));
    done += checked;
    if (checked < item.qty_needed) remainingItems += 1;
  }
  needed = round2(needed);
  done = round2(done);
  const percent = needed <= 0 ? 0 : Math.floor((done / needed) * 100);
  return {
    needed,
    done,
    percent,
    complete: needed > 0 && remainingItems === 0,
    remainingItems,
  };
}

/** Items that still need checking for this pass, with how many are left. */
export function stillNeeded<
  T extends Pick<
    ChecklistItem,
    "returns" | "removed_at" | "qty_needed" | "qty_out" | "qty_back"
  >,
>(items: T[], pass: ChecklistPass): (T & { remaining: number })[] {
  const out: (T & { remaining: number })[] = [];
  for (const item of items) {
    if (!countsForPass(item, pass)) continue;
    const remaining = round2(item.qty_needed - checkedQty(item, pass));
    if (remaining > 0) out.push({ ...item, remaining });
  }
  return out;
}

/**
 * The most that can be recorded in one action: up to what is still needed when checking,
 * down to what is already checked when undoing. Returns the allowed (clamped) change.
 */
export function clampDelta(
  item: Pick<ChecklistItem, "qty_needed" | "qty_out" | "qty_back">,
  pass: ChecklistPass,
  delta: number,
): number {
  const current = checkedQty(item, pass);
  const next = Math.min(item.qty_needed, Math.max(0, current + delta));
  return round2(next - current);
}

/** Where a returned item goes. Our gear returns to the warehouse; the rest go back to their owner. */
export function returnVerb(source: ChecklistSource): string {
  if (source === "in_house") return "Back in warehouse";
  if (source === "client_supplied") return "Returned to client";
  return "Returned to vendor";
}

export function outVerb(source: ChecklistSource): string {
  if (source === "in_house") return "Out of warehouse";
  if (source === "client_supplied") return "Received from client";
  return "Picked up from vendor";
}
