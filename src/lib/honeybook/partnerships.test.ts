import { describe, expect, it } from "vitest";
import {
  groupPartnershipsByStage,
  isPartnership,
  normalizePartnerKind,
  normalizePartnershipStage,
} from "./partnerships";

describe("partnerships", () => {
  it("detects partnership rows", () => {
    expect(isPartnership({ record_type: "partnership" })).toBe(true);
    expect(isPartnership({ record_type: "event" })).toBe(false);
    expect(isPartnership({})).toBe(false);
    expect(isPartnership(null)).toBe(false);
  });

  it("normalizes stages, falling back to Prospect", () => {
    expect(normalizePartnershipStage("in_talks")).toBe("In Talks");
    expect(normalizePartnershipStage("ACTIVE PARTNER")).toBe("Active Partner");
    expect(normalizePartnershipStage("Inquiry")).toBe("Prospect");
    expect(normalizePartnershipStage("")).toBe("Prospect");
  });

  it("normalizes partner kinds", () => {
    expect(normalizePartnerKind("venue")).toBe("Venue");
    expect(normalizePartnerKind("florist")).toBe("Other");
  });

  it("groups cards into all five columns", () => {
    const g = groupPartnershipsByStage([
      { stage: "In Talks" },
      { stage: "weird" },
      { stage: "Not Moving Forward" },
    ]);
    expect(Object.keys(g)).toHaveLength(5);
    expect(g["In Talks"]).toHaveLength(1);
    expect(g["Prospect"]).toHaveLength(1);
    expect(g["Not Moving Forward"]).toHaveLength(1);
  });
});
