import { describe, expect, it } from "vitest";
import { buildCustomerEstimate } from "./estimate-view";

describe("buildCustomerEstimate", () => {
  it("folds venue markup into unit prices and total without exposing markup", () => {
    const estimate = buildCustomerEstimate({
      reference: "Q-0009",
      subject: "Ballroom",
      surchargePct: 0,
      discountPct: 0,
      venueMarkupEnabled: true,
      venueMarkupPct: 15,
      groups: [{ id: "g1", name: "Gear", sort_order: 0 }],
      lines: [
        {
          id: "l1",
          group_id: "g1",
          description: "Speaker",
          qty: 1,
          unit_price: 100,
          discount_pct: 0,
          sort_order: 0,
        },
      ],
    });

    expect(estimate.lines[0]?.unitPrice).toBe(115);
    expect(estimate.lines[0]?.lineTotal).toBe(115);
    expect(estimate.total).toBe(115);
    expect(JSON.stringify(estimate)).not.toMatch(/markup/i);
    expect(JSON.stringify(estimate)).not.toMatch(/"unit_price":100/);
  });

  it("keeps real prices when markup is off", () => {
    const estimate = buildCustomerEstimate({
      reference: "Q-0001",
      subject: "Test",
      venueMarkupEnabled: false,
      venueMarkupPct: 15,
      groups: [],
      lines: [
        {
          id: "l1",
          group_id: null,
          description: "Mic",
          qty: 2,
          unit_price: 50,
          discount_pct: 0,
          sort_order: 0,
        },
      ],
    });
    expect(estimate.lines[0]?.unitPrice).toBe(50);
    expect(estimate.total).toBe(100);
    expect(estimate.taxRatePct).toBe(0);
    expect(estimate.taxAmount).toBe(0);
  });

  it("adds sales tax onto customer total", () => {
    const estimate = buildCustomerEstimate({
      reference: "Q-0010",
      subject: "Taxed",
      surchargePct: 0,
      discountPct: 0,
      venueMarkupEnabled: false,
      taxRatePct: 8.25,
      groups: [],
      lines: [
        {
          id: "l1",
          group_id: null,
          description: "Mic",
          qty: 2,
          unit_price: 50,
          discount_pct: 0,
          sort_order: 0,
        },
      ],
    });
    expect(estimate.linesSubtotal).toBe(100);
    expect(estimate.taxRatePct).toBe(8.25);
    expect(estimate.taxAmount).toBe(8.25);
    expect(estimate.total).toBe(108.25);
  });
});
