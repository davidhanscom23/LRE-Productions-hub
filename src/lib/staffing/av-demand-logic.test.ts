import { describe, expect, it } from "vitest";
import {
  expandNeedsByDate,
  flattenNeedsUnique,
  opportunitiesNeedingCrew,
  type AvDemandOpportunity,
} from "@/lib/staffing/av-demand-logic";

const base: AvDemandOpportunity = {
  id: "opp-1",
  reference: "Q-100",
  subject: "Gala",
  status: "quotation",
  gear_starts_at: "2026-11-10T14:00:00.000Z",
  gear_ends_at: "2026-11-11T04:00:00.000Z",
};

describe("opportunitiesNeedingCrew", () => {
  it("keeps quotation/order without confirmed crew", () => {
    const gaps = opportunitiesNeedingCrew(
      [base, { ...base, id: "opp-2", status: "draft" }],
      [],
    );
    expect(gaps.map((g) => g.id)).toEqual(["opp-1"]);
  });

  it("drops jobs that already have confirmed crew", () => {
    expect(opportunitiesNeedingCrew([base], ["opp-1"])).toEqual([]);
  });
});

describe("expandNeedsByDate", () => {
  it("places a multi-day gear window on each overlapping board day", () => {
    const byDay = expandNeedsByDate([base], "2026-11-09", "2026-11-12");
    expect(byDay.has("2026-11-10")).toBe(true);
    expect(byDay.has("2026-11-11")).toBe(true);
    expect(byDay.has("2026-11-09")).toBe(false);
    expect(byDay.get("2026-11-10")?.[0]?.reference).toBe("Q-100");
  });
});

describe("flattenNeedsUnique", () => {
  it("returns each opportunity once, soonest day first", () => {
    const byDay = expandNeedsByDate(
      [
        base,
        {
          ...base,
          id: "opp-2",
          reference: "Q-200",
          gear_starts_at: "2026-11-12T12:00:00.000Z",
          gear_ends_at: "2026-11-12T20:00:00.000Z",
        },
      ],
      "2026-11-10",
      "2026-11-14",
    );
    const flat = flattenNeedsUnique(byDay);
    expect(flat.map((n) => n.reference)).toEqual(["Q-100", "Q-200"]);
    expect(flat[0]?.href).toContain("date=2026-11-10");
  });
});
