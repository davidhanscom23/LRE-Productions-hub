import { describe, expect, it } from "vitest";
import {
  crewBillableDays,
  crewLaborCostAmount,
  crewLaborCostDescription,
  easternYmdFromIso,
  shouldSyncCrewLaborCost,
} from "./crew-cost-rollup";

describe("crew cost rollup", () => {
  it("counts inclusive Eastern calendar days", () => {
    // Same Eastern day
    expect(
      crewBillableDays(
        "2026-10-31T12:00:00.000Z", // 8am EDT
        "2026-10-31T20:00:00.000Z",
      ),
    ).toBe(1);
    // Spans two Eastern days (evening → next morning)
    expect(
      crewBillableDays(
        "2026-10-31T22:00:00.000Z", // 6pm EDT Oct 31
        "2026-11-01T14:00:00.000Z", // 10am EDT Nov 1
      ),
    ).toBe(2);
    // Fixed Eastern wall times via known offsets (avoid DST edge cases)
    expect(
      crewBillableDays(
        "2026-06-01T16:00:00.000Z", // noon EDT Jun 1
        "2026-06-03T16:00:00.000Z", // noon EDT Jun 3 → 3 days
      ),
    ).toBe(3);
  });

  it("formats Eastern ymd", () => {
    expect(easternYmdFromIso("2026-11-01T03:30:00.000Z")).toBe("2026-10-31");
  });

  it("computes labor amount from day rate × days", () => {
    expect(
      crewLaborCostAmount(
        400,
        "2026-10-31T12:00:00.000Z",
        "2026-10-31T20:00:00.000Z",
      ),
    ).toBe(400);
    expect(
      crewLaborCostAmount(
        250.5,
        "2026-10-31T22:00:00.000Z",
        "2026-11-01T14:00:00.000Z",
      ),
    ).toBe(501);
    expect(crewLaborCostAmount(null, "2026-10-31T12:00:00.000Z", "2026-10-31T20:00:00.000Z")).toBe(
      null,
    );
    expect(crewLaborCostAmount(0, "2026-10-31T12:00:00.000Z", "2026-10-31T20:00:00.000Z")).toBe(
      null,
    );
  });

  it("only syncs confirmed + rate + roll flag", () => {
    expect(
      shouldSyncCrewLaborCost({
        status: "confirmed",
        dayRate: 100,
        rollIntoCosts: true,
      }),
    ).toBe(true);
    expect(
      shouldSyncCrewLaborCost({
        status: "offered",
        dayRate: 100,
        rollIntoCosts: true,
      }),
    ).toBe(false);
    expect(
      shouldSyncCrewLaborCost({
        status: "confirmed",
        dayRate: 100,
        rollIntoCosts: false,
      }),
    ).toBe(false);
    expect(
      shouldSyncCrewLaborCost({
        status: "cancelled",
        dayRate: 100,
        rollIntoCosts: true,
      }),
    ).toBe(false);
  });

  it("builds a readable cost description", () => {
    expect(
      crewLaborCostDescription({
        personName: "Alex Rivera",
        roleLabel: "A1",
        days: 2,
        dayRate: 350,
      }),
    ).toBe("Crew: Alex Rivera · A1 (2 days × $350.00)");
  });
});
