import { describe, expect, it } from "vitest";
import { addFieldMenuOffset } from "./builder-add-field-position";

describe("Add field menu position", () => {
  it("pulls the menu left so it stays on screen at 390 px (the button sits ~160 px in)", () => {
    // Menu = min(34rem, 100vw - 2.5rem) = 350 px at 390 px; it may reach 20 px from the right edge.
    expect(addFieldMenuOffset({ buttonLeft: 160, viewportWidth: 390 })).toBe(-140);
  });

  it("stays anchored to the button when it fits", () => {
    expect(addFieldMenuOffset({ buttonLeft: 300, viewportWidth: 1280 })).toBe(0);
  });

  it("never pushes the menu past the left margin", () => {
    expect(addFieldMenuOffset({ buttonLeft: 10, viewportWidth: 320 })).toBe(0);
  });
});
