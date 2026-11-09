import { describe, expect, it } from "vitest";
import { cleanHubUrl, tilesForPerson, type HubLinkRow } from "./tiles";

const hubs: HubLinkRow[] = [
  { slug: "y", name: "Y?", url: "https://hub.example.com", logo_url: "", sort_order: 10, enabled: true },
  { slug: "hfg", name: "HFG", url: "", logo_url: "", sort_order: 20, enabled: true },
  { slug: "off", name: "Off", url: "https://x.example.com", logo_url: "", sort_order: 5, enabled: false },
];

describe("tilesForPerson", () => {
  it("shows admins every enabled hub, current first", () => {
    const t = tilesForPerson({ isOwner: true, hubs, allowedSlugs: new Set() });
    expect(t.map((x) => x.slug)).toEqual(["vident", "y", "hfg"]);
    expect(t[2].comingSoon).toBe(true);
    expect(t[1].logoUrl).toBe("/hub-logos/y.png");
    expect(t[1].logoDarkUrl).toBe("/hub-logos/y-dark.png");
  });
  it("shows staff only ticked hubs", () => {
    const t = tilesForPerson({ isOwner: false, hubs, allowedSlugs: new Set(["y", "off"]) });
    expect(t.map((x) => x.slug)).toEqual(["vident", "y"]);
  });
  it("shows nothing when no other hub applies", () => {
    expect(tilesForPerson({ isOwner: false, hubs, allowedSlugs: new Set() })).toEqual([]);
  });
});

describe("cleanHubUrl", () => {
  it("accepts https and empty, rejects the rest", () => {
    expect(cleanHubUrl("")).toBe("");
    expect(cleanHubUrl(" https://hub.example.com/ ")).toBe("https://hub.example.com");
    expect(cleanHubUrl("http://hub.example.com")).toBeNull();
    expect(cleanHubUrl("javascript:alert(1)")).toBeNull();
    expect(cleanHubUrl("hub")).toBeNull();
  });
});
