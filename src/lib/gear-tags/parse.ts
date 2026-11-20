/** Reading the number off a scanned LRE gear tag. */

const SITE = "https://hub.lreproductions.com";

/**
 * Turn whatever a scan (or a typed entry) produced into a tag number, or null when it is not an
 * LRE tag. Accepts a hub link (`…/t/0001`), `LRE-0001`, `LRE 0001` or bare digits. Numbers are
 * 1 to 6 digits and are padded to at least 4, so `12` and `0012` are the same tag.
 */
export function parseTagCode(raw: string): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const link = text.match(/\/t\/(\d{1,6})(?:[/?#]|$)/i);
  const plain = text.match(/^(?:LRE(?:\s+PRODUCTIONS)?[\s\-_:#]*)?(\d{1,6})$/i);
  const digits = link?.[1] ?? plain?.[1];
  if (!digits) return null;
  if (/^0+$/.test(digits)) return null;
  return digits.padStart(4, "0");
}

/** The link a tag's QR code can hold. */
export function tagUrl(tag: string, site: string = SITE): string {
  return `${site.replace(/\/+$/, "")}/t/${tag}`;
}

/** How a tag is written for people. */
export function formatTag(tag: string | null | undefined): string {
  return tag ? `LRE ${tag}` : "No tag";
}
