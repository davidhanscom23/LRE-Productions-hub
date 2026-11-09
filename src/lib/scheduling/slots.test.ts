import { describe, expect, it } from "vitest";
import {
  addDays,
  dateInTz,
  generateSlots,
  parseWindowsText,
  sanitizeWeekly,
  zonedToUtcMs,
} from "./slots";

const NY = "America/New_York";
const weekdays = { mon: [["09:00", "12:00"]], tue: [["09:00", "12:00"]] } as never;

describe("time zones", () => {
  it("converts wall time to UTC in winter and summer", () => {
    expect(new Date(zonedToUtcMs("2026-01-15", "09:00", NY)).toISOString()).toBe("2026-01-15T14:00:00.000Z");
    expect(new Date(zonedToUtcMs("2026-07-15", "09:00", NY)).toISOString()).toBe("2026-07-15T13:00:00.000Z");
  });
  it("handles the spring-forward day", () => {
    expect(new Date(zonedToUtcMs("2026-03-08", "10:00", NY)).toISOString()).toBe("2026-03-08T14:00:00.000Z");
    expect(new Date(zonedToUtcMs("2026-03-08", "01:00", NY)).toISOString()).toBe("2026-03-08T06:00:00.000Z");
  });
  it("finds the local date of an instant", () => {
    expect(dateInTz(Date.parse("2026-07-16T02:30:00Z"), NY)).toBe("2026-07-15");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("generateSlots", () => {
  const base = {
    weekly: weekdays,
    tz: NY,
    durationMin: 30,
    bufferMin: 0,
    minNoticeHours: 0,
    maxDaysAhead: 60,
    busy: [],
  };
  // Monday 2026-11-09 is a Monday.
  const now = Date.parse("2026-11-07T15:00:00Z");

  it("lists every half hour in the window", () => {
    const s = generateSlots({ ...base, date: "2026-11-09", nowMs: now });
    expect(s).toHaveLength(6);
    expect(s[0]).toBe("2026-11-09T14:00:00.000Z");
  });
  it("returns nothing on a day without hours", () => {
    expect(generateSlots({ ...base, date: "2026-11-08", nowMs: now })).toEqual([]);
  });
  it("respects minimum notice", () => {
    const s = generateSlots({ ...base, date: "2026-11-09", nowMs: Date.parse("2026-11-09T14:20:00Z"), minNoticeHours: 1 });
    expect(s[0]).toBe("2026-11-09T15:30:00.000Z");
  });
  it("blocks booked time plus the buffer", () => {
    const busy = [{ startMs: Date.parse("2026-11-09T15:00:00Z"), endMs: Date.parse("2026-11-09T15:30:00Z") }];
    const s = generateSlots({ ...base, bufferMin: 15, busy, date: "2026-11-09", nowMs: now });
    expect(s).not.toContain("2026-11-09T14:30:00.000Z");
    expect(s).not.toContain("2026-11-09T15:00:00.000Z");
    expect(s).not.toContain("2026-11-09T15:30:00.000Z");
    expect(s).toContain("2026-11-09T14:00:00.000Z");
    expect(s).toContain("2026-11-09T16:00:00.000Z");
  });
  it("respects the booking horizon and past days", () => {
    expect(generateSlots({ ...base, date: "2027-03-02", nowMs: now })).toEqual([]);
    expect(generateSlots({ ...base, date: "2026-11-02", nowMs: now })).toEqual([]);
  });
  it("rejects bad dates", () => {
    expect(generateSlots({ ...base, date: "nope", nowMs: now })).toEqual([]);
  });
});

describe("hours input", () => {
  it("parses and normalizes window text", () => {
    expect(parseWindowsText("9:00-12:00, 13:00-17:00")).toEqual([["09:00", "12:00"], ["13:00", "17:00"]]);
    expect(parseWindowsText("")).toEqual([]);
    expect(parseWindowsText("17:00-09:00")).toBeNull();
    expect(parseWindowsText("lunch")).toBeNull();
  });
  it("merges overlapping windows and drops junk", () => {
    expect(sanitizeWeekly({ mon: [["09:00", "12:00"], ["11:00", "14:00"], ["bad", "x"]], xyz: [["09:00", "10:00"]] })).toEqual({
      mon: [["09:00", "14:00"]],
    });
  });
});
