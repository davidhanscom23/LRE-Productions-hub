import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testDate = vi.fn();
const testAddress = vi.fn();
vi.mock("@/app/(app)/inquiry-forms/actions", () => ({
  testDate: (...args: unknown[]) => testDate(...args),
  testAddress: (...args: unknown[]) => testAddress(...args),
}));

import { SettingsTestTools } from "./settings-test-tools";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const outerSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  testDate.mockReset();
  testAddress.mockReset();
  outerSubmit.mockClear();
  testDate.mockResolvedValue({
    ok: true,
    verdict: { result: "available", checkedFor: "2027-02-06", message: "Good news.", checkedAt: "2026-11-05T12:00:00.000Z" },
  });
  testAddress.mockResolvedValue({
    ok: true,
    verdict: { result: "pass", message: "In our area.", miles: 28.4, confidence: "high", query: "x", checkedAt: "2026-11-05T12:00:00.000Z" },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** The business settings page renders the tools inside its own settings <form> (Save settings). */
function renderInsideSettingsForm() {
  act(() => {
    root.render(
      <form onSubmit={outerSubmit} noValidate>
        <SettingsTestTools dirty={false} />
        <button type="submit">Save settings</button>
      </form>,
    );
  });
}

function setValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function checkButtons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll("button")).filter((b) => b.textContent?.trim() === "Check");
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("SettingsTestTools inside the business settings form", () => {
  it("renders no form inside a form (invalid HTML: the server markup breaks hydration)", () => {
    renderInsideSettingsForm();
    expect(container.querySelectorAll("form form").length).toBe(0);
  });

  it("Check runs the date test without submitting (saving) the settings form", async () => {
    renderInsideSettingsForm();
    const input = container.querySelector<HTMLInputElement>('input[type="date"]');
    expect(input).not.toBeNull();
    act(() => setValue(input!, "2027-02-06"));
    await act(async () => {
      checkButtons()[0].click();
    });
    await flush();
    expect(testDate).toHaveBeenCalledWith("2027-02-06");
    expect(outerSubmit).not.toHaveBeenCalled();
  });

  it("Check runs the address test without submitting the settings form", async () => {
    renderInsideSettingsForm();
    const input = container.querySelector<HTMLInputElement>('input[type="text"]');
    act(() => setValue(input!, "Casa Monica, St. Augustine"));
    await act(async () => {
      checkButtons()[1].click();
    });
    await flush();
    expect(testAddress).toHaveBeenCalledWith("Casa Monica, St. Augustine");
    expect(outerSubmit).not.toHaveBeenCalled();
  });

  it("Enter in a test field runs that test and blocks the settings form's implicit submit", async () => {
    renderInsideSettingsForm();
    const input = container.querySelector<HTMLInputElement>('input[type="text"]');
    act(() => setValue(input!, "Gainesville, FL"));
    const ev = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    await act(async () => {
      input!.dispatchEvent(ev);
    });
    await flush();
    expect(testAddress).toHaveBeenCalledWith("Gainesville, FL");
    expect(ev.defaultPrevented).toBe(true);
    expect(outerSubmit).not.toHaveBeenCalled();
  });
});
