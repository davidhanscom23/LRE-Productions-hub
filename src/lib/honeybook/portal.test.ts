import { describe, expect, it } from "vitest";
import { isEmptyPortal, portalActionItems, type PortalItems } from "./portal";

const base: PortalItems = { contracts: [], invoices: [], floorPlans: [], meetings: [] };

describe("client portal", () => {
  it("lists signing before paying and skips finished items", () => {
    const items: PortalItems = {
      ...base,
      contracts: [
        { title: "Agreement", status: "sent", url: "/sign/a", signedAt: null },
        { title: "Old", status: "signed", url: "/sign/b", signedAt: "2026-01-01" },
      ],
      invoices: [
        { number: "PI-0001", title: "", status: "partial", total: 1000, balance: 500, nextDueAt: "2026-10-01", url: "/pay/x" },
        { number: "PI-0002", title: "", status: "paid", total: 100, balance: 0, nextDueAt: null, url: "/pay/y" },
      ],
    };
    const a = portalActionItems(items, "2026-11-07");
    expect(a.map((x) => x.kind)).toEqual(["contract", "invoice"]);
    expect(a[1].label).toContain("past due");
    expect(portalActionItems(base, "2026-11-07")).toEqual([]);
  });

  it("detects an empty portal", () => {
    expect(isEmptyPortal(base)).toBe(true);
    expect(isEmptyPortal({ ...base, meetings: [{ title: "Call", minutes: 30, url: "/book/c" }] })).toBe(false);
  });
});
