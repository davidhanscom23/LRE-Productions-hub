import { describe, expect, it } from "vitest";
import {
  classifyMiles,
  haversineMiles,
  isLowQualityAddress,
  isUnplaceableAddress,
  mentionsUsState,
  withDefaultState,
} from "./geo-zones";

// Y? travel policy: pass <= 60 mi, risky <= 90 mi (travel fee), "talk" beyond, never a hard fail.
const Y_ZONES = { passMiles: 60, riskyMiles: 90, talkMiles: 150, maxMiles: null };

describe("classifyMiles", () => {
  it("applies the rings with inclusive upper bounds", () => {
    expect(classifyMiles(0, Y_ZONES)).toBe("pass");
    expect(classifyMiles(60, Y_ZONES)).toBe("pass");
    expect(classifyMiles(60.1, Y_ZONES)).toBe("risky");
    expect(classifyMiles(90, Y_ZONES)).toBe("risky");
    expect(classifyMiles(90.5, Y_ZONES)).toBe("talk");
    expect(classifyMiles(150, Y_ZONES)).toBe("talk");
  });

  it("never fails when maxMiles is null", () => {
    expect(classifyMiles(151, Y_ZONES)).toBe("talk");
    expect(classifyMiles(2500, Y_ZONES)).toBe("talk");
  });

  it("fails beyond the talk ring when a maximum is set", () => {
    const zones = { passMiles: 60, riskyMiles: 90, talkMiles: 150, maxMiles: 150 };
    expect(classifyMiles(150, zones)).toBe("talk");
    expect(classifyMiles(150.1, zones)).toBe("fail");
  });

  it("treats a maximum below the talk ring as a hard cap", () => {
    const zones = { passMiles: 60, riskyMiles: 90, talkMiles: 150, maxMiles: 100 };
    expect(classifyMiles(95, zones)).toBe("talk");
    expect(classifyMiles(101, zones)).toBe("fail");
    expect(classifyMiles(50, { ...zones, maxMiles: 40 })).toBe("fail");
  });

  it("sorts the ring thresholds defensively (pass 90 / risky 60 typo)", () => {
    const swapped = { passMiles: 90, riskyMiles: 60, talkMiles: 150, maxMiles: null };
    expect(classifyMiles(50, swapped)).toBe("pass");
    expect(classifyMiles(70, swapped)).toBe("risky");
    expect(classifyMiles(120, swapped)).toBe("talk");
  });

  it("honors a 0 threshold instead of replacing it with a default (LeadGate bug B13)", () => {
    const zones = { passMiles: 0, riskyMiles: 30, talkMiles: 60, maxMiles: null };
    expect(classifyMiles(0, zones)).toBe("pass");
    expect(classifyMiles(0.5, zones)).toBe("risky");
  });

  it("returns unverified for distances that are not real", () => {
    for (const m of [Number.NaN, -1, Number.POSITIVE_INFINITY]) expect(classifyMiles(m, Y_ZONES)).toBe("unverified");
    expect(classifyMiles("12" as unknown as number, Y_ZONES)).toBe("unverified");
  });

  it("survives junk zone numbers", () => {
    const junk = { passMiles: Number.NaN, riskyMiles: -5, talkMiles: 50, maxMiles: null };
    expect(classifyMiles(0, junk)).toBe("pass");
    expect(classifyMiles(10, junk)).toBe("talk");
    expect(classifyMiles(60, junk)).toBe("talk");
  });
});

describe("isLowQualityAddress (LeadGate heuristics)", () => {
  it("flags vague or unusable answers", () => {
    for (const t of [
      "",
      "TBD",
      "Home",
      "my house",
      "The venue",
      "our place in town",
      "not sure yet",
      "Unknown location",
      "somewhere nice",
      "N/A",
      "McDonald's",
      "32081",
      "123456789",
      "!!!???..",
      "Jacksonville",
      "Ponte Vedra",
      "Naples, FL",
    ]) {
      expect(isLowQualityAddress(t), t).toBe(true);
    }
  });

  it("accepts real addresses and venues", () => {
    for (const t of [
      "123 Main St, Jacksonville, FL 32202",
      "Casa Monica Hotel, St. Augustine",
      "TPC Sawgrass, Ponte Vedra Beach",
      "101 Marketside Avenue, Ponte Vedra",
      "Treaty Oak Park Jacksonville FL",
    ]) {
      expect(isLowQualityAddress(t), t).toBe(false);
    }
  });

  it("does not flag every place starting with 'na' (LeadGate regex had no word boundary)", () => {
    expect(isLowQualityAddress("Nashville Music City Center")).toBe(false);
    expect(isLowQualityAddress("Naples Botanical Garden")).toBe(false);
    expect(isLowQualityAddress("Somerset Hotel Jacksonville")).toBe(false);
  });
});

describe("isUnplaceableAddress (nothing to look up)", () => {
  it("flags answers with no place in them", () => {
    for (const t of ["", "x", "TBD", "tba", "n/a", "not sure", "somewhere", "my house", "the venue", "home", "church", "Wendy's", "12345", "?!?!"]) {
      expect(isUnplaceableAddress(t), t).toBe(true);
    }
  });

  it("lets rough city answers through (they are low quality, but placeable)", () => {
    for (const t of ["Tampa", "St. Augustine", "Orlando, FL", "Amelia Island", "Naples", "Casa Monica, St. Augustine"]) {
      expect(isUnplaceableAddress(t), t).toBe(false);
    }
    expect(isLowQualityAddress("St. Augustine")).toBe(true);
  });
});

describe("mentionsUsState / withDefaultState", () => {
  it("appends the default state only when none is named", () => {
    expect(withDefaultState("Jacksonville", "FL")).toBe("Jacksonville, FL");
    expect(withDefaultState("Casa Monica Hotel, St. Augustine", "FL")).toBe("Casa Monica Hotel, St. Augustine, FL");
    expect(withDefaultState("Jacksonville, FL", "FL")).toBe("Jacksonville, FL");
    expect(withDefaultState("jacksonville fl 32202", "FL")).toBe("jacksonville fl 32202");
    expect(withDefaultState("Savannah, Georgia", "FL")).toBe("Savannah, Georgia");
    expect(withDefaultState("Orlando FL near the beach", "FL")).toBe("Orlando FL near the beach");
    expect(withDefaultState("  ", "FL")).toBe("");
  });

  it("does not read everyday words as state codes", () => {
    expect(mentionsUsState("WEDDING VENUE IN PONTE VEDRA")).toBe(false);
    expect(mentionsUsState("Party in the park")).toBe(false);
    expect(mentionsUsState("Tallahassee, in")).toBe(true);
  });
});

describe("haversineMiles", () => {
  it("measures great-circle miles", () => {
    expect(haversineMiles(0, 0, 0, 1)).toBeCloseTo(69.09, 1);
    expect(haversineMiles(30.24, -81.3853, 30.24, -81.3853)).toBe(0);
    const a = haversineMiles(30.3322, -81.6557, 29.8947, -81.3145);
    const b = haversineMiles(29.8947, -81.3145, 30.3322, -81.6557);
    expect(a).toBeCloseTo(b, 9);
    expect(a).toBeGreaterThan(35);
    expect(a).toBeLessThan(40);
  });
});
