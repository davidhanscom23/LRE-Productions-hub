/**
 * The small badge after a HoneyBook project's name: where a project that did not come from
 * HoneyBook was made. "hub" = Hub New project; "web_form" = a website Inquiry Form. Zapier and CSV
 * rows (HoneyBook event names) get no badge.
 *
 * Colors: the Hub badge keeps its original brand style. The Website badge has its own palette
 * (sky 900 on sky 100 is 8.2:1, sky 200 on sky 950 is 10.5:1), because brand text on brand/15
 * measured 3.59:1 in the light theme.
 */
export type HoneyBookSourceBadge = { label: string; title: string; colors: string };

const HUB_COLORS = "bg-[var(--brand)]/15 text-[var(--brand)]";
const WEBSITE_COLORS = "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200";

export function honeyBookSourceBadge(sourceEvent: string | null | undefined): HoneyBookSourceBadge | null {
  if (sourceEvent === "hub") return { label: "Hub", title: "Created in the Hub", colors: HUB_COLORS };
  if (sourceEvent === "web_form") return { label: "Website", title: "From a website inquiry form", colors: WEBSITE_COLORS };
  return null;
}
