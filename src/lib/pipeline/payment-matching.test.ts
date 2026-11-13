import { describe, expect, it } from "vitest";
import {
  needsMatchReview,
  paymentProjectName,
  rejectedProjectIds,
  suggestProjectsForPayment,
} from "./payment-matching";

const projects = [
  { id: "p1", name: "PS27 Awards Dinner 2027", client_id: "c1", project_date: "2027-02-10" },
  { id: "p2", name: "PS26 Awards Dinner", client_id: "c1", project_date: "2026-02-10" },
  { id: "p3", name: "Wheels & Worship 5", client_id: "c2" },
  { id: "p4", name: "Old merged", merged_into: "p1" },
];

describe("suggestProjectsForPayment", () => {
  it("ranks the closest name and same client first, with several options", () => {
    const out = suggestProjectsForPayment(
      { id: "x", client_id: "c1", paid_at: "2026-01-23T17:00:00Z", raw: { project_name: "PS27 Awards Dinner" } },
      projects,
    );
    expect(out[0].projectId).toBe("p1");
    expect(out.map((s) => s.projectId)).toContain("p2");
    expect(out.find((s) => s.projectId === "p3")).toBeUndefined();
  });

  it("skips merged projects, partnerships and rejected suggestions", () => {
    const out = suggestProjectsForPayment(
      { id: "x", client_id: "c1", raw: { project_name: "PS27 Awards Dinner" } },
      [...projects, { id: "p5", name: "PS27 Awards Dinner", record_type: "partnership" }],
      { rejectedProjectIds: ["p1"] },
    );
    expect(out.find((s) => s.projectId === "p1")).toBeUndefined();
    expect(out.find((s) => s.projectId === "p4")).toBeUndefined();
    expect(out.find((s) => s.projectId === "p5")).toBeUndefined();
  });

  it("offers nothing when there is no real clue", () => {
    expect(suggestProjectsForPayment({ id: "x", raw: {} }, projects)).toEqual([]);
  });
});

describe("helpers", () => {
  it("reads the project name from the payload", () => {
    expect(paymentProjectName({ project_name: " Gala " })).toBe("Gala");
    expect(paymentProjectName({ project: { name: "Gala 2" } })).toBe("Gala 2");
    expect(paymentProjectName(null)).toBe("");
  });
  it("knows what needs review", () => {
    expect(needsMatchReview({ project_id: null, raw: {} })).toBe(true);
    expect(needsMatchReview({ project_id: "p1", raw: {} })).toBe(false);
    expect(needsMatchReview({ project_id: null, raw: { match_no_project: true } })).toBe(false);
    expect(rejectedProjectIds({ match_rejected_project_ids: ["a", 3] })).toEqual(["a"]);
  });
});
