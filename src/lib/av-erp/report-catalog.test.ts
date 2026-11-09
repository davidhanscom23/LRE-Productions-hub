import { describe, expect, it } from "vitest";
import {
  AV_REPORT_CATALOG,
  KM_REPORT_CATALOG,
  filterKmReports,
  filterReportCatalog,
  reportCatalogSearchKeywords,
  reportSectionBlurb,
  unmappedKmReports,
} from "./report-catalog";

describe("AV report catalog", () => {
  it("registers all 19 KM report keys exactly once", () => {
    expect(KM_REPORT_CATALOG).toHaveLength(19);
    const keys = KM_REPORT_CATALOG.map((r) => r.key);
    expect(new Set(keys).size).toBe(19);
  });

  it("maps every KM key onto a Hub section", () => {
    expect(unmappedKmReports()).toEqual([]);
    expect(AV_REPORT_CATALOG).toHaveLength(27);
    expect(
      AV_REPORT_CATALOG.find((s) => s.id === "customer-income")?.kmAliases,
    ).toEqual(["customer"]);
    expect(
      AV_REPORT_CATALOG.find((s) => s.id === "text-rentals")?.kmAliases,
    ).toEqual(["textRentals"]);
    expect(
      AV_REPORT_CATALOG.find((s) => s.id === "text-sales")?.kmAliases,
    ).toEqual(["textSales"]);
    expect(
      AV_REPORT_CATALOG.find((s) => s.id === "contacts")?.kmAliases,
    ).toEqual(["contacts"]);
    expect(
      AV_REPORT_CATALOG.find((s) => s.id === "payments")?.kmAliases,
    ).toEqual(["payments"]);
    expect(
      AV_REPORT_CATALOG.find((s) => s.id === "never-booked")?.kmAliases,
    ).toEqual(["neverBooked"]);
  });

  it("filters Hub sections by KM key, KM label, and hub keywords", () => {
    expect(filterReportCatalog("customer").map((s) => s.id)).toContain(
      "customer-income",
    );
    expect(filterReportCatalog("whatsOut").map((s) => s.id)).toEqual(["gear"]);
    expect(filterReportCatalog("textSales").map((s) => s.id)).toEqual([
      "text-sales",
    ]);
    expect(filterReportCatalog("textRentals").map((s) => s.id)).toEqual([
      "text-rentals",
    ]);
    expect(filterReportCatalog("payments").map((s) => s.id)).toContain(
      "payments",
    );
    expect(filterReportCatalog("").length).toBe(27);
    expect(filterReportCatalog("zzzz-none")).toEqual([]);
  });

  it("filters the KM index", () => {
    expect(filterKmReports("contacts")[0]?.hubSectionId).toBe("contacts");
    expect(filterKmReports("").length).toBe(19);
  });

  it("appends KM aliases into blurbs when present", () => {
    const income = AV_REPORT_CATALOG.find((s) => s.id === "rental-income")!;
    expect(reportSectionBlurb(income)).toContain("rental");
    const aging = AV_REPORT_CATALOG.find((s) => s.id === "aging")!;
    expect(reportSectionBlurb(aging)).not.toContain("KM:");
  });

  it("exposes search keywords for income and contacts", () => {
    const keys = reportCatalogSearchKeywords();
    expect(keys).toContain("customer");
    expect(keys).toContain("textRentals");
    expect(keys).toContain("textSales");
    expect(keys).toContain("contacts");
  });
});
