import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { EMBED_MESSAGE_SOURCE } from "@/lib/inquiry-forms/types";
import { slugFromInquirePath, UnavailableNotice } from "./UnavailableNotice";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const realParent = window.parent;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Object.defineProperty(window, "parent", { value: realParent, configurable: true });
});

describe("paused or unknown form inside an embed", () => {
  it("reads the slug from /inquire/<slug>", () => {
    expect(slugFromInquirePath("/inquire/check-your-date")).toBe("check-your-date");
    expect(slugFromInquirePath("/inquire/check-your-date/")).toBe("check-your-date");
    expect(slugFromInquirePath("/somewhere/else")).toBe("");
  });

  it("tells the host page it is ready and how tall it is, so the frame never stays at 560 px", async () => {
    window.history.replaceState(null, "", "/inquire/check-your-date?embed=1");
    const postMessage = vi.fn();
    Object.defineProperty(window, "parent", { value: { postMessage }, configurable: true });
    // jsdom has no layout: give the message a height to report.
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("iqf-root") ? 180 : 0;
      },
    });
    onTestFinished(() => {
      if (original) Object.defineProperty(HTMLElement.prototype, "scrollHeight", original);
    });
    await act(async () => {
      root.render(<UnavailableNotice />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    const types = postMessage.mock.calls.map(([m]) => (m as { type: string }).type);
    expect(types).toContain("ready");
    expect(types).toContain("height");
    expect(postMessage.mock.calls.find(([m]) => (m as { type: string }).type === "height")?.[0]).toMatchObject({ height: 180 });
    const ready = postMessage.mock.calls.find(([m]) => (m as { type: string }).type === "ready")?.[0];
    expect(ready).toMatchObject({ source: EMBED_MESSAGE_SOURCE, v: 1, slug: "check-your-date" });
    // Embed styling: no card chrome inside the host page.
    expect(container.querySelector(".iqf-root")?.classList.contains("iqf-embed")).toBe(true);
    expect(container.textContent).toContain("This form is not available right now");
  });

  it("stays a plain page when it is not framed", async () => {
    await act(async () => {
      root.render(<UnavailableNotice />);
    });
    expect(container.querySelector(".iqf-root")?.classList.contains("iqf-embed")).toBe(false);
  });
});
