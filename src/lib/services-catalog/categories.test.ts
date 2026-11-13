import { describe, expect, it } from "vitest";
import { categoryOf, textKindForCategory } from "./categories";
import { PIPELINE_SERVICES_SEED } from "./seed";

describe("service catalog", () => {
  it("seed has 134 distinct titles with non-negative prices", () => {
    expect(PIPELINE_SERVICES_SEED).toHaveLength(134);
    expect(new Set(PIPELINE_SERVICES_SEED.map(([n]) => n.trim().toLowerCase())).size).toBe(134);
    expect(PIPELINE_SERVICES_SEED.every(([, p]) => p >= 0)).toBe(true);
  });
  it("categorizes representative items", () => {
    expect(categoryOf("Wedding Management")).toBe("Planning & coordination");
    expect(categoryOf("Transportation - Sedan Transportation")).toBe("Transportation & delivery");
    expect(categoryOf("LINEN - 120\" ROUND BLACK")).toBe("Event rentals");
    expect(categoryOf("Chaffer Pans")).toBe("Kitchen & serving");
    expect(categoryOf("Closest to the Pin Drone Drop")).toBe("Golf & tournament events");
    expect(categoryOf("Backdrop Sign")).toBe("Decor & signage");
    expect(categoryOf("St Augustine Private Sailing Charter")).toBe("Experiences & production");
    expect(categoryOf("Photography")).toBe("Experiences & production");
  });
  it("treats rental categories as rentals and the rest as sales on an estimate", () => {
    expect(textKindForCategory("Event rentals")).toBe("rental");
    expect(textKindForCategory("Kitchen & serving")).toBe("rental");
    expect(textKindForCategory("Golf & tournament events")).toBe("sale");
    expect(textKindForCategory("My custom DMC category")).toBe("sale");
  });
});
