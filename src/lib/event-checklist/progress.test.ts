import { describe, expect, it } from "vitest";
import {
  clampDelta,
  countsForPass,
  itemState,
  passTotals,
  returnVerb,
  stillNeeded,
} from "./progress";

const item = (over: Partial<Parameters<typeof passTotals>[0][number]> = {}) => ({
  returns: true,
  removed_at: null as string | null,
  qty_needed: 4,
  qty_out: 0,
  qty_back: 0,
  ...over,
});

describe("passTotals", () => {
  it("is 0% and incomplete with nothing checked", () => {
    const t = passTotals([item(), item({ qty_needed: 2 })], "out");
    expect(t).toMatchObject({ needed: 6, done: 0, percent: 0, complete: false, remainingItems: 2 });
  });

  it("rounds down so 99% never shows as 100%", () => {
    const t = passTotals([item({ qty_needed: 200, qty_out: 199 })], "out");
    expect(t.percent).toBe(99);
    expect(t.complete).toBe(false);
  });

  it("is complete only when every item is fully checked", () => {
    const done = passTotals(
      [item({ qty_out: 4 }), item({ qty_needed: 2, qty_out: 2 })],
      "out",
    );
    expect(done).toMatchObject({ percent: 100, complete: true, remainingItems: 0 });
    const notYet = passTotals(
      [item({ qty_out: 4 }), item({ qty_needed: 2, qty_out: 1 })],
      "out",
    );
    expect(notYet.complete).toBe(false);
    expect(notYet.remainingItems).toBe(1);
  });

  it("ignores removed items", () => {
    const t = passTotals(
      [item({ qty_out: 4 }), item({ removed_at: "2026-11-08T00:00:00Z" })],
      "out",
    );
    expect(t.complete).toBe(true);
    expect(t.needed).toBe(4);
  });

  it("does not count sold or used-up items toward the back pass", () => {
    const items = [item({ qty_back: 4 }), item({ returns: false })];
    expect(passTotals(items, "back").complete).toBe(true);
    expect(passTotals(items, "out").complete).toBe(false);
  });

  it("never lets over-checking inflate progress", () => {
    const t = passTotals([item({ qty_out: 9 })], "out");
    expect(t.done).toBe(4);
    expect(t.percent).toBe(100);
  });

  it("is not complete when there is nothing on the list", () => {
    expect(passTotals([], "out").complete).toBe(false);
  });
});

describe("itemState / stillNeeded", () => {
  it("labels none, partial and done", () => {
    expect(itemState(item(), "out")).toBe("none");
    expect(itemState(item({ qty_out: 2 }), "out")).toBe("partial");
    expect(itemState(item({ qty_out: 4 }), "out")).toBe("done");
  });

  it("lists only what is still needed with the amount left", () => {
    const rows = stillNeeded(
      [item({ qty_out: 4 }), item({ qty_needed: 5, qty_out: 2 })],
      "out",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].remaining).toBe(3);
  });
});

describe("clampDelta", () => {
  it("stops at what is needed", () => {
    expect(clampDelta(item({ qty_out: 3 }), "out", 5)).toBe(1);
  });
  it("stops at zero when undoing", () => {
    expect(clampDelta(item({ qty_out: 1 }), "out", -5)).toBe(-1);
  });
  it("returns 0 when nothing can change", () => {
    expect(clampDelta(item({ qty_out: 4 }), "out", 1)).toBe(0);
    expect(clampDelta(item(), "out", -1)).toBe(0);
  });
});

describe("countsForPass / returnVerb", () => {
  it("skips removed items", () => {
    expect(countsForPass({ returns: true, removed_at: "x" }, "out")).toBe(false);
  });
  it("words the return by who owns the gear", () => {
    expect(returnVerb("in_house")).toBe("Back in warehouse");
    expect(returnVerb("client_supplied")).toBe("Returned to client");
    expect(returnVerb("sub_rented")).toBe("Returned to vendor");
  });
});
