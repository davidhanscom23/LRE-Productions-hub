import { describe, expect, it } from "vitest";
import {
  newElement,
  planInventory,
  recalibrate,
  sanitizePlanData,
  seatPositions,
  shapesFor,
  snap,
} from "./types";

describe("sanitizePlanData", () => {
  it("returns defaults for junk", () => {
    const d = sanitizePlanData(null);
    expect(d.elements).toEqual([]);
    expect(d.widthFt).toBe(80);
    expect(d.blueprint).toBeNull();
  });

  it("drops unknown kinds, clamps sizes and de-duplicates ids", () => {
    const d = sanitizePlanData({
      widthFt: 99999,
      elements: [
        { id: "a", kind: "stage", x: 1, y: 2, w: -5, h: 4, rot: -90 },
        { id: "a", kind: "chair" },
        { id: "z", kind: "nope" },
      ],
    });
    expect(d.widthFt).toBe(600);
    expect(d.elements).toHaveLength(2);
    expect(d.elements[0].w).toBe(0.2);
    expect(d.elements[0].rot).toBe(270);
    expect(d.elements[0].id).not.toBe(d.elements[1].id);
  });

  it("keeps a valid blueprint and rejects a pathless one", () => {
    expect(sanitizePlanData({ blueprint: { path: "x/y.png", naturalW: 100, naturalH: 50, ftPerPx: 0.1 } }).blueprint?.ftPerPx).toBe(0.1);
    expect(sanitizePlanData({ blueprint: { naturalW: 100 } }).blueprint).toBeNull();
  });
});

describe("geometry", () => {
  it("places the requested number of chairs", () => {
    const t = newElement("round_table_60", 10, 10, "t1");
    expect(seatPositions(t)).toHaveLength(8);
    expect(shapesFor(t)).toHaveLength(9);
    const r = { ...newElement("rect_table_8", 0, 0, "t2"), seats: 7 };
    expect(seatPositions(r)).toHaveLength(7);
  });

  it("counts inventory with seats", () => {
    const inv = planInventory({
      widthFt: 80,
      heightFt: 50,
      showGrid: true,
      blueprint: null,
      elements: [newElement("round_table_60", 0, 0, "a"), newElement("round_table_60", 9, 0, "b"), newElement("wall", 0, 0, "w")],
    });
    expect(inv).toContainEqual({ label: 'Round table 60"', count: 2 });
    expect(inv).toContainEqual({ label: "Seats at tables", count: 16 });
    expect(inv.find((r) => r.label === "Wall")).toBeUndefined();
  });

  it("recalibrates scale and snaps", () => {
    const bp = { path: "p", fileName: "f", naturalW: 100, naturalH: 100, ftPerPx: 0.1, opacity: 0.6 };
    expect(recalibrate(bp, 10, 20)).toBeCloseTo(0.2);
    expect(recalibrate(bp, 0, 20)).toBeNull();
    expect(snap(1.3, 0.5)).toBe(1.5);
    expect(snap(1.3, null)).toBe(1.3);
  });
});
