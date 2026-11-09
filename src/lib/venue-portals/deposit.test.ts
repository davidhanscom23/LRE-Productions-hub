import { describe, expect, it } from "vitest";
import { depositAmount } from "./deposit";

describe("venue portal deposit", () => {
  it("takes percent of post-discount total", () => {
    expect(depositAmount(2571, 50)).toBe(1285.5);
    expect(depositAmount(100, 50)).toBe(50);
    expect(depositAmount(99.99, 50)).toBe(50);
  });

  it("clamps pct and total", () => {
    expect(depositAmount(-10, 50)).toBe(0);
    expect(depositAmount(100, 0)).toBe(0);
    expect(depositAmount(100, 150)).toBe(100);
  });
});
