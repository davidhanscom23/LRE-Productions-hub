import { describe, expect, it } from "vitest";
import type { ChecklistItem } from "../types";
import { applyPending, pendingHistory } from "./optimistic";
import type { QueuedOp } from "./ops";

const item = (over: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id: "i1", checklist_id: "c1", product_id: null, name: "Mic", qty_needed: 4, source: "in_house",
  returns: true, note: "", sort_order: 1, origin: "manual", removed_at: null, qty_out: 0, qty_back: 0, ...over,
});
const op = (kind: QueuedOp["kind"], payload: object, extra: Partial<QueuedOp> = {}) =>
  ({ seq: 1, checklistId: "c1", kind, payload, clientId: "x", createdAt: 1, attempts: 0, ...extra }) as QueuedOp;

describe("applyPending", () => {
  it("applies a check and an undo", () => {
    const out = applyPending([item()], [op("check", { itemId: "i1", pass: "out", qty: 3 }), op("check", { itemId: "i1", pass: "out", qty: -1 })]);
    expect(out[0].qty_out).toBe(2);
  });
  it("clamps to what is needed", () => {
    expect(applyPending([item()], [op("check", { itemId: "i1", pass: "out", qty: 9 })])[0].qty_out).toBe(4);
  });
  it("shows an offline-added item and lets it be checked", () => {
    const out = applyPending([], [
      op("addItem", { id: "n1", checklistId: "c1", name: "Cable", qty: 2, source: "in_house" }),
      op("check", { itemId: "n1", pass: "out", qty: 1 }),
    ]);
    expect(out[0]).toMatchObject({ id: "n1", qty_out: 1, origin: "manual" });
  });
  it("does not add an item twice", () => {
    const out = applyPending([item({ id: "n1" })], [op("addItem", { id: "n1", checklistId: "c1", name: "Cable", qty: 2, source: "in_house" })]);
    expect(out).toHaveLength(1);
  });
  it("hides a removed item and applies a source change", () => {
    const out = applyPending([item(), item({ id: "i2" })], [op("removeItem", { itemId: "i1" }), op("setSource", { itemId: "i2", source: "sub_rented" })]);
    expect(out[0].removed_at).toBeTruthy();
    expect(out[1].source).toBe("sub_rented");
  });
  it("ignores ops on unknown items", () => {
    expect(applyPending([item()], [op("check", { itemId: "zzz", pass: "out", qty: 1 })])[0].qty_out).toBe(0);
  });
});

describe("pendingHistory", () => {
  it("lists checks newest first with the item name", () => {
    const rows = pendingHistory([item()], [op("check", { itemId: "i1", pass: "out", qty: 1 }, { clientId: "a" }), op("check", { itemId: "i1", pass: "back", qty: 1 }, { clientId: "b" })], "Me");
    expect(rows.map((r) => r.id)).toEqual(["pending-b", "pending-a"]);
    expect(rows[0].item_name).toBe("Mic");
  });
});
