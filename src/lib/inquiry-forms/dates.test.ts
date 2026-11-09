import { afterEach, describe, expect, it } from "vitest";
import {
  BUSINESS_TZ,
  addDays,
  daysBetween,
  easternDayKey,
  formatEasternTimestamp,
  formatLongDate,
  formatTime12,
  formatTimeRange,
  isPastDate,
  isValidDateString,
  isValidTimeString,
  normalizeTimeString,
  todayInTz,
} from "./dates";

describe("todayInTz (America/New_York by default)", () => {
  it("uses the business time zone constant", () => {
    expect(BUSINESS_TZ).toBe("America/New_York");
  });

  it("is still yesterday in Florida late in the evening UTC-next-day (EST)", () => {
    // 2026-11-05 04:30 UTC = Nov 4, 11:30 PM EST (DST ended Nov 1, 2026).
    expect(todayInTz(new Date("2026-11-05T04:30:00Z"))).toBe("2026-11-04");
    expect(todayInTz(new Date("2026-11-05T04:59:59Z"))).toBe("2026-11-04");
    expect(todayInTz(new Date("2026-11-05T05:00:00Z"))).toBe("2026-11-05");
  });

  it("handles the spring-forward night (Mar 8, 2026)", () => {
    expect(todayInTz(new Date("2026-03-08T04:59:59Z"))).toBe("2026-03-07"); // 11:59:59 PM EST
    expect(todayInTz(new Date("2026-03-08T05:00:00Z"))).toBe("2026-03-08"); // midnight EST
    expect(todayInTz(new Date("2026-03-08T07:30:00Z"))).toBe("2026-03-08"); // 3:30 AM EDT
  });

  it("handles the fall-back night (Nov 1, 2026), both 1:30 AMs are Nov 1", () => {
    expect(todayInTz(new Date("2026-11-01T03:59:00Z"))).toBe("2026-10-31"); // 11:59 PM EDT
    expect(todayInTz(new Date("2026-11-01T04:00:00Z"))).toBe("2026-11-01"); // midnight EDT
    expect(todayInTz(new Date("2026-11-01T05:30:00Z"))).toBe("2026-11-01"); // 1:30 AM EDT
    expect(todayInTz(new Date("2026-11-01T06:30:00Z"))).toBe("2026-11-01"); // 1:30 AM EST
  });

  it("handles summer time and the new year boundary", () => {
    expect(todayInTz(new Date("2026-07-04T03:59:00Z"))).toBe("2026-07-03");
    expect(todayInTz(new Date("2026-07-04T04:00:00Z"))).toBe("2026-07-04");
    expect(todayInTz(new Date("2027-01-01T04:59:59Z"))).toBe("2026-12-31");
    expect(todayInTz(new Date("2027-01-01T05:00:00Z"))).toBe("2027-01-01");
  });

  it("accepts another zone", () => {
    expect(todayInTz(new Date("2026-11-05T07:59:00Z"), "America/Los_Angeles")).toBe("2026-11-04");
    expect(todayInTz(new Date("2026-11-05T07:59:00Z"), "UTC")).toBe("2026-11-05");
  });

  it("defaults to now", () => {
    expect(isValidDateString(todayInTz())).toBe(true);
  });
});

describe("isValidDateString", () => {
  it("accepts real calendar dates only", () => {
    expect(isValidDateString("2026-02-28")).toBe(true);
    expect(isValidDateString("2028-02-29")).toBe(true);
    expect(isValidDateString("2000-02-29")).toBe(true);
    expect(isValidDateString("2026-12-31")).toBe(true);
    expect(isValidDateString("2026-02-29")).toBe(false);
    expect(isValidDateString("2100-02-29")).toBe(false);
    expect(isValidDateString("2026-04-31")).toBe(false);
    expect(isValidDateString("2026-13-01")).toBe(false);
    expect(isValidDateString("2026-00-10")).toBe(false);
    expect(isValidDateString("2026-01-00")).toBe(false);
  });

  it("rejects other formats and junk", () => {
    for (const s of ["2026-4-1", " 2026-04-01", "2026-04-01 ", "2026-04-01T00:00", "04/01/2026", "", "0999-01-01"]) {
      expect(isValidDateString(s)).toBe(false);
    }
    expect(isValidDateString(undefined as unknown as string)).toBe(false);
    expect(isValidDateString(20260401 as unknown as string)).toBe(false);
  });
});

describe("isPastDate", () => {
  it("is strictly before today; today itself is fine", () => {
    expect(isPastDate("2026-11-03", "2026-11-04")).toBe(true);
    expect(isPastDate("2026-11-04", "2026-11-04")).toBe(false);
    expect(isPastDate("2026-11-05", "2026-11-04")).toBe(false);
    expect(isPastDate("2025-12-31", "2026-01-01")).toBe(true);
  });

  it("is false for invalid input (validation reports that separately)", () => {
    expect(isPastDate("garbage", "2026-11-04")).toBe(false);
    expect(isPastDate("2026-11-03", "")).toBe(false);
  });
});

describe("addDays and daysBetween (calendar math, DST-proof)", () => {
  it("crosses DST changes without skipping or repeating a day", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
  });

  it("rolls months, years and leap days", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-11-04", 0)).toBe("2026-11-04");
    expect(addDays("2026-11-04", 30)).toBe("2026-12-04");
    expect(addDays("2026-11-04", -30)).toBe("2026-10-05");
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2026-11-04", "2026-11-04")).toBe(0);
    expect(daysBetween("2026-11-04", "2026-11-01")).toBe(-3);
    expect(daysBetween("2026-01-01", "2027-01-01")).toBe(365);
  });

  it("truncates fractional day counts", () => {
    expect(addDays("2026-11-04", 1.9)).toBe("2026-11-05");
    expect(addDays("2026-11-04", -1.9)).toBe("2026-11-03");
  });

  it("throws on invalid input instead of returning a wrong date", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
    expect(() => addDays("2026-02-01", Number.NaN)).toThrow(RangeError);
    expect(() => daysBetween("x", "2026-02-01")).toThrow(RangeError);
  });

  describe("does not depend on the process time zone", () => {
    const original = process.env.TZ;
    afterEach(() => {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    });

    it("gives the same answers under far-off zones", () => {
      for (const tz of ["Pacific/Kiritimati", "America/Los_Angeles", "Asia/Jerusalem"]) {
        process.env.TZ = tz;
        expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
        expect(formatLongDate("2026-03-08")).toBe("Sunday, March 8, 2026");
        expect(easternDayKey("2026-05-15T23:30:00-04:00")).toBe("2026-05-15");
        expect(todayInTz(new Date("2026-11-05T04:30:00Z"))).toBe("2026-11-04");
      }
    });
  });
});

describe("formatLongDate", () => {
  it("formats the wall date without shifting it a day", () => {
    expect(formatLongDate("2027-05-15")).toBe("Saturday, May 15, 2027");
    expect(formatLongDate("2026-11-04")).toBe("Wednesday, November 4, 2026");
    expect(formatLongDate("2026-03-08")).toBe("Sunday, March 8, 2026");
    expect(formatLongDate("2026-01-01")).toBe("Thursday, January 1, 2026");
  });

  it("returns the input when it is not a date", () => {
    expect(formatLongDate("soon")).toBe("soon");
    expect(formatLongDate("2026-02-30")).toBe("2026-02-30");
  });
});

describe("easternDayKey", () => {
  it("converts timestamps to the New York wall date", () => {
    expect(easternDayKey("2026-11-05T03:30:00Z")).toBe("2026-11-04");
    expect(easternDayKey("2026-11-05T05:00:00.000Z")).toBe("2026-11-05");
    expect(easternDayKey("2026-06-01T03:59:59+00:00")).toBe("2026-05-31");
    expect(easternDayKey(new Date("2026-06-01T04:00:00Z"))).toBe("2026-06-01");
  });

  it("counts an evening event on the day it happens, not the next UTC day (LeadGate bug 10.20)", () => {
    // 11:30 PM EDT on May 15 is 03:30 UTC on May 16.
    expect(easternDayKey("2026-05-15T23:30:00-04:00")).toBe("2026-05-15");
    expect(easternDayKey("2026-05-16T03:30:00Z")).toBe("2026-05-15");
  });

  it("accepts Postgres-style timestamps", () => {
    expect(easternDayKey("2026-11-04 15:05:00+00")).toBe("2026-11-04");
    expect(easternDayKey("2026-11-05 02:00:00+00")).toBe("2026-11-04");
    expect(easternDayKey("2026-11-05 02:00:00+00:00")).toBe("2026-11-04");
  });

  it("returns a bare wall date unchanged (never new Date('YYYY-MM-DD'))", () => {
    expect(easternDayKey("2026-05-15")).toBe("2026-05-15");
    expect(easternDayKey("2026-02-30")).toBe("");
  });

  it("returns empty for junk", () => {
    expect(easternDayKey("not a date")).toBe("");
    expect(easternDayKey("")).toBe("");
    expect(easternDayKey(null as unknown as string)).toBe("");
    expect(easternDayKey(new Date(Number.NaN))).toBe("");
  });
});

describe("formatEasternTimestamp", () => {
  it("formats in Eastern time with an ET suffix", () => {
    expect(formatEasternTimestamp("2026-11-04T20:05:00Z")).toBe("Nov 4, 2026, 3:05 PM ET");
    expect(formatEasternTimestamp("2026-07-04T04:00:00Z")).toBe("Jul 4, 2026, 12:00 AM ET");
    expect(formatEasternTimestamp("2026-07-04T16:00:00Z")).toBe("Jul 4, 2026, 12:00 PM ET");
    expect(formatEasternTimestamp("2026-09-30T13:09:00Z")).toBe("Sep 30, 2026, 9:09 AM ET");
  });

  it("is correct on both sides of the fall-back hour", () => {
    expect(formatEasternTimestamp("2026-11-01T05:30:00Z")).toBe("Nov 1, 2026, 1:30 AM ET");
    expect(formatEasternTimestamp("2026-11-01T06:30:00Z")).toBe("Nov 1, 2026, 1:30 AM ET");
    expect(formatEasternTimestamp("2026-11-01T07:30:00Z")).toBe("Nov 1, 2026, 2:30 AM ET");
  });

  it("uses plain spaces only (no narrow no-break space before AM/PM)", () => {
    const s = formatEasternTimestamp("2026-11-04T20:05:00Z");
    expect(s.includes(String.fromCharCode(0x202f))).toBe(false);
    expect(s.includes(String.fromCharCode(0x00a0))).toBe(false);
  });

  it("returns the input when it is not a timestamp", () => {
    expect(formatEasternTimestamp("whenever")).toBe("whenever");
  });
});

describe("times", () => {
  it("normalizes to HH:MM", () => {
    expect(normalizeTimeString("9:05")).toBe("09:05");
    expect(normalizeTimeString("09:05")).toBe("09:05");
    expect(normalizeTimeString("18:00:30")).toBe("18:00");
    expect(normalizeTimeString("18:00:30.123")).toBe("18:00");
    expect(normalizeTimeString(" 23:59 ")).toBe("23:59");
    for (const bad of ["24:00", "12:60", "6pm", "", "1800", "12:5", "-1:00"]) {
      expect(normalizeTimeString(bad)).toBeNull();
    }
  });

  it("checks exact HH:MM", () => {
    expect(isValidTimeString("00:00")).toBe(true);
    expect(isValidTimeString("23:59")).toBe(true);
    expect(isValidTimeString("9:05")).toBe(false);
    expect(isValidTimeString("24:00")).toBe(false);
  });

  it("formats 12 h times and ranges", () => {
    expect(formatTime12("00:00")).toBe("12:00 AM");
    expect(formatTime12("00:30")).toBe("12:30 AM");
    expect(formatTime12("12:00")).toBe("12:00 PM");
    expect(formatTime12("13:05")).toBe("1:05 PM");
    expect(formatTime12("23:59")).toBe("11:59 PM");
    expect(formatTime12("later")).toBe("later");
    expect(formatTimeRange("18:00", "23:00")).toBe("6:00 PM - 11:00 PM");
    expect(formatTimeRange("21:00", "01:00")).toBe("9:00 PM - 1:00 AM");
    expect(formatTimeRange("18:00")).toBe("6:00 PM");
    expect(formatTimeRange("18:00", "junk")).toBe("6:00 PM");
  });
});
