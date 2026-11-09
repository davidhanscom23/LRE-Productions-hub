import { describe, expect, it } from "vitest";
import {
  canAddResource,
  canDeleteResource,
  canEditResource,
} from "./access";

describe("resource access", () => {
  it("lets every staff level add a resource", () => {
    expect(canAddResource("staff")).toBe(true);
    expect(canAddResource("trainer")).toBe(true);
    expect(canAddResource("admin")).toBe(true);
  });

  it("keeps guests and unknown roles from adding", () => {
    expect(canAddResource("guest")).toBe(false);
    expect(canAddResource(null)).toBe(false);
    expect(canAddResource(undefined)).toBe(false);
  });

  it("keeps edit to leads and admins, delete to admins", () => {
    expect(canEditResource("staff")).toBe(false);
    expect(canEditResource("trainer")).toBe(true);
    expect(canEditResource("admin")).toBe(true);
    expect(canDeleteResource("staff")).toBe(false);
    expect(canDeleteResource("trainer")).toBe(false);
    expect(canDeleteResource("admin")).toBe(true);
  });
});
