// @vitest-environment jsdom
/**
 * Text inside the fixed pastel boxes (Callout, Setup check) must take the box's own text color, never
 * the hub tokens: the glass skins (Wu Wednesday, Chamber Day, holidays) set --foreground to cream and
 * --brand to gold without the .dark class, so token text on a pastel box measured 1.04:1 to 1.96:1.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { btn, Callout } from "./builder-ui";
import { BuilderIssues } from "./builder-issues";
import type { EditorIssue } from "./builder-checks";

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const HUB_TOKEN_TEXT = /text-\[var\(--(foreground|brand|muted)\)\]/;

describe("text inside tinted boxes", () => {
  it("Callout actions use a ghost button that inherits the box color", async () => {
    await act(async () => {
      root.render(
        <Callout tone="success" title="Published version 3" actions={<button className={btn.ghostTint}>Dismiss</button>}>
          Visitors see this version now.
        </Callout>,
      );
    });
    const button = container.querySelector("button");
    expect(button?.className).toContain("text-current");
    expect(button?.className).not.toMatch(HUB_TOKEN_TEXT);
  });

  it("Setup check rows and their Go there link inherit the box color", async () => {
    const issues: EditorIssue[] = [
      { id: "i1", severity: "error", message: "Step 2 needs a Date field.", target: { kind: "step", stepId: "s2" } } as unknown as EditorIssue,
    ];
    await act(async () => {
      root.render(<BuilderIssues issues={issues} onGo={() => undefined} />);
    });
    const html = container.innerHTML;
    expect(container.textContent).toContain("Step 2 needs a Date field.");
    expect(container.textContent).toContain("Go there");
    expect(html).not.toMatch(HUB_TOKEN_TEXT);
  });
});

describe("sticky save bars", () => {
  it("paint an opaque surface (the glass skins' --surface is 86-88% opaque, so text under a bar read through it)", async () => {
    const { OPAQUE_SURFACE_STYLE } = await import("./builder-ui");
    // An inline style beats the bar's bg-[var(--surface)] class; a browser without relative colors
    // drops the invalid inline value and keeps the class.
    expect(OPAQUE_SURFACE_STYLE).toEqual({ backgroundColor: "rgb(from var(--surface) r g b / 1)" });
    for (const file of ["business-settings-form.tsx", "form-editor.tsx"]) {
      const src = (await import("node:fs")).readFileSync(`${__dirname}/${file}`, "utf8");
      expect(src, file).toContain("style={OPAQUE_SURFACE_STYLE}");
    }
  });
});
