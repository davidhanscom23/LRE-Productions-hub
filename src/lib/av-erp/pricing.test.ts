import { describe, expect, it } from "vitest";
import {
  computeOpportunityPrices,
  customerUnitPrice,
  lineTotal,
} from "@/lib/av-erp/pricing";

describe("av-erp pricing / venue markup", () => {
  it("matches KM Q-0009: $100 line + 15% hidden markup → customer $115", () => {
    const breakdown = computeOpportunityPrices({
      lines: [{ qty: 1, unitPrice: 100 }],
      venueMarkupPct: 15,
      venueMarkupEnabled: true,
    });
    expect(breakdown.realTotal).toBe(100);
    expect(breakdown.venueMarkupAmount).toBe(15);
    expect(breakdown.customerTotal).toBe(115);
    expect(customerUnitPrice(100, 15, true)).toBe(115);
  });

  it("untick / disabled markup restores customer total to real", () => {
    const off = computeOpportunityPrices({
      lines: [{ qty: 1, unitPrice: 100 }],
      venueMarkupPct: 15,
      venueMarkupEnabled: false,
    });
    expect(off.venueMarkupAmount).toBe(0);
    expect(off.customerTotal).toBe(100);
  });

  it("applies line discount before quote-level markup", () => {
    expect(lineTotal({ qty: 2, unitPrice: 50, discountPct: 10 })).toBe(90);
    const breakdown = computeOpportunityPrices({
      lines: [{ qty: 2, unitPrice: 50, discountPct: 10 }],
      venueMarkupPct: 10,
      venueMarkupEnabled: true,
    });
    expect(breakdown.realTotal).toBe(90);
    expect(breakdown.customerTotal).toBe(99);
  });
});
