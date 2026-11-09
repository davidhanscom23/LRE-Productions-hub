import { describe, expect, it } from "vitest";
import { DATE_POINTS, LOCATION_POINTS, computeScore, scoreLabelFor, shouldCelebrate } from "./scoring";
import type { DateResult, LocationResult, Qualification } from "./types";

const at = "2026-11-04T20:00:00Z";
const date = (result: DateResult): Qualification["date"] => ({ result, checkedFor: "2027-05-15", message: "", checkedAt: at });
const loc = (result: LocationResult): Qualification["location"] => ({ result, message: "", checkedAt: at });

describe("computeScore", () => {
  it("scores an empty qualification as absent date (+5) and absent location (+5)", () => {
    expect(computeScore({})).toEqual({ score: 60, label: "medium" });
  });

  it("applies the spec's point table", () => {
    expect(DATE_POINTS).toEqual({ available: 30, open: 20, limited: 10, unknown: 5, skipped: 5, unavailable: -20, blackout: -20, too_soon: -20 });
    expect(LOCATION_POINTS).toEqual({ pass: 20, risky: 10, talk: 5, unverified: 5, skipped: 5, fail: -20 });
    expect(computeScore({ date: date("available"), location: loc("pass") })).toEqual({ score: 100, label: "high" });
    expect(computeScore({ date: date("open") })).toEqual({ score: 75, label: "high" });
    expect(computeScore({ date: date("limited"), location: loc("talk") })).toEqual({ score: 65, label: "medium" });
    expect(computeScore({ date: date("too_soon"), location: loc("fail") })).toEqual({ score: 10, label: "low" });
    expect(computeScore({ date: date("unknown"), location: loc("unverified"), budget: { passed: null } })).toEqual({ score: 60, label: "medium" });
  });

  it("puts the label boundaries at 70 and 40", () => {
    // 50 + 30 - 20 + 10 = 70
    expect(computeScore({ date: date("available"), location: loc("fail"), budget: { passed: true } })).toEqual({ score: 70, label: "high" });
    // 50 - 20 + 10 = 40
    expect(computeScore({ date: date("blackout"), location: loc("risky") })).toEqual({ score: 40, label: "medium" });
    // 50 - 20 + 20 - 15 = 35
    expect(computeScore({ date: date("unavailable"), location: loc("pass"), budget: { passed: false } })).toEqual({ score: 35, label: "low" });
    expect(scoreLabelFor(69)).toBe("medium");
    expect(scoreLabelFor(39)).toBe("low");
  });

  it("adds +15 for an alternative date and clamps to 0..100", () => {
    expect(computeScore({ date: date("available"), location: loc("pass"), budget: { passed: true }, altDateChosen: true })).toEqual({ score: 100, label: "high" });
    expect(computeScore({ date: date("unavailable"), location: loc("fail"), budget: { passed: false } })).toEqual({ score: 0, label: "low" });
    expect(computeScore({ date: date("open"), altDateChosen: true }).score).toBe(90);
  });

  it("is computed once from the verdicts: repeating never stacks the budget (LeadGate bug B6)", () => {
    const q: Qualification = { date: date("open"), budget: { passed: true } };
    const first = computeScore(q);
    expect(computeScore(q)).toEqual(first);
    expect(first.score).toBe(85);
  });

  it("treats corrupt verdict strings like absent ones", () => {
    const q = { date: { ...date("open"), result: "uncertain" }, location: { ...loc("pass"), result: "low_quality" } } as unknown as Qualification;
    expect(computeScore(q).score).toBe(60);
    expect(computeScore(undefined as unknown as Qualification).score).toBe(60);
  });

  it("every combination yields an integer 0..100 with a label the DB CHECK accepts", () => {
    const dates: (DateResult | undefined)[] = [undefined, ...(Object.keys(DATE_POINTS) as DateResult[])];
    const locations: (LocationResult | undefined)[] = [undefined, ...(Object.keys(LOCATION_POINTS) as LocationResult[])];
    const budgets: (boolean | null | undefined)[] = [undefined, null, true, false];
    let count = 0;
    for (const d of dates)
      for (const l of locations)
        for (const b of budgets)
          for (const alt of [false, true]) {
            const q: Qualification = {
              ...(d ? { date: date(d) } : {}),
              ...(l ? { location: loc(l) } : {}),
              ...(b !== undefined ? { budget: { passed: b } } : {}),
              altDateChosen: alt,
            };
            const { score, label } = computeScore(q);
            expect(Number.isInteger(score)).toBe(true);
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
            expect(["high", "medium", "low"]).toContain(label);
            expect(label).toBe(score >= 70 ? "high" : score >= 40 ? "medium" : "low");
            count += 1;
          }
    expect(count).toBe(9 * 7 * 4 * 2);
  });
});

describe("shouldCelebrate", () => {
  it("needs an available date", () => {
    expect(shouldCelebrate({ date: date("available") }, ["date"])).toBe(true);
    for (const r of ["open", "limited", "unknown", "skipped", "unavailable", "blackout", "too_soon"] as DateResult[]) {
      expect(shouldCelebrate({ date: date(r) }, ["date"]), r).toBe(false);
    }
    expect(shouldCelebrate({}, ["date"])).toBe(false);
  });

  it("with a location check, the location must be pass or risky", () => {
    expect(shouldCelebrate({ date: date("available"), location: loc("pass") }, ["date", "location"])).toBe(true);
    expect(shouldCelebrate({ date: date("available"), location: loc("risky") }, ["date", "location"])).toBe(true);
    for (const r of ["talk", "fail", "unverified", "skipped"] as LocationResult[]) {
      expect(shouldCelebrate({ date: date("available"), location: loc(r) }, ["date", "location"]), r).toBe(false);
    }
    expect(shouldCelebrate({ date: date("available") }, ["date", "location"])).toBe(false);
  });

  it("ignores a location verdict the step did not check", () => {
    expect(shouldCelebrate({ date: date("available"), location: loc("fail") }, ["date"])).toBe(true);
  });
});
