import { describe, expect, it } from "vitest";
import {
  HOLIDAY_IDS,
  HOLIDAY_THEMES,
  activeHolidayId,
  easterSunday,
  holidayDateKeyNy,
  isHolidayId,
} from "@/lib/holidays/holidays";

const dateOf = (id: (typeof HOLIDAY_IDS)[number], year: number) =>
  HOLIDAY_THEMES[id].dateFor(year);

describe("holiday dates", () => {
  it("computes Easter with the Gregorian algorithm", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(easterSunday(2028)).toBe("2028-04-16");
  });

  it("computes floating holidays", () => {
    expect(dateOf("mlk-day", 2027)).toBe("2027-01-18");
    expect(dateOf("mothers-day", 2027)).toBe("2027-05-09");
    expect(dateOf("memorial-day", 2027)).toBe("2027-05-31");
    expect(dateOf("fathers-day", 2027)).toBe("2027-06-20");
    expect(dateOf("thanksgiving", 2026)).toBe("2026-11-26");
    expect(dateOf("thanksgiving", 2027)).toBe("2027-11-25");
  });

  it("computes fixed holidays", () => {
    expect(dateOf("new-years-day", 2027)).toBe("2027-01-01");
    expect(dateOf("valentines-day", 2027)).toBe("2027-02-14");
    expect(dateOf("st-patricks-day", 2027)).toBe("2027-03-17");
    expect(dateOf("cinco-de-mayo", 2027)).toBe("2027-05-05");
    expect(dateOf("independence-day", 2027)).toBe("2027-07-04");
    expect(dateOf("halloween", 2026)).toBe("2026-10-31");
    expect(dateOf("veterans-day", 2026)).toBe("2026-11-11");
    expect(dateOf("christmas-eve", 2026)).toBe("2026-12-24");
    expect(dateOf("christmas-day", 2026)).toBe("2026-12-25");
    expect(dateOf("new-years-eve", 2026)).toBe("2026-12-31");
  });

  it("never lets two holidays share a day", () => {
    for (let year = 2024; year <= 2040; year++) {
      const dates = HOLIDAY_IDS.map((id) => dateOf(id, year));
      expect(new Set(dates).size).toBe(HOLIDAY_IDS.length);
    }
  });
});

describe("activeHolidayId", () => {
  it("finds the holiday for a date key", () => {
    expect(activeHolidayId("2026-11-26")).toBe("thanksgiving");
    expect(activeHolidayId("2027-03-28")).toBe("easter-sunday");
    expect(activeHolidayId("2026-12-31")).toBe("new-years-eve");
  });

  it("returns null on ordinary days", () => {
    expect(activeHolidayId("2026-11-27")).toBeNull();
    expect(activeHolidayId("2027-03-27")).toBeNull();
  });

  it("resolves the date in America/New_York", () => {
    // 03:00 UTC on Dec 25 is still the evening of Dec 24 in New York.
    const lateEve = new Date("2026-12-25T03:00:00.000Z");
    expect(holidayDateKeyNy(lateEve)).toBe("2026-12-24");
    expect(activeHolidayId(holidayDateKeyNy(lateEve))).toBe("christmas-eve");
  });
});

describe("holiday ids", () => {
  it("validates ids and has a theme with copy for each", () => {
    expect(isHolidayId("halloween")).toBe(true);
    expect(isHolidayId("arbor-day")).toBe(false);
    expect(isHolidayId(null)).toBe(false);
    for (const id of HOLIDAY_IDS) {
      const t = HOLIDAY_THEMES[id];
      expect(t.id).toBe(id);
      expect(t.greeting.length).toBeGreaterThan(3);
      expect(t.tagline.length).toBeGreaterThan(10);
    }
  });
});
