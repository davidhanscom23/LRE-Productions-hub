import { describe, expect, it } from "vitest";
import { buildEstimatePdf, estimateFileName } from "./estimate-pdf";
import { buildCustomerEstimate } from "./estimate-view";

describe("buildEstimatePdf", () => {
  it("emits a non-empty PDF with customer total after markup", async () => {
    const estimate = buildCustomerEstimate({
      reference: "Q-0009",
      subject: "Ballroom",
      venueMarkupEnabled: true,
      venueMarkupPct: 15,
      groups: [{ id: "g", name: "Gear", sort_order: 0 }],
      lines: [
        {
          id: "l",
          group_id: "g",
          description: "Speaker",
          qty: 1,
          unit_price: 100,
          discount_pct: 0,
          sort_order: 0,
        },
      ],
    });
    expect(estimate.total).toBe(115);
    const bytes = await buildEstimatePdf(estimate);
    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
    expect(estimateFileName(estimate)).toContain("Q-0009");
  });
});
