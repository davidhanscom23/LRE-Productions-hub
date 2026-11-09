import { describe, expect, it } from "vitest";
import {
  canAccessHoneyBook,
  canAssignHoneyBookFreely,
  canEditHoneyBookProject,
  canManageHoneyBookCrm,
} from "@/lib/honeybook/access";

describe("canAccessHoneyBook", () => {
  it("allows admin, lead, and staff", () => {
    expect(canAccessHoneyBook("admin")).toBe(true);
    expect(canAccessHoneyBook("trainer")).toBe(true);
    expect(canAccessHoneyBook("staff")).toBe(true);
    expect(canAccessHoneyBook("guest")).toBe(false);
  });
});

describe("canManageHoneyBookCrm", () => {
  it("is admin and lead", () => {
    expect(canManageHoneyBookCrm("admin")).toBe(true);
    expect(canManageHoneyBookCrm("trainer")).toBe(true);
    expect(canManageHoneyBookCrm("staff")).toBe(false);
  });
});

describe("canAssignHoneyBookFreely", () => {
  it("is admin only", () => {
    expect(canAssignHoneyBookFreely("admin")).toBe(true);
    expect(canAssignHoneyBookFreely("trainer")).toBe(false);
    expect(canAssignHoneyBookFreely("staff")).toBe(false);
  });
});

describe("canEditHoneyBookProject", () => {
  it("lets admin always; lead/staff only when assigned", () => {
    expect(canEditHoneyBookProject("admin", [], "x")).toBe(true);
    expect(canEditHoneyBookProject("trainer", [], "x")).toBe(false);
    expect(canEditHoneyBookProject("trainer", ["x"], "x")).toBe(true);
    expect(canEditHoneyBookProject("staff", ["a", "b"], "b")).toBe(true);
    expect(canEditHoneyBookProject("staff", ["a"], "b")).toBe(false);
  });
});
