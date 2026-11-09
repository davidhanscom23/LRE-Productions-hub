import { describe, expect, it } from "vitest";
import {
  alternativeCandidates,
  BOOKINGS_HORIZON_DAYS,
  dateMessage,
  earliestBookableDate,
  inBlackout,
  isGoodAlternative,
  resultFromBookings,
  screenDate,
  wantsAlternatives,
} from "./availability-core";

const today = "2026-11-04";
const base = { today, blackouts: [], minNoticeDays: null };

describe("screenDate", () => {
  it("skips when the check is off or no date was given", () => {
    expect(screenDate({ ...base, mode: "off", date: "2027-05-15" })).toBe("skipped");
    expect(screenDate({ ...base, mode: "bookings", date: null })).toBe("skipped");
    expect(screenDate({ ...base, mode: "bookings", date: "" })).toBe("skipped");
  });

  it("answers unknown for a malformed date instead of guessing", () => {
    expect(screenDate({ ...base, mode: "bookings", date: "05/15/2027" })).toBe("unknown");
  });

  it("calls past dates and dates inside the minimum notice too soon", () => {
    expect(screenDate({ ...base, mode: "bookings", date: "2026-11-03" })).toBe("too_soon");
    expect(screenDate({ ...base, mode: "bookings", date: "2026-11-04" })).toBeNull();
    expect(screenDate({ ...base, mode: "bookings", minNoticeDays: 7, date: "2026-11-10" })).toBe("too_soon");
    expect(screenDate({ ...base, mode: "bookings", minNoticeDays: 7, date: "2026-11-11" })).toBeNull();
  });

  it("blocks blackout ranges (inclusive, either order)", () => {
    const blackouts = [{ start: "2026-12-24", end: "2026-12-26", label: "Holiday" }];
    expect(screenDate({ ...base, blackouts, mode: "bookings", date: "2026-12-24" })).toBe("blackout");
    expect(screenDate({ ...base, blackouts, mode: "bookings", date: "2026-12-26" })).toBe("blackout");
    expect(screenDate({ ...base, blackouts, mode: "bookings", date: "2026-12-27" })).toBeNull();
    expect(inBlackout("2026-12-25", [{ start: "2026-12-26", end: "2026-12-24" }])).toBe(true);
    expect(inBlackout("2026-12-25", [{ start: "bad", end: "2026-12-26" }])).toBe(false);
  });

  it("answers open in open mode once the blocking rules pass", () => {
    expect(screenDate({ ...base, mode: "open", date: "2027-05-15" })).toBe("open");
    expect(screenDate({ ...base, mode: "open", date: "2026-11-01" })).toBe("too_soon");
  });

  it("answers unknown past the bookings horizon and asks for the count inside it", () => {
    const inside = "2028-04-27"; // today + 540
    expect(screenDate({ ...base, mode: "bookings", date: inside })).toBeNull();
    expect(screenDate({ ...base, mode: "bookings", date: "2028-04-28" })).toBe("unknown");
    expect(BOOKINGS_HORIZON_DAYS).toBe(540);
  });

  it("finds the earliest bookable date", () => {
    expect(earliestBookableDate(today, null)).toBe(today);
    expect(earliestBookableDate(today, 0)).toBe(today);
    expect(earliestBookableDate(today, 3)).toBe("2026-11-07");
  });
});

describe("resultFromBookings", () => {
  it("never fails open when capacity is unknown", () => {
    expect(resultFromBookings(0, null)).toBe("unknown");
    expect(resultFromBookings(Number.NaN, 5)).toBe("unknown");
  });

  it("applies the capacity rule", () => {
    expect(resultFromBookings(0, 0)).toBe("unavailable");
    expect(resultFromBookings(0, 1)).toBe("available");
    expect(resultFromBookings(1, 1)).toBe("unavailable");
    expect(resultFromBookings(0, 2)).toBe("available");
    expect(resultFromBookings(1, 2)).toBe("limited");
    expect(resultFromBookings(2, 2)).toBe("unavailable");
    expect(resultFromBookings(3, 6)).toBe("available");
    expect(resultFromBookings(5, 6)).toBe("limited");
    expect(resultFromBookings(7, 6)).toBe("unavailable");
  });
});

describe("alternatives", () => {
  it("lists candidates nearest first within 21 days", () => {
    const list = alternativeCandidates("2027-05-15");
    expect(list).toHaveLength(42);
    expect(list.slice(0, 4)).toEqual(["2027-05-16", "2027-05-14", "2027-05-17", "2027-05-13"]);
    expect(list[list.length - 2]).toBe("2027-06-05");
    expect(list[list.length - 1]).toBe("2027-04-24");
  });

  it("crosses month and year boundaries on the wall calendar", () => {
    expect(alternativeCandidates("2026-12-31", 1)).toEqual(["2027-01-01", "2026-12-30"]);
    expect(alternativeCandidates("2028-03-01", 1)).toEqual(["2028-03-02", "2028-02-29"]);
  });

  it("offers alternatives only for blocked dates and only keeps clean yeses", () => {
    expect(wantsAlternatives("unavailable")).toBe(true);
    expect(wantsAlternatives("blackout")).toBe(true);
    expect(wantsAlternatives("too_soon")).toBe(true);
    expect(wantsAlternatives("limited")).toBe(false);
    expect(wantsAlternatives("unknown")).toBe(false);
    expect(isGoodAlternative("available")).toBe(true);
    expect(isGoodAlternative("open")).toBe(true);
    expect(isGoodAlternative("limited")).toBe(false);
    expect(isGoodAlternative("unknown")).toBe(false);
  });
});

describe("dateMessage", () => {
  const messages = {
    available: "A",
    open: "O",
    limited: "L",
    unavailable: "U",
    unknown: "K",
    tooSoon: "T",
    blackout: "B",
  };

  it("maps every result to its message and says nothing when skipped", () => {
    expect(dateMessage("available", messages)).toBe("A");
    expect(dateMessage("open", messages)).toBe("O");
    expect(dateMessage("limited", messages)).toBe("L");
    expect(dateMessage("unavailable", messages)).toBe("U");
    expect(dateMessage("unknown", messages)).toBe("K");
    expect(dateMessage("too_soon", messages)).toBe("T");
    expect(dateMessage("blackout", messages)).toBe("B");
    expect(dateMessage("skipped", messages)).toBe("");
  });
});
