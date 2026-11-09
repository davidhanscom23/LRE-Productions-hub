/** Apply queued (not yet synced) operations on top of the last known board, so the page looks current offline. */
import { clampDelta } from "../progress";
import type { ChecklistHistoryRow, ChecklistItem } from "../types";
import type { OpPayloads, QueuedOp } from "./ops";

export function applyPending(
  items: ChecklistItem[],
  ops: Pick<QueuedOp, "kind" | "payload" | "checklistId">[],
): ChecklistItem[] {
  let list = items.map((i) => ({ ...i }));
  for (const op of ops) {
    if (op.kind === "addItem") {
      const p = op.payload as OpPayloads["addItem"];
      if (list.some((i) => i.id === p.id)) continue;
      list.push({
        id: p.id,
        checklist_id: p.checklistId,
        product_id: p.productId ?? null,
        name: p.name,
        qty_needed: p.qty,
        source: p.source,
        returns: p.returns ?? true,
        note: "",
        sort_order: 10000,
        origin: "manual",
        removed_at: null,
        qty_out: 0,
        qty_back: 0,
      });
    } else if (op.kind === "removeItem") {
      const p = op.payload as OpPayloads["removeItem"];
      list = list.map((i) => (i.id === p.itemId ? { ...i, removed_at: i.removed_at ?? new Date(0).toISOString() } : i));
    } else if (op.kind === "setSource") {
      const p = op.payload as OpPayloads["setSource"];
      list = list.map((i) => (i.id === p.itemId ? { ...i, source: p.source } : i));
    } else if (op.kind === "check") {
      const p = op.payload as OpPayloads["check"];
      list = list.map((i) => {
        if (i.id !== p.itemId) return i;
        const delta = clampDelta(i, p.pass, p.qty);
        return p.pass === "out"
          ? { ...i, qty_out: Math.round((i.qty_out + delta) * 100) / 100 }
          : { ...i, qty_back: Math.round((i.qty_back + delta) * 100) / 100 };
      });
    }
  }
  return list;
}

/** History lines for checks that are saved on this device but not on the server yet. */
export function pendingHistory(
  items: Pick<ChecklistItem, "id" | "name">[],
  ops: QueuedOp[],
  whoName: string,
): ChecklistHistoryRow[] {
  const names = new Map(items.map((i) => [i.id, i.name]));
  return ops
    .filter((o) => o.kind === "check")
    .map((o) => {
      const p = o.payload as OpPayloads["check"];
      return {
        id: `pending-${o.clientId}`,
        item_id: p.itemId,
        pass: p.pass,
        qty: p.qty,
        flag: p.flag ?? "none",
        note: p.note ?? "",
        photo_path: p.photoPath ?? (o.photoKey ? "pending" : null),
        checked_at: new Date(o.createdAt).toISOString(),
        checked_by_name: whoName,
        item_name: names.get(p.itemId) ?? "",
      };
    })
    .reverse();
}
