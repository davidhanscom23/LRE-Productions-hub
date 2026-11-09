import { isInternalAddress } from "@/lib/honeybook/gmail/rules";

/**
 * Pure helpers that keep the email trail tidy: no repeated to-dos, and no
 * confusing two different prospects who write through the same marketplace address.
 */

/**
 * Lead marketplaces send every prospect from one shared relay address, so the sender
 * address says nothing about WHO the client is. Mail from these is matched by email
 * thread only, and the real client name comes from the message body.
 */
const MARKETPLACE_RELAY_DOMAINS = [
  "gigsalad.com",
  "thebash.com",
  "theknot.com",
  "weddingwire.com",
  "thumbtack.com",
  "eventective.com",
  "bark.com",
  "zola.com",
  "peerspace.com",
];

const MARKETPLACE_NAMES: Record<string, string> = {
  "gigsalad.com": "GigSalad",
  "thebash.com": "The Bash",
  "theknot.com": "The Knot",
  "weddingwire.com": "WeddingWire",
  "thumbtack.com": "Thumbtack",
  "eventective.com": "Eventective",
  "bark.com": "Bark",
  "zola.com": "Zola",
  "peerspace.com": "Peerspace",
};

function domainOf(address: string): string {
  const at = address.lastIndexOf("@");
  return at >= 0 ? address.slice(at + 1).toLowerCase() : "";
}

export function isMarketplaceRelay(address: string): boolean {
  const d = domainOf(address);
  return MARKETPLACE_RELAY_DOMAINS.some((x) => d === x || d.endsWith(`.${x}`));
}

/** Display name of the marketplace behind a relay address (null when it is not one). */
export function marketplaceName(address: string): string | null {
  const d = domainOf(address);
  const key = Object.keys(MARKETPLACE_NAMES).find((x) => d === x || d.endsWith(`.${x}`));
  return key ? MARKETPLACE_NAMES[key] : null;
}

/** Addresses that can safely identify one client (everything except shared relay addresses). */
export function identifyingParticipants(participants: string[]): string[] {
  return participants.filter((p) => !isMarketplaceRelay(p));
}

/**
 * The address to remember when staff say "not a lead": the prospect's own address, never a
 * shared marketplace relay, a Vident address, or blank.
 */
export function notLeadSenderKey(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  if (!e || !e.includes("@")) return null;
  if (isMarketplaceRelay(e) || isInternalAddress(e)) return null;
  return e;
}

/** Compare notes ignoring case, punctuation, and spacing. */
export function normalizeNote(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9$]+/g, " ")
    .trim();
}

/** A to-do that only tells someone to look at an inbox or message in a platform adds no information. */
export function isInboxChaseAction(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(check|monitor|watch|look at|review)\b.{0,40}\b(inbox|messages?|platform|portal)\b/.test(t) ||
    /\breceive (a )?(message|quote|reply|response)\b.{0,60}\b(inbox|platform|portal|gigsalad|the knot|thumbtack)\b/.test(
      t,
    )
  );
}

/** "Confirm and update the project date to X" repeats a date/location/budget conflict note. */
export function isRestatedConflict(text: string): boolean {
  return /\b(confirm|update|change|set)\b.{0,50}\b(project )?(date|location|budget)\b/i.test(text);
}

export type NewNote = { body: string; needs_action: boolean };

/**
 * Drop to-dos that are already open on the project (or repeated within this batch).
 * Notes that are not to-dos always pass through.
 */
export function dropRepeatedActions<T extends NewNote>(rows: T[], openActionBodies: string[]): T[] {
  const seen = new Set(openActionBodies.map(normalizeNote));
  const out: T[] = [];
  for (const row of rows) {
    if (!row.needs_action) {
      out.push(row);
      continue;
    }
    const key = normalizeNote(row.body);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
