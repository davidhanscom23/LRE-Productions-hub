import { describe, expect, it } from "vitest";
import { pipelineSourceBadge } from "./source-badge";

describe("pipelineSourceBadge", () => {
  it("labels Hub-made and website inquiry projects", () => {
    expect(pipelineSourceBadge("hub")?.label).toBe("Hub");
    expect(pipelineSourceBadge("web_form")).toMatchObject({ label: "Website", title: "From a website inquiry form" });
  });

  it("shows nothing for other sources", () => {
    for (const source of ["inquiry.created", "project.upsert", "project.booked", "", null, undefined]) {
      expect(pipelineSourceBadge(source)).toBeNull();
    }
  });
});

describe("badge colors", () => {
  it("draws Website at 4.5:1 or better in both themes and leaves the Hub badge as it was", () => {
    // brand text on brand/15 measured 3.59:1 in the light theme, so Website gets its own colors.
    expect(pipelineSourceBadge("web_form")?.colors).toBe(
      "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
    );
    expect(pipelineSourceBadge("hub")?.colors).toBe("bg-[var(--brand)]/15 text-[var(--brand)]");
  });
});
