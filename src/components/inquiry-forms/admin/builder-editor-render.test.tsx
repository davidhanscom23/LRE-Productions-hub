// @vitest-environment jsdom
/**
 * Smoke test: mounts the real FormEditor (server actions mocked) and drives it like a person:
 * render, add a step, see "Unsaved changes", undo, save with the keyboard, the published
 * address lock, and the save gate that points at problems instead of calling the server.
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeFormSettings } from "@/lib/inquiry-forms/defaults";
import type { BrandProfile, FormDefinition } from "@/lib/inquiry-forms/types";

const actions = vi.hoisted(() => ({
  getFormForEdit: vi.fn(),
  saveDraft: vi.fn(),
  publishForm: vi.fn(),
  setFormStatus: vi.fn(),
  listSubmissions: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/(app)/inquiry-forms/actions", () => actions);
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

import { FormEditor, type EditorFormData } from "./form-editor";

const BRAND: BrandProfile = {
  key: "vident",
  name: "LRE Productions",
  logoUrl: null,
  logoOnDark: false,
  siteUrl: "https://example.com",
  privacyUrl: null,
  phone: "904-571-9064",
  email: "events@example.com",
  accentColor: "#ae4213",
  legalLine: null,
};

function definition(): FormDefinition {
  return {
    version: 1,
    steps: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        kind: "fields",
        title: "Let's check your date",
        fields: [
          { id: "f1", key: "name", type: "text", role: "name", label: "Full name", required: true, width: "half" },
          { id: "f2", key: "phone", type: "phone", role: "phone", label: "Mobile phone", required: true, width: "half" },
          { id: "f3", key: "email", type: "email", role: "email", label: "Email", required: true, width: "full" },
        ],
      },
    ],
  };
}

function form(patch: Partial<EditorFormData> = {}): EditorFormData {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "check-your-date",
    name: "Check Your Date",
    brand: "vident",
    status: "draft",
    definition: definition(),
    settings: mergeFormSettings({ brand: "vident", accentColor: "#ae4213" }),
    updatedAt: "2026-11-04T20:00:00.000Z",
    publishedVersion: null,
    publishedAt: null,
    hasSubmissions: false,
    publishedKeys: [],
    ...patch,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(actions).forEach((fn) => fn.mockReset());
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function mount(f: EditorFormData, initialTab: "build" | "settings" = "build") {
  await act(async () => {
    root.render(
      <FormEditor form={f} brands={[BRAND]} publicOrigin="https://hub.example.com" business={null} initialTab={initialTab} />,
    );
  });
}

function button(text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim().includes(text));
  if (!found) throw new Error(`No button "${text}"`);
  return found;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
}

describe("FormEditor", () => {
  it("renders the builder with the steps, the fields and a clean save state", async () => {
    await mount(form());
    const text = container.textContent ?? "";
    expect(text).toContain("Check Your Date");
    expect(text).toContain("Let's check your date");
    expect(text).toContain("Full name");
    expect(text).toContain("All changes saved");
    expect(text).toContain("Not published yet");
  });

  it("adding a step marks the form unsaved, and undo brings it back", async () => {
    await mount(form());
    await click(button("Questions step"));
    expect(container.textContent).toContain("New step");
    expect(container.textContent).toContain("Unsaved changes");
    await click(container.querySelector<HTMLButtonElement>('button[aria-label^="Undo"]') as HTMLButtonElement);
    expect(container.textContent).not.toContain("New step");
    expect(container.textContent).toContain("All changes saved");
  });

  it("saves a draft with problems instead of refusing it, and says Saved with N issues", async () => {
    const issue = "Step 2 'New step' has no fields. Add a field or delete the step.";
    actions.saveDraft.mockResolvedValueOnce({
      ok: true,
      updatedAt: "2026-11-04T20:05:00.000Z",
      definition: definition(),
      issues: [issue],
    });
    await mount(form());
    await click(button("Questions step")); // an empty step: publishing refuses it, saving does not
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    });
    expect(actions.saveDraft).toHaveBeenCalledTimes(1);
    const sent = actions.saveDraft.mock.calls[0][0] as { definition: FormDefinition; expectedUpdatedAt: string };
    expect(sent.definition.steps).toHaveLength(2);
    expect(sent.expectedUpdatedAt).toBe("2026-11-04T20:00:00.000Z");
    const status = container.querySelector('[role="status"][aria-live="polite"]');
    expect(status?.textContent).toBe("Saved with 1 issue");
    // The issues list stays on screen, pointing at the problem.
    expect(container.textContent).toContain("Your draft is saved, so nothing is lost.");
    expect(container.textContent).toContain(issue);
    expect(container.textContent).not.toContain("Nothing was saved yet");
    expect(container.textContent).not.toContain("Unsaved changes");
  });

  it("still refuses to publish a draft with problems, without calling the server", async () => {
    await mount(form());
    await click(button("Questions step"));
    await click(button("Publish"));
    expect(actions.saveDraft).not.toHaveBeenCalled();
    expect(actions.publishForm).not.toHaveBeenCalled();
    expect(container.textContent).toContain("before publishing");
    expect(container.textContent).toMatch(/has no fields|has no questions/);
  });

  it("still refuses to save without a name (the one thing the row cannot hold), pointing at it", async () => {
    await mount(form(), "settings");
    const nameInput = Array.from(container.querySelectorAll("input")).find((i) => i.value === "Check Your Date");
    expect(nameInput).toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(nameInput, "");
      nameInput?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    });
    expect(actions.saveDraft).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Fix this before saving");
    expect(container.textContent).toContain("Nothing was saved yet");
  });

  it("says Saved with N issues for a draft that was saved with issues earlier", async () => {
    await mount(form({ draftIssues: ["Step 1 'Let's check your date': field #2 needs a label.", "Accent color: use a hex color like #ae4213."] }));
    const status = container.querySelector('[role="status"][aria-live="polite"]');
    expect(status?.textContent).toBe("Saved with 2 issues");
  });

  it("saves with the concurrency token and shows a conflict banner when someone else saved", async () => {
    actions.saveDraft.mockResolvedValueOnce({ ok: false, error: "conflict", conflict: true });
    await mount(form());
    // The first step starts selected, so its panel (with the title box) is already showing.
    const title = container.querySelector<HTMLInputElement>('input[id^="step-title-"]') as HTMLInputElement;
    expect(title).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(title, "Your details");
      title.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.textContent).toContain("Unsaved changes");
    await click(button("Save draft"));
    expect(actions.saveDraft).toHaveBeenCalledTimes(1);
    expect(actions.saveDraft.mock.calls[0][0]).toMatchObject({
      id: "22222222-2222-4222-8222-222222222222",
      slug: "check-your-date",
      expectedUpdatedAt: "2026-11-04T20:00:00.000Z",
    });
    expect(container.textContent).toContain("Someone else saved this form after you opened it");
  });

  it("adds every field type from the menu and renders each one's panel", async () => {
    await mount(form());
    const menuLabels = [
      "Company",
      "Event date",
      "Time",
      "Venue or location",
      "Guest count",
      "Event type",
      "Single choice",
      "Multiple choice",
      "Dropdown",
      "Short text",
      "Long text",
      "Number",
      "Budget",
      "Contact preference",
      "Text block",
    ];
    for (const label of menuLabels) {
      await click(button("Add field"));
      const item = Array.from(container.querySelectorAll<HTMLButtonElement>("[role=menuitem]")).find(
        (b) => b.querySelector("span span")?.textContent === label,
      );
      if (!item) throw new Error(`No menu item ${label}`);
      await click(item);
      // The new field is selected: its panel shows its label box.
      expect(container.querySelector('input[id^="field-label-"]')).not.toBeNull();
    }
    // 3 starting fields + 15 added, all on step 1.
    expect(container.querySelectorAll("[data-field-card]").length).toBe(18);
    // Each card's panel renders without crashing.
    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-field-card]"));
    for (const card of cards) {
      const select = card.querySelector<HTMLButtonElement>("button[aria-pressed]");
      await click(select as HTMLButtonElement);
      expect(container.querySelector('[role="region"]')?.textContent).toMatch(/Question|Text block/);
    }
    expect(container.textContent).toContain("Unsaved changes");
  }, 30_000);

  it("locks the address of a published form", async () => {
    await mount(form({ status: "live", publishedVersion: 3, publishedAt: "2026-11-01T15:00:00.000Z" }), "settings");
    const text = container.textContent ?? "";
    expect(text).toContain("Live version 3");
    expect(text).toContain("its address may already be on your website");
    const slugInput = Array.from(container.querySelectorAll("input")).find((i) => i.value === "check-your-date");
    expect(slugInput?.disabled).toBe(true);
  });

  it("locks keys that submissions already use", async () => {
    await mount(form({ status: "live", publishedVersion: 1, hasSubmissions: true, publishedKeys: ["name", "phone", "email"] }));
    // Select the Email field card, then read its key box.
    const emailTitle = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.startsWith("Email"));
    await click(emailTitle as HTMLButtonElement);
    const keyInput = Array.from(container.querySelectorAll("input")).find((i) => i.value === "email" && i.disabled);
    expect(keyInput).toBeTruthy();
    expect(container.textContent).toContain("Locked because submissions already store answers under this key");
  });
});
