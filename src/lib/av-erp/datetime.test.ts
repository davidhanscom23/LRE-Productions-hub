import { describe, expect, it } from "vitest";
import {
  datetimeLocalEasternToIso,
  isoToDatetimeLocalEastern,
} from "./datetime";

describe("av-erp datetime Eastern helpers", () => {
  it("round-trips a winter Eastern wall time", () => {
    // EST = UTC-5
    const iso = datetimeLocalEasternToIso("2026-01-15T09:30");
    expect(iso).toBe("2026-01-15T14:30:00.000Z");
    expect(isoToDatetimeLocalEastern(iso)).toBe("2026-01-15T09:30");
  });

  it("round-trips a summer Eastern wall time (EDT)", () => {
    // EDT = UTC-4
    const iso = datetimeLocalEasternToIso("2026-07-15T09:30");
    expect(iso).toBe("2026-07-15T13:30:00.000Z");
    expect(isoToDatetimeLocalEastern(iso)).toBe("2026-07-15T09:30");
  });

  it("handles empty", () => {
    expect(datetimeLocalEasternToIso("")).toBeNull();
    expect(isoToDatetimeLocalEastern(null)).toBe("");
  });
});
