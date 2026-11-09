import { describe, expect, it } from "vitest";
import { cleanCategoryName, mergeCategories } from "./category-list";

describe("mergeCategories", () => {
  it("keeps defaults first and drops case-insensitive duplicates", () => {
    const out = mergeCategories(["DMC Tours", "other"], ["DMC Tours", "Ground transport"]);
    expect(out[0]).toBe("Planning & coordination");
    expect(out.filter((c) => c.toLowerCase() === "other")).toHaveLength(1);
    expect(out).toContain("DMC Tours");
    expect(out).toContain("Ground transport");
    expect(out.filter((c) => c === "DMC Tours")).toHaveLength(1);
  });
  it("cleans names", () => {
    expect(cleanCategoryName("  DMC   Tours ")).toBe("DMC Tours");
    expect(cleanCategoryName("x".repeat(100))).toHaveLength(60);
  });
});
