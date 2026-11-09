import { describe, expect, it } from "vitest";
import { buildSalesReport, leadSourceOf, outcomeOf, type ReportProject } from "./sales-report";

const p = (o: Partial<ReportProject>): ReportProject => ({
  stage: "Inquiry",
  source_event: "gmail",
  raw: {},
  budget: null,
  created_at: "2026-10-01T00:00:00Z",
  booked_at: null,
  project_type: "Wedding",
  ...o,
});

describe("sales report", () => {
  it("classifies outcomes", () => {
    expect(outcomeOf({ stage: "Paid in Full", booked_at: null })).toBe("booked");
    expect(outcomeOf({ stage: "_RETAINER_PAID_", booked_at: null })).toBe("booked");
    expect(outcomeOf({ stage: "Not Booked", booked_at: null })).toBe("lost");
    expect(outcomeOf({ stage: "Proposal Sent", booked_at: null })).toBe("open");
    expect(outcomeOf({ stage: "Proposal Sent", booked_at: "2026-10-05" })).toBe("booked");
  });

  it("derives lead source", () => {
    expect(leadSourceOf({ source_event: "gmail", raw: {} })).toBe("Email inquiry");
    expect(leadSourceOf({ source_event: "web_form", raw: null })).toBe("Website form");
    expect(leadSourceOf({ source_event: "x", raw: { "Lead Source": " The Knot " } })).toBe("The Knot");
  });

  it("computes rates, value and time to book, skipping partnerships and merged cards", () => {
    const r = buildSalesReport([
      p({ stage: "Paid in Full", budget: "2000", booked_at: "2026-10-11T00:00:00Z" }),
      p({ stage: "Completed", budget: 1000, booked_at: "2026-10-21T00:00:00Z", source_event: "web_form" }),
      p({ stage: "Lost" }),
      p({ stage: "Inquiry" }),
      p({ stage: "Completed", record_type: "partnership" }),
      p({ stage: "Completed", merged_into: "abc" }),
    ]);
    expect(r.total).toBe(4);
    expect(r.booked).toBe(2);
    expect(r.bookingRate).toBeCloseTo(2 / 3);
    expect(r.bookedValue).toBe(3000);
    expect(r.avgBookedValue).toBe(1500);
    expect(r.avgDaysToBook).toBe(15);
    expect(r.bySource.find((s) => s.source === "Website form")?.booked).toBe(1);
    expect(r.byMonth[0].month).toBe("2026-10");
  });

  it("handles empty input and the date filter", () => {
    expect(buildSalesReport([]).bookingRate).toBeNull();
    expect(buildSalesReport([p({})], { from: "2026-11-01" }).total).toBe(0);
  });
});
