import { describe, expect, it } from "vitest";
import { clearDemoShop, DEMO_PREFIX, loadDemoShop } from "./demo-shop";

describe("demo shop fixtures", () => {
  it("uses a stable hub-demo prefix for idempotent tags", () => {
    expect(DEMO_PREFIX).toBe("hub-demo:");
    expect(`${DEMO_PREFIX}customer-acme`).toMatch(/^hub-demo:/);
  });

  it("exports load and clear helpers", () => {
    expect(typeof loadDemoShop).toBe("function");
    expect(typeof clearDemoShop).toBe("function");
  });
});
