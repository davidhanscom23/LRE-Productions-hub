import { describe, expect, it } from "vitest";
import { canScanGear, isGearAdmin } from "./access";

describe("gear tag access", () => {
  it("lets admins, Leads and staff scan, never guests", () => {
    expect(canScanGear({ role: "admin" })).toBe(true);
    expect(canScanGear({ role: "trainer" })).toBe(true);
    expect(canScanGear({ role: "staff" })).toBe(true);
    expect(canScanGear({ role: "guest" })).toBe(false);
    expect(canScanGear(null)).toBe(false);
  });

  it("keeps direct edits to admins", () => {
    expect(isGearAdmin({ role: "admin" })).toBe(true);
    expect(isGearAdmin({ role: "trainer" })).toBe(false);
    expect(isGearAdmin({ role: "staff" })).toBe(false);
    expect(isGearAdmin(undefined)).toBe(false);
  });
});
