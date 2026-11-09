import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DRAFT_ISSUES_RIBBON, DraftIssues, draftIssuesHeading } from "./DraftIssues";

const FORM_ID = "22222222-2222-4222-8222-222222222222";
const ISSUES = [
  "Step 2 'New step' has no fields. Add a field or delete the step.",
  "Step 3 'Checking our calendar' checks the date, so an earlier step needs a Date field with the Event date role.",
];

function render(props: Partial<Parameters<typeof DraftIssues>[0]> = {}): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<DraftIssues formId={FORM_ID} name="Check Your Date" issues={ISSUES} {...props} />);
  return host;
}

describe("DraftIssues (?preview=draft for a draft saved with problems)", () => {
  it("lists every problem and links back to the builder instead of showing a broken form", () => {
    const page = render();
    expect(page.querySelector("h1")?.textContent).toBe(draftIssuesHeading(2));
    expect(Array.from(page.querySelectorAll(".iqf-issues li")).map((li) => li.textContent)).toEqual(ISSUES);
    expect(page.querySelector("a.iqf-btn")?.getAttribute("href")).toBe(`/inquiry-forms/${FORM_ID}`);
    expect(page.textContent).toContain(DRAFT_ISSUES_RIBBON);
    expect(page.textContent).toContain("Your changes to Check Your Date are saved.");
    // Nothing to fill in: no form, no inputs.
    expect(page.querySelector("form, input, textarea, select")).toBeNull();
  });

  it("counts in plain words", () => {
    expect(draftIssuesHeading(1)).toBe("This draft has 1 issue to fix before it can be previewed");
    expect(draftIssuesHeading(3)).toBe("This draft has 3 issues to fix before it can be previewed");
  });

  it("drops the full-height page frame inside an embed iframe", () => {
    expect(render().querySelector(".iqf-root")?.classList.contains("iqf-standalone")).toBe(true);
    expect(render({ embed: true }).querySelector(".iqf-root")?.classList.contains("iqf-standalone")).toBe(false);
  });
});
