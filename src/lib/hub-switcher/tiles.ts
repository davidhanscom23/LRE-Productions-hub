export type HubLinkRow = {
  slug: string;
  name: string;
  url: string;
  logo_url: string;
  sort_order: number;
  enabled: boolean;
};

export type HubTile = {
  slug: string;
  name: string;
  /** Empty for the current hub and for hubs that are not built yet. */
  url: string;
  logoUrl: string;
  /** Artwork for dark mode (white versions where the logo is dark). */
  logoDarkUrl: string;
  current: boolean;
  comingSoon: boolean;
};

export const CURRENT_HUB: HubTile = {
  slug: "lre",
  name: "LRE Hub",
  url: "",
  logoUrl: "/hub-logos/lre.png",
  logoDarkUrl: "/hub-logos/lre-dark.png",
  current: true,
  comingSoon: false,
};

/** Light-mode logo: public/hub-logos/<slug>.png unless a row sets its own logo_url. Dark mode uses <slug>-dark.png. */
export function logoFor(row: Pick<HubLinkRow, "slug" | "logo_url">): string {
  return row.logo_url.trim() || `/hub-logos/${row.slug}.png`;
}

/** Only https links (or empty = coming soon) are allowed. Returns null when invalid. */
export function cleanHubUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return "";
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || !u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * Tiles one person sees. Admins see every enabled hub; others only the hubs an admin
 * ticked for them. The current hub is always first. Nothing at all when there is no
 * other hub to show (the button then stays a plain Home shortcut).
 */
export function tilesForPerson(opts: {
  isOwner: boolean;
  hubs: HubLinkRow[];
  allowedSlugs: ReadonlySet<string>;
}): HubTile[] {
  const others = opts.hubs
    .filter((h) => h.enabled && (opts.isOwner || opts.allowedSlugs.has(h.slug)))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map<HubTile>((h) => ({
      slug: h.slug,
      name: h.name,
      url: h.url,
      logoUrl: logoFor(h),
      logoDarkUrl: h.logo_url.trim() || `/hub-logos/${h.slug}-dark.png`,
      current: false,
      comingSoon: !h.url,
    }));
  return others.length ? [CURRENT_HUB, ...others] : [];
}
