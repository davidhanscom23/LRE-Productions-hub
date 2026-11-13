import { describe, expect, it } from "vitest";
import {
  canAccessPipeline,
  canAssignPipelineFreely,
  canEditPipelineProject,
  canManagePipelineCrm,
} from "@/lib/pipeline/access";

describe("canAccessPipeline", () => {
  it("allows admin, lead, and staff", () => {
    expect(canAccessPipeline("admin")).toBe(true);
    expect(canAccessPipeline("trainer")).toBe(true);
    expect(canAccessPipeline("staff")).toBe(true);
    expect(canAccessPipeline("guest")).toBe(false);
  });
});

describe("canManagePipelineCrm", () => {
  it("is admin and lead", () => {
    expect(canManagePipelineCrm("admin")).toBe(true);
    expect(canManagePipelineCrm("trainer")).toBe(true);
    expect(canManagePipelineCrm("staff")).toBe(false);
  });
});

describe("canAssignPipelineFreely", () => {
  it("is admin only", () => {
    expect(canAssignPipelineFreely("admin")).toBe(true);
    expect(canAssignPipelineFreely("trainer")).toBe(false);
    expect(canAssignPipelineFreely("staff")).toBe(false);
  });
});

describe("canEditPipelineProject", () => {
  it("lets admin always; lead/staff only when assigned", () => {
    expect(canEditPipelineProject("admin", [], "x")).toBe(true);
    expect(canEditPipelineProject("trainer", [], "x")).toBe(false);
    expect(canEditPipelineProject("trainer", ["x"], "x")).toBe(true);
    expect(canEditPipelineProject("staff", ["a", "b"], "b")).toBe(true);
    expect(canEditPipelineProject("staff", ["a"], "b")).toBe(false);
  });
});
