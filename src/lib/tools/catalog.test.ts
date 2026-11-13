import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "@/components/layout/sidebar";
import {
  TOOL_CATEGORIES,
  TOOL_CATEGORY_IDS,
  toolMatchesQuery,
  type ToolsCategoryId,
} from "@/lib/tools/catalog";

describe("tools catalog ↔ nav placement", () => {
  const allNav = NAV_GROUPS.flatMap((g) => g.items);

  it("requires every non-Home nav item to declare a known toolsCategory", () => {
    const missing: string[] = [];
    const bad: string[] = [];
    for (const item of allNav) {
      if (item.href === "/") {
        expect(item.toolsCategory).toBeUndefined();
        continue;
      }
      if (!item.toolsCategory) {
        missing.push(`${item.label} (${item.href})`);
        continue;
      }
      if (!TOOL_CATEGORY_IDS.has(item.toolsCategory)) {
        bad.push(`${item.href} → ${item.toolsCategory}`);
      }
    }
    expect(missing, `uncategorized: ${missing.join(", ")}`).toEqual([]);
    expect(bad, `unknown category: ${bad.join(", ")}`).toEqual([]);
  });

  it("lists every LRE AV nav item under vident-av (incl. Developer)", () => {
    const avNav = allNav.filter((i) => i.avAccess);
    expect(avNav.length).toBeGreaterThanOrEqual(18);
    for (const item of avNav) {
      expect(item.toolsCategory, `${item.href} missing toolsCategory`).toBe(
        "av" satisfies ToolsCategoryId,
      );
    }
    expect(
      avNav.some((i) => i.href === "/rentals/developer"),
      "AV Developer must be in NAV_GROUPS so Tools can show it",
    ).toBe(true);
  });

  it("keeps TOOL_CATEGORIES ordered section chrome without empty ids", () => {
    expect(TOOL_CATEGORIES.map((c) => c.id)).toEqual([
      "me",
      "events",
      "av",
      "quotes",
      "staffing",
      "people",
      "learn",
      "marketing",
      "comms",
      "admin",
    ]);
  });

  it("filters tools by search tokens against label, description, and path", () => {
    expect(
      toolMatchesQuery(
        "AV Warehouse",
        "/rentals/warehouse",
        "Check gear out and back",
        "ware",
      ),
    ).toBe(true);
    expect(
      toolMatchesQuery(
        "AV Warehouse",
        "/rentals/warehouse",
        "Check gear out and back",
        "gear out",
      ),
    ).toBe(true);
    expect(
      toolMatchesQuery(
        "AV Warehouse",
        "/rentals/warehouse",
        "Check gear out and back",
        "invoice",
      ),
    ).toBe(false);
    expect(toolMatchesQuery("AV Estimates", "/rentals/quotes", "", "")).toBe(true);
  });
});

import { isToolNew } from "./catalog";

describe("isToolNew", () => {
  it("is new for two weeks after shipping, however often someone visits", () => {
    expect(isToolNew("/inquiry-forms", { now: new Date("2026-11-04T08:00:00Z") })).toBe(true);
    expect(isToolNew("/inquiry-forms", { now: new Date("2026-11-12T12:00:00Z") })).toBe(true);
    expect(isToolNew("/inquiry-forms", { now: new Date("2026-11-19T00:00:00Z") })).toBe(false);
  });
  it("ignores unknown tools and dates in the future", () => {
    expect(isToolNew("/unknown", { now: new Date("2026-11-06T12:00:00Z") })).toBe(false);
    expect(isToolNew("/inquiry-forms", { now: new Date("2026-11-01T00:00:00Z") })).toBe(false);
  });
});
