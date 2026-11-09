import { describe, expect, it } from "vitest";
import { INK, WHITE, buildFormTheme, contrastRatio, mixHex, normalizeHex, readableOn } from "./theme";

const BRAND_ACCENTS = {
  primary: "#ae4213",
  partnerBrand: "#d6001c",
  videntBronze: "#9a7340",
  videntAv: "#c00000",
};

describe("normalizeHex", () => {
  it("accepts 3 and 6 digit hex in any case", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex(" #AE4213 ")).toBe("#ae4213");
  });
  it("rejects anything else", () => {
    expect(normalizeHex("ae4213")).toBeNull();
    expect(normalizeHex("#ae421")).toBeNull();
    expect(normalizeHex("red")).toBeNull();
    expect(normalizeHex(null)).toBeNull();
    expect(normalizeHex(12)).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("matches WCAG reference values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // #767676 is the classic 4.54:1 gray on white
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThan(4.5);
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
  });
});

describe("mixHex", () => {
  it("mixes in sRGB and clamps the weight", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#123456", "#ffffff", 0)).toBe("#123456");
    expect(mixHex("#123456", "#ffffff", 2)).toBe("#ffffff");
  });
});

describe("buildFormTheme", () => {
  for (const [name, accent] of Object.entries(BRAND_ACCENTS)) {
    it(`${name} (${accent}) keeps every text pair at AA`, () => {
      const t = buildFormTheme(accent);
      expect(contrastRatio(t["--iqf-accent"], t["--iqf-on-accent"])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t["--iqf-accent-text"], WHITE)).toBeGreaterThanOrEqual(4.5);
      // body text on the selected-card tint stays readable
      expect(contrastRatio(INK, t["--iqf-accent-soft"])).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("keeps an accent that already carries white text unchanged", () => {
    const t = buildFormTheme(BRAND_ACCENTS.primary);
    expect(t["--iqf-accent"]).toBe("#ae4213");
    expect(t["--iqf-on-accent"]).toBe(WHITE);
    expect(t["--iqf-accent-text"]).toBe("#ae4213");
  });

  it("darkens a mid-tone accent (Vident bronze) instead of switching to a dark label", () => {
    expect(contrastRatio(BRAND_ACCENTS.videntBronze, WHITE)).toBeLessThan(4.5);
    const t = buildFormTheme(BRAND_ACCENTS.videntBronze);
    expect(t["--iqf-on-accent"]).toBe(WHITE);
    expect(t["--iqf-accent"]).not.toBe(BRAND_ACCENTS.videntBronze);
  });

  it("puts ink on a light accent that darkening cannot rescue", () => {
    const t = buildFormTheme("#ffd400");
    expect(t["--iqf-on-accent"]).toBe(INK);
    expect(t["--iqf-accent"]).toBe("#ffd400");
    expect(contrastRatio(t["--iqf-accent-text"], WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it("falls back to a neutral accent for invalid input", () => {
    const t = buildFormTheme("not a color");
    expect(normalizeHex(t["--iqf-accent"])).not.toBeNull();
    expect(contrastRatio(t["--iqf-accent"], t["--iqf-on-accent"])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("readableOn", () => {
  it("picks ink on light and white on dark", () => {
    expect(readableOn("#ffffff")).toBe(INK);
    expect(readableOn("#15171a")).toBe(WHITE);
    expect(readableOn("garbage")).toBe(INK);
  });
});
