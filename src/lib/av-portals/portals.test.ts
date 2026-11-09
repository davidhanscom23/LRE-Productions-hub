import { describe, expect, it } from "vitest";
import { classifyFile, computeStatus, parseContact, parseHeadcount } from "./items";
import { daysUntil, pickCheckinKind } from "./cadence";

describe("classifyFile", () => {
  it("matches common names", () => {
    expect(classifyFile("Ballroom_Floor-Plan_v2.pdf")).toBe("floor_plan");
    expect(classifyFile("Gala Run of Show FINAL.docx")).toBe("run_of_show");
    expect(classifyFile("timeline.xlsx")).toBe("run_of_show");
    expect(classifyFile("Keynote deck.key")).toBe("presentation");
    expect(classifyFile("welcome.mp4", "video/mp4")).toBe("presentation");
    expect(classifyFile("dock and parking info.pdf")).toBe("load_in");
    expect(classifyFile("IMG_4421.pdf")).toBe("other");
  });
});

describe("computeStatus", () => {
  it("is incomplete with nothing", () => {
    const s = computeStatus({}, []);
    expect(s.completeCount).toBe(0);
    expect(s.missing).toHaveLength(6);
  });
  it("completes from files and typed values", () => {
    const s = computeStatus(
      { headcount: 120, day_of_contact: { name: "Jo Lee", phone: "904-555-0100" }, load_in: "Dock B, 7am" },
      [
        { id: "1", item_key: "floor_plan", file_name: "plan.pdf" },
        { id: "2", item_key: "run_of_show", file_name: "ros.pdf" },
        { id: "3", item_key: "presentation", file_name: "slides.pptx" },
      ],
    );
    expect(s.allComplete).toBe(true);
    expect(s.items.find((i) => i.def.key === "load_in")?.via).toBe("typed");
  });
  it("rejects bad values", () => {
    expect(parseHeadcount("0")).toBeNull();
    expect(parseHeadcount("1,200")).toBe(1200);
    expect(parseContact({ name: "J", phone: "123" })).toBeNull();
  });
});

describe("check-in cadence", () => {
  it("computes days", () => {
    expect(daysUntil("2026-11-30", "2026-10-31")).toBe(30);
  });
  it("sends on exact days", () => {
    expect(pickCheckinKind(30, new Set())).toBe("d30");
    expect(pickCheckinKind(14, new Set(["d30"]))).toBe("d14");
    expect(pickCheckinKind(3, new Set(["d30", "d14", "d7"]))).toBe("d3");
  });
  it("does not repeat or fire off-day", () => {
    expect(pickCheckinKind(30, new Set(["d30"]))).toBeNull();
    expect(pickCheckinKind(20, new Set(["d30"]))).toBeNull();
    expect(pickCheckinKind(0, new Set())).toBeNull();
    expect(pickCheckinKind(45, new Set())).toBeNull();
  });
  it("catches up a late booking once", () => {
    expect(pickCheckinKind(10, new Set())).toBe("d14");
    expect(pickCheckinKind(9, new Set(["d14"]))).toBeNull();
    expect(pickCheckinKind(2, new Set())).toBe("d3");
  });
});
