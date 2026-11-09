import { describe, expect, it } from "vitest";
import {
  accessoryLineQty,
  accessoryRollupUnitPrice,
  effectiveProductUnitPrice,
  isCumulativePackageName,
} from "./product-accessories";

describe("product accessories", () => {
  it("scales child qty from parent qty", () => {
    expect(accessoryLineQty(2, 1.5)).toBe(3);
    expect(accessoryLineQty(0, 4)).toBe(0);
  });

  it("rolls up accessory unit prices per parent", () => {
    expect(
      accessoryRollupUnitPrice([
        { qty: 2, unitPrice: 50 },
        { qty: 1, unitPrice: 25 },
      ]),
    ).toBe(125);
    expect(accessoryRollupUnitPrice([])).toBe(0);
  });

  it("prefers listed rental price over rollup when set", () => {
    expect(effectiveProductUnitPrice(400, 125)).toBe(400);
    expect(effectiveProductUnitPrice(0, 125)).toBe(125);
    expect(effectiveProductUnitPrice(0, 0)).toBe(0);
  });
});

describe("isCumulativePackageName", () => {
  it("matches packages named with a leading '0 -'", () => {
    expect(isCumulativePackageName("0 - Audio Package")).toBe(true);
    expect(isCumulativePackageName("0 - Tech Table")).toBe(true);
    expect(isCumulativePackageName(" 0 - Visual Package")).toBe(true);
  });
  it("ignores everything else", () => {
    expect(isCumulativePackageName("General Session package")).toBe(false);
    expect(isCumulativePackageName("10 - Something")).toBe(false);
    expect(isCumulativePackageName(null)).toBe(false);
  });
});
