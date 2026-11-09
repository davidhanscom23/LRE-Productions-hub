import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.join(__dirname, "inquiry-form.css"), "utf8");

function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} rule`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

describe("inquiry form CSS", () => {
  it("keeps the phone button order equal to the focus order (WCAG 1.3.2 / 2.4.3)", () => {
    // Back comes first in the DOM, so it must be drawn first too (no reversed flex direction).
    expect(rule(".iqf-nav")).not.toMatch(/reverse/);
  });

  it("draws the celebration in the flow, never absolutely over the verdicts", () => {
    expect(rule(".iqf-popup")).not.toMatch(/position:\s*absolute/);
  });
});
