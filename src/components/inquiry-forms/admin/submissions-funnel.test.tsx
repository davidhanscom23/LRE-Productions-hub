import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FunnelTiles } from "./funnel-tiles";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("FunnelTiles (Submissions tab and forms list)", () => {
  it("prints every count and rate as text", () => {
    act(() => {
      root.render(
        <FunnelTiles
          caption="Last 30 days"
          views={200}
          starts={50}
          completes={10}
          perStepReached={[50, 40, 20, 10]}
          stepLabels={["You", "Availability", "Event", "Finish"]}
        />,
      );
    });
    const text = container.textContent ?? "";
    expect(text).toContain("Last 30 days");
    expect(text).toContain("25% of views");
    expect(text).toContain("20% of starts");
    expect(text).toContain("5%");
    expect(text).toContain("1. You");
    expect(text).toContain("2. Availability");
    expect(text).toContain("(80%)");
    expect(text).toContain("(20%)");
  });

  it("draws every step bar on the same track length (no auto-width value column)", () => {
    act(() => {
      root.render(<FunnelTiles views={60} starts={45} completes={20} perStepReached={[45, 45, 30, 20]} />);
    });
    const rows = Array.from(container.querySelectorAll("ol > li"));
    expect(rows.length).toBe(4);
    const templates = new Set(rows.map((li) => li.className.match(/grid-cols-\[[^\]]+\]/)?.[0]));
    expect(templates.size).toBe(1);
    expect([...templates][0]).toBeTruthy();
    // The value column has a fixed width, so "45" and "45 (100%)" leave the same track for the bar.
    expect([...templates][0]).not.toMatch(/_auto\]$/);
  });

  it("shows dashes instead of fake rates when nothing happened yet, and no step bars without data", () => {
    act(() => {
      root.render(<FunnelTiles views={0} starts={0} completes={0} />);
    });
    const text = container.textContent ?? "";
    expect(text).toContain("Conversion-");
    expect(text).not.toContain("How far people got");
    expect(text).not.toContain("NaN");
  });
});
