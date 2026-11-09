import { describe, expect, it } from "vitest";
import {
  extendEndByTurnaround,
  freeQtyForWindow,
  reserveQtyForShortage,
  shortageForLine,
  windowsOverlap,
} from "@/lib/av-erp/availability";

describe("av-erp availability", () => {
  it("detects overlapping windows", () => {
    expect(
      windowsOverlap(
        "2026-11-01T10:00:00Z",
        "2026-11-03T10:00:00Z",
        "2026-11-02T10:00:00Z",
        "2026-11-04T10:00:00Z",
      ),
    ).toBe(true);
    expect(
      windowsOverlap(
        "2026-11-01T10:00:00Z",
        "2026-11-02T10:00:00Z",
        "2026-11-02T10:00:00Z",
        "2026-11-03T10:00:00Z",
      ),
    ).toBe(false);
  });

  it("subtracts overlapping holds and applies buffer", () => {
    const free = freeQtyForWindow({
      qtyOwned: 10,
      bufferPct: 10,
      startsAt: "2026-11-01T00:00:00Z",
      endsAt: "2026-11-05T00:00:00Z",
      holds: [
        {
          product_id: "p1",
          qty: 3,
          starts_at: "2026-11-02T00:00:00Z",
          ends_at: "2026-11-04T00:00:00Z",
          opportunity_id: "other",
        },
      ],
    });
    // quotable = 9, held = 3 → free 6
    expect(free).toBe(6);
  });

  it("ignores this opportunity's holds when computing shortage", () => {
    const result = shortageForLine({
      qtyNeeded: 5,
      qtyOwned: 10,
      bufferPct: 0,
      startsAt: "2026-11-01T00:00:00Z",
      endsAt: "2026-11-05T00:00:00Z",
      excludeOpportunityId: "mine",
      holds: [
        {
          product_id: "p1",
          qty: 5,
          starts_at: "2026-11-01T00:00:00Z",
          ends_at: "2026-11-05T00:00:00Z",
          opportunity_id: "mine",
        },
      ],
    });
    expect(result).toEqual({ free: 10, shortage: 0 });
  });

  it("extends hold end by turnaround hours for overlap", () => {
    expect(extendEndByTurnaround("2026-11-02T12:00:00.000Z", 24)).toBe(
      "2026-11-03T12:00:00.000Z",
    );
    // Need window starts after hold gear-back, but inside turnaround → still held
    const free = freeQtyForWindow({
      qtyOwned: 10,
      bufferPct: 0,
      startsAt: "2026-11-02T18:00:00Z",
      endsAt: "2026-11-03T18:00:00Z",
      turnaroundHours: 24,
      holds: [
        {
          product_id: "p1",
          qty: 4,
          starts_at: "2026-11-01T00:00:00Z",
          ends_at: "2026-11-02T12:00:00Z",
          opportunity_id: "other",
        },
      ],
    });
    expect(free).toBe(6);
  });

  it("reserves only free qty when confirming past a shortage", () => {
    expect(reserveQtyForShortage(50, 4)).toEqual({ reserve: 4, short: 46 });
    expect(reserveQtyForShortage(5, 10)).toEqual({ reserve: 5, short: 0 });
    expect(reserveQtyForShortage(3, 0)).toEqual({ reserve: 0, short: 3 });
  });
});
