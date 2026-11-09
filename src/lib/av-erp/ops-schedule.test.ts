import { describe, expect, it } from "vitest";
import {
  coveredDaysInMonth,
  jobsInRange,
  startOfMonthUtc,
  endOfMonthUtc,
  travelEventsForDay,
  ymdInZone,
  type GearJobWindow,
} from "./ops-schedule";

const base: GearJobWindow = {
  id: "1",
  reference: "Q-1",
  subject: "Show",
  status: "order",
  gearStartsAt: "2026-11-10T13:00:00.000Z", // 8am EST
  gearEndsAt: "2026-11-12T17:00:00.000Z",
  customerName: "Acme",
  venueName: "Hall",
  hasHolds: true,
  stillOut: false,
};

describe("ops-schedule", () => {
  it("ymdInZone formats Eastern wall date", () => {
    expect(ymdInZone("2026-11-10T13:00:00.000Z", "America/New_York")).toBe(
      "2026-11-10",
    );
  });

  it("filters jobs overlapping a month range", () => {
    const start = startOfMonthUtc(2026, 10); // Nov
    const end = endOfMonthUtc(2026, 10);
    expect(jobsInRange([base], start, end)).toHaveLength(1);
    expect(
      jobsInRange(
        [{ ...base, gearStartsAt: "2026-12-01T12:00:00.000Z", gearEndsAt: "2026-12-02T12:00:00.000Z" }],
        start,
        end,
      ),
    ).toHaveLength(0);
  });

  it("lists leave/return travel events for a day", () => {
    const leave = travelEventsForDay([base], "2026-11-10");
    expect(leave.map((e) => e.bucket)).toEqual(["leave"]);
    const ret = travelEventsForDay([base], "2026-11-12");
    expect(ret.map((e) => e.bucket)).toEqual(["return"]);
  });

  it("covers each Eastern day the gear is away", () => {
    const days = coveredDaysInMonth(
      base.gearStartsAt,
      base.gearEndsAt,
      2026,
      10,
    );
    expect(days).toEqual([10, 11, 12]);
  });
});
