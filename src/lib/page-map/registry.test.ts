import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAGE_REGISTRY } from "./registry";

function findPages(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      const seg = /^\(.*\)$/.test(name) ? "" : `/${name}`;
      out.push(...findPages(full, base + seg));
    } else if (name === "page.tsx") {
      out.push(base || "/");
    }
  }
  return out;
}

describe("page map registry", () => {
  const pages = findPages(join(process.cwd(), "src/app")).sort();
  const registered = PAGE_REGISTRY.map((p) => p.path).sort();

  it("lists every page in src/app", () => {
    expect(pages.filter((p) => !registered.includes(p))).toEqual([]);
  });

  it("has no entries for pages that do not exist", () => {
    expect(registered.filter((p) => !pages.includes(p))).toEqual([]);
  });

  it("has no duplicate paths", () => {
    expect(new Set(registered).size).toBe(registered.length);
  });
});
