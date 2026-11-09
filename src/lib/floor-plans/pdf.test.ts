import { describe, expect, it } from "vitest";
import { buildFloorPlanPdf } from "./pdf";
import { DEFAULT_PLAN_DATA, newElement } from "./types";

describe("buildFloorPlanPdf", () => {
  it("renders a populated plan to a one-page PDF", async () => {
    const bytes = await buildFloorPlanPdf({
      title: "Smith Wedding",
      subtitle: "Ballroom",
      data: {
        ...DEFAULT_PLAN_DATA,
        elements: [
          { ...newElement("round_table_60", 20, 20, "a"), label: "T1" },
          newElement("stage", 40, 8, "b"),
          { ...newElement("text", 40, 30, "c"), label: "Dance floor" },
          { ...newElement("rect_table_8", 30, 30, "d"), rot: 30 },
        ],
      },
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("renders an empty plan", async () => {
    const bytes = await buildFloorPlanPdf({ title: "Empty", subtitle: "", data: DEFAULT_PLAN_DATA });
    expect(bytes.length).toBeGreaterThan(500);
  });
});
