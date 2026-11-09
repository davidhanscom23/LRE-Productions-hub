/**
 * Inquiry Forms admin: the direct link and the ONE embed snippet handed to the website.
 * PURE module. The snippet is the self-sizing hosted script only: no iframe, no fixed height,
 * no pasted inline code (KM Hub lesson: a fixed-height fallback got pasted and looked broken).
 */

/** Canonical origin without trailing slashes ("https://hub.example.com/" -> "https://hub.example.com"). */
export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Public page of a form: ORIGIN/inquire/SLUG. */
export function directFormUrl(origin: string, slug: string): string {
  return `${normalizeOrigin(origin)}/inquire/${encodeURIComponent(slug)}`;
}

/** Hosted embed loader: ORIGIN/inquire/embed.js. */
export function embedScriptUrl(origin: string): string {
  return `${normalizeOrigin(origin)}/inquire/embed.js`;
}

/**
 * The single embed snippet. The hub origin is pinned on the container (data-inquiry-form-origin, the
 * attribute the hosted loader reads first) so the form still finds the hub when a speed plugin
 * (WP Rocket and the like) delays the script, strips its src, or copies it onto the host domain.
 */
export function buildEmbedSnippet(origin: string, slug: string): string {
  const o = escapeAttr(normalizeOrigin(origin));
  const s = escapeAttr(slug);
  return `<div data-inquiry-form="${s}" data-inquiry-form-origin="${o}"></div>\n<script async src="${o}/inquire/embed.js"></script>`;
}

/**
 * Guard for anything handed out as embed code: it must load the hosted script, pin the origin on
 * the container, and carry no iframe, fixed height or inline script body (a frozen pasted copy
 * never receives fixes). Returns the problems found ([] = safe to hand out).
 */
export function embedSnippetProblems(snippet: string, origin: string, slug: string): string[] {
  const problems: string[] = [];
  const o = normalizeOrigin(origin);
  if (!snippet.includes(`src="${o}/inquire/embed.js"`)) problems.push("does not load the hosted embed script");
  if (!snippet.includes(`data-inquiry-form="${slug}"`)) problems.push("has no form container for this slug");
  if (!snippet.includes(`data-inquiry-form-origin="${o}"`)) problems.push("does not pin the hub origin on the container");
  if (/<iframe/i.test(snippet)) problems.push("contains an iframe (fixed size)");
  if (/\bheight\s*[:=]/i.test(snippet)) problems.push("sets a fixed height");
  if (/<script(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(snippet)) problems.push("contains inline script code");
  return problems;
}
