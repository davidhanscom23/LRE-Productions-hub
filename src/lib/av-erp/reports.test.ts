import { describe, expect, it } from "vitest";
import { invoiceOutstanding } from "./invoicing";
import {
  aggregateCostsByCategory,
  filterSalesStock,
  filterSubContractCosts,
  invoiceAgingBucket,
  isLowStock,
  neverBookedProducts,
  partiallyInvoicedJobs,
} from "./report-helpers";

describe("av-erp reports AR filter helper", () => {
  it("treats unpaid remainder as outstanding", () => {
    expect(invoiceOutstanding(1000, 250)).toBe(750);
    expect(invoiceOutstanding(100, 100)).toBe(0);
    expect(invoiceOutstanding(50, 80)).toBe(0);
  });

  it("subtracts credits from open AR outstanding", () => {
    expect(invoiceOutstanding(1000, 0, 250)).toBe(750);
    expect(invoiceOutstanding(100, 40, 60)).toBe(0);
  });
});

describe("invoiceAgingBucket", () => {
  const now = Date.parse("2026-10-31T16:00:00.000Z");

  it("treats missing or future due as current", () => {
    expect(invoiceAgingBucket(null, now)).toBe("current");
    expect(invoiceAgingBucket("2026-11-05T00:00:00.000Z", now)).toBe("current");
  });

  it("buckets by days past due", () => {
    expect(invoiceAgingBucket("2026-10-20T00:00:00.000Z", now)).toBe("d1_30");
    expect(invoiceAgingBucket("2026-09-15T00:00:00.000Z", now)).toBe("d31_60");
    expect(invoiceAgingBucket("2026-08-15T00:00:00.000Z", now)).toBe("d61_90");
    expect(invoiceAgingBucket("2026-06-01T00:00:00.000Z", now)).toBe(
      "d90_plus",
    );
  });
});

describe("aggregateCostsByCategory", () => {
  it("rolls amounts and counts by known category", () => {
    const rows = aggregateCostsByCategory([
      { category: "labor", amount: 100 },
      { category: "labor", amount: 50.5 },
      { category: "weird", amount: 10 },
    ]);
    expect(rows.find((r) => r.category === "labor")).toEqual({
      category: "labor",
      total: 150.5,
      count: 2,
    });
    expect(rows.find((r) => r.category === "other")).toEqual({
      category: "other",
      total: 10,
      count: 1,
    });
  });
});

describe("isLowStock", () => {
  it("flags owned items with free at or below threshold", () => {
    expect(isLowStock({ qtyOwned: 4, qtyFree: 0 })).toBe(true);
    expect(isLowStock({ qtyOwned: 4, qtyFree: 1 })).toBe(false);
    expect(isLowStock({ qtyOwned: 0, qtyFree: 0 })).toBe(false);
    expect(isLowStock({ qtyOwned: 4, qtyFree: 1 }, 1)).toBe(true);
  });
});

describe("neverBookedProducts", () => {
  it("keeps active products never on a job", () => {
    const rows = neverBookedProducts(
      [
        { productId: "a", isActive: true },
        { productId: "b", isActive: true },
        { productId: "c", isActive: false },
      ],
      ["a"],
    );
    expect(rows.map((r) => r.productId)).toEqual(["b"]);
  });
});

describe("partiallyInvoicedJobs", () => {
  it("includes partial status or under-invoiced quote total", () => {
    const rows = partiallyInvoicedJobs([
      {
        opportunityId: "1",
        reference: "Q-1",
        subject: "A",
        quoteCustomerTotal: 1000,
        invoiceTotal: 400,
        invoiceStatuses: ["sent"],
      },
      {
        opportunityId: "2",
        reference: "Q-2",
        subject: "B",
        quoteCustomerTotal: 500,
        invoiceTotal: 500,
        invoiceStatuses: ["paid"],
      },
      {
        opportunityId: "3",
        reference: "Q-3",
        subject: "C",
        quoteCustomerTotal: 200,
        invoiceTotal: 200,
        invoiceStatuses: ["partial"],
      },
    ]);
    expect(rows.map((r) => r.opportunityId)).toEqual(["1", "3"]);
  });
});

describe("filterSalesStock / sub contracts", () => {
  it("keeps sale and consumable kinds", () => {
    expect(
      filterSalesStock([
        { kind: "rental" },
        { kind: "sale" },
        { kind: "consumable" },
      ]).map((r) => r.kind),
    ).toEqual(["sale", "consumable"]);
  });

  it("keeps labor costs that have a supplier", () => {
    const rows = filterSubContractCosts([
      {
        id: "1",
        opportunityId: "o",
        opportunityReference: "Q",
        category: "labor",
        amount: 100,
        taxAmount: 0,
        supplierName: "Acme",
        description: "",
        costDate: "2026-11-01",
      },
      {
        id: "2",
        opportunityId: "o",
        opportunityReference: "Q",
        category: "labor",
        amount: 50,
        taxAmount: 0,
        supplierName: null,
        description: "",
        costDate: "2026-11-01",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.supplierName).toBe("Acme");
  });
});
