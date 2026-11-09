import { describe, expect, it } from "vitest";
import {
  changeOrderAmountDelta,
  changeOrderLineDelta,
} from "@/lib/av-erp/change-order-lines";

describe("change-order line deltas", () => {
  it("adds positive delta for add lines", () => {
    expect(
      changeOrderLineDelta({
        description: "Speaker",
        qty: 2,
        unit_price: 100,
        discount_pct: 0,
        sort_order: 0,
        apply_mode: "add",
      }),
    ).toBe(200);
  });

  it("computes adjust_qty and remove deltas against source", () => {
    expect(
      changeOrderLineDelta(
        {
          description: "Speaker",
          qty: 3,
          unit_price: 100,
          discount_pct: 0,
          sort_order: 0,
          apply_mode: "adjust_qty",
          source_line_id: "s1",
        },
        2,
        100,
        0,
      ),
    ).toBe(100);
    expect(
      changeOrderLineDelta(
        {
          description: "Remove",
          qty: 0,
          unit_price: 0,
          discount_pct: 0,
          sort_order: 0,
          apply_mode: "remove",
          source_line_id: "s1",
        },
        2,
        150,
        0,
      ),
    ).toBe(-300);
  });

  it("sums amount_delta across lines", () => {
    expect(
      changeOrderAmountDelta([
        {
          description: "A",
          qty: 1,
          unit_price: 50,
          discount_pct: 0,
          sort_order: 0,
          apply_mode: "add",
        },
        {
          description: "B",
          qty: 1,
          unit_price: 25,
          discount_pct: 0,
          sort_order: 1,
          apply_mode: "add",
        },
      ]),
    ).toBe(75);
  });
});
