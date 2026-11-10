/**
 * Hub changelog ("What's New").
 *
 * REQUIRED for every user-facing change (see AGENTS.md): whoever ships a
 * change adds an entry here IN THE SAME COMMIT. Newest entries first.
 * Write for staff, not developers: what changed, and how to use it if that
 * isn't obvious. Keep each entry to a sentence or two.
 */

export type ChangelogCategory = "new" | "improved" | "fixed" | "removed";

export type ChangelogEntry = {
  /** YYYY-MM-DD (deploy date) */
  date: string;
  category: ChangelogCategory;
  /** Module or area, e.g. "Forum", "Email", "Navigation" */
  area: string;
  title: string;
  /** Plain-English description of what changed. */
  description: string;
  /** Optional: how to use it, when not obvious. */
  howTo?: string;
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-11-10",
    category: "improved",
    area: "LRE Hub",
    title: "New LRE look",
    description:
      "The Hub now uses the LRE Productions logo and its black, white, and red colors, in light and dark mode. Estimates, agreements, and the app icon match.",
  },
  {
    date: "2026-11-10",
    category: "new",
    area: "LRE Hub",
    title: "Welcome to the LRE Hub",
    description:
      "The LRE Productions staff hub is open. LRE AV, the gear checklist, the calendar, and the staff tools are ready to use. Every piece of equipment in the AV Catalog now shows who owns it: Vident, LukesENT, or LRE Pro.",
    howTo: "Open Catalog in LRE AV to see the Owned by tag on each item.",
  },
];

/**
 * Changes whenever an entry is added — used by the sidebar NEW badge.
 * Compared against localStorage on the client.
 */
export const CHANGELOG_STAMP = `${CHANGELOG.length}:${CHANGELOG[0]?.date ?? ""}`;

export const CHANGELOG_SEEN_KEY = "lre-hub.changelog.seen";
