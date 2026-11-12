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
    date: "2026-11-12",
    category: "fixed",
    area: "Tools",
    title: "NEW tags are back on the Tools page",
    description:
      "Tools that shipped in the last two weeks show a NEW tag again on the Tools page, instead of only the Tools link in the sidebar.",
    howTo: "The tag clears on your device once you open that tool from the Tools page.",
  },
  {
    date: "2026-11-11",
    category: "fixed",
    area: "Holiday skins",
    title: "Holiday skins: text now sits on solid panels",
    description:
      "The sidebar, top bar and page content on holiday skins now sit on near-solid panels, and menus and pop-ups are fully solid, so text is readable everywhere. A few skin text colors were also brightened for contrast.",
  },
  {
    date: "2026-11-11",
    category: "fixed",
    area: "Holiday skins",
    title: "Holiday skins are easier to read",
    description:
      "Tabs, breadcrumbs and subtitles no longer get lost on bright parts of the holiday photo. The page now sits on a soft panel with a light text shadow, and the photo still shows around the edges.",
  },
  {
    date: "2026-11-11",
    category: "improved",
    area: "Navigation",
    title: "Breadcrumbs at the top of every page",
    description:
      "Every page now shows a breadcrumb trail at the top (for example Home / Teams / Details) so you can see where you are and jump back up a level.",
    howTo:
      "Look at the top of any page. Click Home or any earlier name in the trail to go back to it. The last name is the page you are on.",
  },
  {
    date: "2026-11-11",
    category: "new",
    area: "Speaker AV Guide",
    title: "Shareable Guide to a smooth Speaker Experience",
    description:
      "LRE now has a public Guide to a smooth Speaker Experience that event organizers can send to their speakers and presenters. It covers microphones, slides, clickers, working with the AV team, and a printable checklist. No login is needed to read it.",
    howTo:
      "Open Teams, choose Audiovisual, and tap Speaker AV Guide (shareable). Copy the page address (hub.lreproductions.com/speaker-guide) to send to a client. The page has Download PDF and Print buttons.",
  },
  {
    date: "2026-11-11",
    category: "fixed",
    area: "Agreements and contracts",
    title: "LRE address and phone on legal documents",
    description:
      "The Privacy Policy, SMS terms, staff handbook, contractor and training agreements, contract PDFs, and AV portal emails now show the Tiverton, RI address and the LRE office phone instead of the old Florida details. The home weather card now shows Tiverton.",
  },
  {
    date: "2026-11-10",
    category: "new",
    area: "Teams",
    title: "Fundamental Resource Guide for Audiovisual",
    description:
      "The Audiovisual tab in Teams now has a Fundamental Resource Guide: connectors, IP ratings, microphone patterns, signal flow, wireless, DMX lighting, networked AV, and a glossary.",
    howTo:
      "Open Teams, choose Audiovisual, then tap Fundamental Resource Guide. Use Open full page to read it on its own.",
  },
  {
    date: "2026-11-10",
    category: "fixed",
    area: "Teams",
    title: "Teams now shows Audiovisual only",
    description:
      "The Teams page and the department pickers in Text Messages, Quoting, and Hiring now list only Audiovisual, the one department LRE uses.",
  },
  {
    date: "2026-11-10",
    category: "improved",
    area: "LRE Hub",
    title: "New LRE look",
    description:
      "The Hub now uses the LRE logo and its black, white, and red colors, in light and dark mode. Estimates, agreements, the hub switcher, and the app icon match.",
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
