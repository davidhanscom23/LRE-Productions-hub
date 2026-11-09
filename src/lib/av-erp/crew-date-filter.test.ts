import { describe, expect, it } from "vitest";
import {
  bookingOverlapsDateKey,
  isIsoDateKey,
} from "@/lib/av-erp/crew-date-filter";

describe("isIsoDateKey", () => {
  it("accepts YYYY-MM-DD", () => {
    expect(isIsoDateKey("2026-11-01")).toBe(true);
  });
  it("rejects junk", () => {
    expect(isIsoDateKey("11/01/2026")).toBe(false);
    expect(isIsoDateKey("")).toBe(false);
  });
});

describe("bookingOverlapsDateKey", () => {
  it("matches same-day booking", () => {
    expect(
      bookingOverlapsDateKey(
        "2026-11-01T14:00:00.000Z",
        "2026-11-01T22:00:00.000Z",
        "2026-11-01",
      ),
    ).toBe(true);
  });

  it("matches multi-day span", () => {
    expect(
      bookingOverlapsDateKey(
        "2026-11-01T18:00:00.000Z",
        "2026-11-03T04:00:00.000Z",
        "2026-11-02",
      ),
    ).toBe(true);
  });

  it("excludes days outside the span", () => {
    expect(
      bookingOverlapsDateKey(
        "2026-11-01T14:00:00.000Z",
        "2026-11-01T22:00:00.000Z",
        "2026-11-02",
      ),
    ).toBe(false);
  });
});
