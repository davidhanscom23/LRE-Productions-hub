import { describe, expect, it } from "vitest";
import { moveId, moveLineInSection } from "./line-order";

describe("line order", () => {
  it("moves ids and stops at the ends", () => {
    expect(moveId(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b"], "a", -1)).toEqual(["a", "b"]);
  });
  it("package contents travel with their package", () => {
    const lines = [
      { id: "p1", parent_line_id: null },
      { id: "c1", parent_line_id: "p1" },
      { id: "x", parent_line_id: null },
    ];
    expect(moveLineInSection(lines, "x", -1)).toEqual(["x", "p1", "c1"]);
    expect(moveLineInSection(lines, "p1", 1)).toEqual(["x", "p1", "c1"]);
  });
});
