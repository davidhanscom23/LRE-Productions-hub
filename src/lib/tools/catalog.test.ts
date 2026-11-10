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
    const avNav = allNav.filter((i) => i.videntAvAccess);
    expect(avNav.length).toBeGreaterThanOrEqual(18);
    for (const item of avNav) {
      expect(item.toolsCategory, `${item.href} missing toolsCategory`).toBe(
        "vident-av" satisfies ToolsCategoryId,
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
      "vident-av",
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
  const now = new Date("2026-11-06T12:00:00Z");
  it("is new only when it shipped after the previous visit", () => {
    expect(
      isToolNew("/inquiry-forms", {
        now,
        tracked: true,
        previousVisitAt: "2026-11-02T10:00:00Z",
      }),
    ).toBe(true);
    expect(
      isToolNew("/inquiry-forms", {
        now,
        tracked: true,
        previousVisitAt: "2026-11-05T10:00:00Z",
      }),
    ).toBe(false);
  });
  it("shows nothing on a first visit and ignores unknown or old tools", () => {
    expect(
      isToolNew("/inquiry-forms", {
        now,
        tracked: true,
        previousVisitAt: null,
      }),
    ).toBe(false);
    expect(
      isToolNew("/unknown", {
        now,
        tracked: true,
        previousVisitAt: "2026-01-01T00:00:00Z",
      }),
    ).toBe(false);
    expect(
      isToolNew("/av-show", {
        now: new Date("2026-12-20T00:00:00Z"),
        tracked: true,
        previousVisitAt: "2026-01-01T00:00:00Z",
      }),
    ).toBe(false);
  });
  it("falls back to a two-week window when tracking is unavailable", () => {
    expect(
      isToolNew("/inquiry-forms", {
        now,
        tracked: false,
        previousVisitAt: null,
      }),
    ).toBe(true);
    expect(
      isToolNew("/av-show", {
        now: new Date("2026-11-20T00:00:00Z"),
        tracked: false,
        previousVisitAt: null,
      }),
    ).toBe(false);
  });
});
