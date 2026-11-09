import { describe, expect, it } from "vitest";
import {
  heldByKey,
  isOverdue,
  productQtyOut,
  remainingToCheckOut,
  stillOutByKey,
} from "./warehouse";

describe("av-erp warehouse helpers", () => {
  it("nets still-out from out/back movements", () => {
    const map = stillOutByKey([
      {
        opportunity_id: "o1",
        product_id: "p1",
        direction: "out",
        qty: 5,
      },
      {
        opportunity_id: "o1",
        product_id: "p1",
        direction: "back",
        qty: 2,
      },
      {
        opportunity_id: "o1",
        product_id: "p1",
        direction: "back",
        qty: 3,
      },
    ]);
    expect(map.size).toBe(0);
  });

  it("keeps partial still-out and remaining to check out", () => {
    const still = stillOutByKey([
      {
        opportunity_id: "o1",
        product_id: "p1",
        direction: "out",
        qty: 4,
      },
      {
        opportunity_id: "o1",
        product_id: "p1",
        direction: "back",
        qty: 1,
      },
    ]);
    expect(still.get("o1::p1")).toBe(3);
    const held = heldByKey([
      { opportunity_id: "o1", product_id: "p1", qty: 5 },
    ]);
    expect(remainingToCheckOut(held.get("o1::p1") ?? 0, 3)).toBe(2);
  });

  it("sums product out across jobs and detects overdue", () => {
    expect(
      productQtyOut(
        [
          {
            opportunity_id: "a",
            product_id: "p1",
            direction: "out",
            qty: 2,
          },
          {
            opportunity_id: "b",
            product_id: "p1",
            direction: "out",
            qty: 3,
          },
          {
            opportunity_id: "b",
            product_id: "p1",
            direction: "back",
            qty: 1,
          },
        ],
        "p1",
      ),
    ).toBe(4);
    expect(isOverdue(2, "2020-01-01T00:00:00Z", Date.parse("2026-01-01"))).toBe(
      true,
    );
    expect(isOverdue(0, "2020-01-01T00:00:00Z", Date.parse("2026-01-01"))).toBe(
      false,
    );
  });
});
