import { describe, expect, it } from "vitest";
import { pickBackTarget, pickOutTarget, type TargetItem } from "./checklist-target";

function item(over: Partial<TargetItem>): TargetItem {
  return {
    id: "i1",
    product_id: "p1",
    qty_needed: 2,
    qty_out: 0,
    qty_back: 0,
    origin: "contract",
    removed_at: null,
    returns: true,
    ...over,
  };
}

describe("pickOutTarget", () => {
  it("uses a line with room", () => {
    expect(pickOutTarget([item({})], "p1")).toEqual({ kind: "use", itemId: "i1" });
  });

  it("prefers the estimate line over a hand-added one", () => {
    const items = [item({ id: "m", origin: "manual" }), item({ id: "c" })];
    expect(pickOutTarget(items, "p1")).toEqual({ kind: "use", itemId: "c" });
  });

  it("asks for a new line when the product is not on the list", () => {
    expect(pickOutTarget([item({ product_id: "other" })], "p1")).toEqual({ kind: "create" });
    expect(pickOutTarget([], "p1")).toEqual({ kind: "create" });
  });

  it("never grows a full estimate line", () => {
    expect(pickOutTarget([item({ qty_out: 2 })], "p1")).toEqual({ kind: "create" });
  });

  it("grows a full hand-added line by one", () => {
    const items = [item({ qty_out: 2 }), item({ id: "m", origin: "manual", qty_needed: 1, qty_out: 1 })];
    expect(pickOutTarget(items, "p1")).toEqual({ kind: "bump", itemId: "m", qtyNeeded: 2 });
  });

  it("ignores removed lines", () => {
    expect(pickOutTarget([item({ removed_at: "2026-11-01" })], "p1")).toEqual({ kind: "create" });
  });
});

describe("pickBackTarget", () => {
  it("finds a line with something still out", () => {
    expect(pickBackTarget([item({ qty_out: 1 })], "p1")).toBe("i1");
  });

  it("returns null when nothing is out, or everything is already back", () => {
    expect(pickBackTarget([item({})], "p1")).toBeNull();
    expect(pickBackTarget([item({ qty_out: 2, qty_back: 2 })], "p1")).toBeNull();
  });

  it("skips sold or used-up lines and other products", () => {
    expect(pickBackTarget([item({ qty_out: 1, returns: false })], "p1")).toBeNull();
    expect(pickBackTarget([item({ qty_out: 1, product_id: "x" })], "p1")).toBeNull();
  });
});
