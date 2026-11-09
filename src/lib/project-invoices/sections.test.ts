import { describe, expect, it } from "vitest";
import { groupBySection, moveItem, moveSection, renameSection } from "./sections";

const L = (description: string, section: string, qty = 1, unit_price = 10) => ({ description, section, qty, unit_price });

describe("invoice sections", () => {
  it("groups in first-seen order with a total per section", () => {
    const g = groupBySection([L("a", "Audio", 2, 50), L("b", "Labor"), L("c", "Audio", 1, 25)]);
    expect(g.map((x) => x.name)).toEqual(["Audio", "Labor"]);
    expect(g[0].total).toBe(125);
    expect(g[0].lines).toHaveLength(2);
  });
  it("blank section becomes Items", () => {
    expect(groupBySection([L("a", "")])[0].name).toBe("Items");
  });
  it("moves a section as a block", () => {
    const out = moveSection([L("a", "A"), L("b", "B"), L("c", "B")], "B", -1);
    expect(out.map((x) => x.description)).toEqual(["b", "c", "a"]);
  });
  it("renames a section", () => {
    const out = renameSection([L("a", "A"), L("b", "B")], "A", "Visual");
    expect(out.map((x) => x.section)).toEqual(["Visual", "B"]);
  });
  it("moveItem is a no-op at the ends", () => {
    expect(moveItem([1, 2], 0, -1)).toEqual([1, 2]);
    expect(moveItem([1, 2], 0, 1)).toEqual([2, 1]);
  });
});
