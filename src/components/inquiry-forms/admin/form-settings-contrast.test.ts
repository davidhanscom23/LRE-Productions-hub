import { describe, expect, it } from "vitest";
import { MIN_TEXT_CONTRAST, contrastRatio, darkenForWhiteText, normalizeHex, whiteTextContrast } from "./form-settings-contrast";

describe("accent contrast", () => {
  it("normalizes hex input", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex(" #AE4213 ")).toBe("#ae4213");
    expect(normalizeHex("red")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
  });

  it("scores white text on the brand accents", () => {
    expect(whiteTextContrast("#ae4213")).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST); // LRE Productions
    expect(whiteTextContrast("#d6001c")).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST); // Partner Brand
    expect(whiteTextContrast("#9a7340")).toBeLessThan(MIN_TEXT_CONTRAST); // LRE bronze: too light
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(whiteTextContrast("nope")).toBeNull();
  });

  it("finds a darker shade of the same color that passes", () => {
    const fixed = darkenForWhiteText("#9a7340");
    expect(fixed).not.toBeNull();
    expect(whiteTextContrast(fixed as string)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    // Same hue family: still more red than blue.
    const r = parseInt((fixed as string).slice(1, 3), 16);
    const b = parseInt((fixed as string).slice(5, 7), 16);
    expect(r).toBeGreaterThan(b);
    expect(darkenForWhiteText("#ae4213")).toBe("#ae4213");
  });
});
