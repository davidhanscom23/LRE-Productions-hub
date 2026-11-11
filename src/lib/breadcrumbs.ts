export type Crumb = { label: string; href: string | null };

const ID_LIKE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+|[0-9a-z]{20,})$/i;

function humanize(segment: string): string {
  const text = decodeURIComponent(segment).replace(/[-_]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : segment;
}

/**
 * Builds the trail for a Hub page: Home, then each parent, then the page.
 * `labels` maps a path (for example "/videos") to its sidebar name; any other
 * segment is made readable, and ids (uuids, numbers) become "Details".
 * Returns [] on the home page, where no trail is needed.
 */
export function buildCrumbs(pathname: string, labels: Record<string, string>): Crumb[] {
  const segments = pathname.split("?")[0].split("/").filter(Boolean);
  if (segments.length === 0) return [];
  const crumbs: Crumb[] = [{ label: "Home", href: "/" }];
  let path = "";
  segments.forEach((segment, i) => {
    path += `/${segment}`;
    const label = labels[path] ?? (ID_LIKE.test(segment) ? "Details" : humanize(segment));
    crumbs.push({ label, href: i === segments.length - 1 ? null : path });
  });
  return crumbs;
}
