import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SharePanel from "./share-panel";
import { buildEmbedSnippet } from "./share-snippet";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ORIGIN = "https://hub.example.com/";
const SNIPPET = buildEmbedSnippet(ORIGIN, "check-your-date");

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
  vi.restoreAllMocks();
  delete (navigator as { clipboard?: unknown }).clipboard;
  delete (navigator as { permissions?: unknown }).permissions;
});

function render(status: string) {
  act(() => {
    root.render(<SharePanel slug="check-your-date" publicOrigin={ORIGIN} status={status} />);
  });
}

function button(text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes(text));
  if (!found) throw new Error(`no button "${text}"`);
  return found;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
    // let the clipboard promise chain (write, permission query, read back) settle
    await new Promise((r) => setTimeout(r, 0));
  });
}

function mockClipboard(opts: { permission: "granted" | "prompt" | "throws"; failWrite?: boolean }) {
  let clip = "";
  const clipboard = {
    writeText: vi.fn(async (t: string) => {
      if (opts.failWrite) throw new Error("denied");
      clip = t;
    }),
    readText: vi.fn(async () => clip),
  };
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: {
      query: vi.fn(async () => {
        if (opts.permission === "throws") throw new TypeError("unknown permission");
        return { state: opts.permission };
      }),
    },
  });
  return { clipboard, read: () => clip };
}

describe("SharePanel", () => {
  it("shows the direct link and the one self-sizing snippet", () => {
    render("live");
    const inputs = Array.from(container.querySelectorAll("input"));
    expect(inputs.map((i) => i.value)).toContain("https://hub.example.com/inquire/check-your-date");
    const code = container.querySelector("textarea");
    expect(code?.value).toBe(SNIPPET);
    expect(container.textContent).not.toContain("not published");
    expect(container.textContent).not.toContain("paused");
  });

  it("warns when the form is not live", () => {
    render("draft");
    expect(container.textContent).toContain("This form is not published yet");
    render("paused");
    expect(container.textContent).toContain("This form is paused");
  });

  it("copies the snippet and proves it by reading the clipboard back when allowed", async () => {
    const { clipboard, read } = mockClipboard({ permission: "granted" });
    render("live");
    await click(button("Copy embed code"));
    expect(clipboard.writeText).toHaveBeenCalledWith(SNIPPET);
    expect(clipboard.readText).toHaveBeenCalled();
    expect(read()).toBe(SNIPPET);
    expect(container.textContent).toContain("Embed code copied and checked");
  });

  it("never prompts for clipboard read permission just to double-check", async () => {
    const { clipboard } = mockClipboard({ permission: "prompt" });
    render("live");
    await click(button("Copy embed code"));
    expect(clipboard.writeText).toHaveBeenCalledWith(SNIPPET);
    expect(clipboard.readText).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Embed code copied.");
  });

  it("says so (and selects the code) when copying fails", async () => {
    mockClipboard({ permission: "throws", failWrite: true });
    const exec = vi.fn(() => false);
    Object.defineProperty(document, "execCommand", { configurable: true, value: exec });
    render("live");
    await click(button("Copy embed code"));
    expect(exec).toHaveBeenCalledWith("copy");
    expect(container.textContent).toContain("Copy did not work");
  });
});
