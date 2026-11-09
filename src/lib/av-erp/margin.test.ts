import { describe, expect, it } from "vitest";
import { jobMargin, resolveJobRevenue } from "./margin";

describe("av-erp margin", () => {
  it("prefers invoice totals over quote customer total", () => {
    expect(
      resolveJobRevenue({
        invoiceTotals: [500, 250],
        quoteCustomerTotal: 900,
      }),
    ).toEqual({ revenue: 750, source: "invoices" });
    expect(
      resolveJobRevenue({
        invoiceTotals: [],
        quoteCustomerTotal: 900,
      }),
    ).toEqual({ revenue: 900, source: "quote" });
  });

  it("computes margin and percent", () => {
    expect(jobMargin({ revenue: 1000, costs: 400 })).toEqual({
      margin: 600,
      marginPct: 60,
    });
    expect(jobMargin({ revenue: 0, costs: 50 })).toEqual({
      margin: -50,
      marginPct: null,
    });
  });
});
