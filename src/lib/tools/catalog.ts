/**
 * Tools launcher categories (section chrome only).
 *
 * Which tools appear under each section comes from `NavItem.toolsCategory` on
 * `NAV_GROUPS` in the sidebar — that is the single source of truth for both
 * access rules and Tools placement. Adding a Hub module means adding a nav
 * item with the right `toolsCategory`; it shows on Tools automatically.
 *
 * Descriptions still come from home shortcuts + EXTRA_DESCRIPTIONS below.
 */

export type ToolsCategoryId =
  | "me"
  | "events"
  | "vident-av"
  | "quotes"
  | "staffing"
  | "people"
  | "learn"
  | "marketing"
  | "comms"
  | "admin";

export type ToolCategory = {
  id: ToolsCategoryId;
  title: string;
  /** Hue (0-360) used for the category's icon tiles and heading. */
  hue: number;
};

/** Ordered Tools sections (titles + colors). */
export const TOOL_CATEGORIES: ToolCategory[] = [
  { id: "me", title: "FOR ME", hue: 38 },
  { id: "events", title: "EVENTS & PRODUCTION", hue: 32 },
  { id: "vident-av", title: "LRE AV", hue: 24 },
  { id: "quotes", title: "QUOTES & PROPOSALS", hue: 172 },
  { id: "staffing", title: "STAFFING & PAY", hue: 140 },
  { id: "people", title: "PEOPLE & CULTURE", hue: 262 },
  { id: "learn", title: "LEARN & RESOURCES", hue: 215 },
  { id: "marketing", title: "MARKETING", hue: 335 },
  { id: "comms", title: "COMMUNICATION", hue: 22 },
  { id: "admin", title: "ADMIN", hue: 215 },
];

export const TOOL_CATEGORY_IDS = new Set(
  TOOL_CATEGORIES.map((c) => c.id),
);

/** Case-insensitive token match against label, description, and path. */
export function toolMatchesQuery(
  label: string,
  href: string,
  description: string,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${label} ${description} ${href}`.toLowerCase();
  return q.split(/\s+/).every((token) => hay.includes(token));
}

/** Descriptions for links the Home shortcut catalog does not already describe. */
export const EXTRA_DESCRIPTIONS: Record<string, string> = {
  "/scheduling":
    "Create booking links so clients can pick an open time for a call, with confirmations and calendar invites.",
  "/services":
    "Look up the saved services and prices (rentals, planning fees, transportation, golf events) used on proposals and invoices.",
  "/floor-plans":
    "Draw room layouts with tables, stage and AV gear, upload a venue blueprint, and share the plan with a client.",
  "/av-show": "Run full-screen, lower-third and stage-timer graphics for a live show.",
  "/my-calendar": "Your personal calendar feed.",
  "/venue-quotes": "Public instant-quote pages per venue.",
  "/inquiry-forms":
    "Multi-step website inquiry forms that check the date and add each inquiry to the HoneyBook board.",
  "/page-map": "Every page in the hub and who can open it.",
  "/quoting": "Build a custom event quote.",
  "/proposals": "Branded proposals and PDFs.",
  "/vendors": "Partner and vendor list.",
  "/rentals/quotes": "Hub opportunities, holds, estimates, and share links.",
  "/rentals/invoices": "Draft, send, and collect on Hub AV invoices.",
  "/rentals/costs": "Job costs and margin vs revenue.",
  "/rentals/reports": "Profit, AR, pipeline, gear, crew, and stock reports.",
  "/rentals/developer":
    "Terminal Mode API keys for Claude or scripts (Developer and API).",
  "/rentals/warehouse": "Check gear out and back for reserved jobs.",
  "/rentals/stock": "Owned qty minus gear currently out.",
  "/rentals/calendar": "Month view of gear out→back windows.",
  "/rentals/planner": "Four-week bars for open AV jobs.",
  "/rentals/travel": "Leave and return runs for one day.",
  "/rentals/activities": "Pre-job tasks due before gear out.",
  "/rentals/customers": "Hub-owned AV rental customers.",
  "/rentals/venues": "Job venues for AV quotes and orders.",
  "/rentals/suppliers": "Vendors and sub-hire for AV jobs.",
  "/rentals/crew": "Book People onto jobs with role and day rate.",
  "/rentals/contractors": "External freelancers for crew bookings.",
  "/rentals/serials": "Serialized asset units and barcodes.",
  "/rentals/templates": "Estimate and invoice terms templates.",
  "/rentals/catalog": "Products, packages, services, Comes with, and Duplicate.",
  "/contractor-pay": "Rates and payouts.",
  "/sms": "Business texting.",
  "/communications": "Automated client and staff emails.",
  "/meetings": "Notes and open loops.",
  "/drive": "Shared Google Drive files.",
  "/marketing-library": "Approved brand assets.",
  "/videos": "Recorded sessions and videos.",
  "/pebbles-and-rocks": "Quarterly team goals.",
  "/forum": "Longer team discussions.",
  "/changelog": "What changed in the hub.",
  "/hub-health": "Checks and errors.",
  "/hub-switcher": "Choose who can jump to other company hubs.",
  "/directory": "Company org chart.",
};

/**
 * Tools that are new (or just got a notable update), with the date they
 * shipped. A tool shows a NEW pill on the Tools page for NEW_TOOL_MAX_AGE_DAYS
 * after it ships, and the pill clears on a device once that tool is opened
 * from the Tools page.
 * When you add a Hub module, add its href here with today's date (YYYY-MM-DD).
 * Old entries can stay: they stop counting after the window.
 */
export const TOOL_ADDED_ON: Record<string, string> = {
  "/hub-switcher": "2026-11-08",
  "/scheduling": "2026-11-07",
  "/services": "2026-11-07",
  "/floor-plans": "2026-11-07",
  "/honeybook": "2026-11-06",
  "/inquiry-forms": "2026-11-04",
  "/av-show": "2026-11-01",
};

/** A tool stops being tagged NEW this many days after it shipped. */
export const NEW_TOOL_MAX_AGE_DAYS = 14;

export const TOOLS_SEEN_KEY = "lre-hub.tools.seen";

/**
 * True while a tool is inside its NEW window. Deliberately not tied to the
 * person's last visit: frequent visitors would otherwise never see a pill,
 * because every page view moved "last visit" past the ship date.
 */
export function isToolNew(href: string, opts: { now: Date }): boolean {
  const added = TOOL_ADDED_ON[href];
  if (!added) return false;
  const addedAt = new Date(`${added}T00:00:00Z`).getTime();
  if (Number.isNaN(addedAt)) return false;
  const ageDays = (opts.now.getTime() - addedAt) / 86_400_000;
  return ageDays >= 0 && ageDays < NEW_TOOL_MAX_AGE_DAYS;
}
