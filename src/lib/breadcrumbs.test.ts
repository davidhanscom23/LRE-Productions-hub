import { describe, expect, it } from "vitest";
import { buildCrumbs } from "./breadcrumbs";

const labels = { "/videos": "Video Archives", "/financial": "Financial" };

describe("buildCrumbs", () => {
  it("has no trail on the home page", () => {
    expect(buildCrumbs("/", labels)).toEqual([]);
  });

  it("shows Home then the page, with the page not linked", () => {
    expect(buildCrumbs("/videos", labels)).toEqual([
      { label: "Home", href: "/" },
      { label: "Video Archives", href: null },
    ]);
  });

  it("links parents and calls an id Details", () => {
    expect(buildCrumbs("/videos/bbd987e5-d188-4f50-bfea-8e7cc9d4d565", labels)).toEqual([
      { label: "Home", href: "/" },
      { label: "Video Archives", href: "/videos" },
      { label: "Details", href: null },
    ]);
  });

  it("makes unknown segments readable", () => {
    expect(buildCrumbs("/financial/profit-loss", labels).map((c) => c.label)).toEqual([
      "Home",
      "Financial",
      "Profit loss",
    ]);
  });
});
