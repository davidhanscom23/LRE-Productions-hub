import { describe, expect, it } from "vitest";
import { NAV_GROUPS, type NavItem } from "@/components/layout/sidebar";
import { SHORTCUT_DEFS, type ShortcutGate } from "@/lib/home/shortcuts";

function gateFor(item: NavItem): ShortcutGate {
  if (item.adminOnly) return "admin";
  if (item.avAccess) return "av";
  if (item.marketerAccess) return "marketing";
  if (item.calendarAccess) return "calendar";
  if (item.handbookAccess) return "handbook";
  return "";
}

describe("Home shortcut catalog ↔ LRE Hub sidebar", () => {
  const nav = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.href !== "/");
  const byHref = new Map(SHORTCUT_DEFS.map((d) => [d.href, d]));

  it("offers a shortcut for every sidebar module, plus Tools", () => {
    const missing = nav.filter((i) => !byHref.has(i.href)).map((i) => i.href);
    expect(missing).toEqual([]);
    expect(byHref.has("/tools")).toBe(true);
  });

  it("has no duplicate hrefs", () => {
    expect(byHref.size).toBe(SHORTCUT_DEFS.length);
  });

  it("never carries Y? Hub leftovers", () => {
    expect(byHref.has("/music-charts")).toBe(false);
  });

  it("uses the same access gate as the sidebar", () => {
    const wrong: string[] = [];
    for (const item of nav) {
      const def = byHref.get(item.href);
      if (!def) continue;
      // venue-quotes appears twice in nav; the broader (marketer) entry wins.
      const gates = nav.filter((n) => n.href === item.href).map(gateFor);
      if (!gates.includes(def.gate)) wrong.push(`${item.href}: ${def.gate} vs ${gates}`);
    }
    expect(wrong).toEqual([]);
  });
});
