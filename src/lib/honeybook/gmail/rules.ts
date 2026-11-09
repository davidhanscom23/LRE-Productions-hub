/**
 * Pure rules for deciding which staff emails the Hub is even allowed to look at.
 * The goal is data minimisation: automated mail, newsletters, and staff-to-staff
 * chatter are skipped before any AI call, and nothing from a skipped message is stored.
 */

export const INTERNAL_DOMAINS = ["videntproductions.com", "thevidentcompany.com"];

/** Systems that send automated mail the Hub already hears about another way (or never needs). */
const AUTOMATED_DOMAINS = [
  "honeybook.com",
  "google.com",
  "googlemail.com",
  "zoom.us",
  "stripe.com",
  "intuit.com",
  "quickbooks.com",
  "godaddy.com",
  "vercel.com",
  "supabase.io",
  "supabase.com",
  "resend.com",
  "leadleaf.app",
  "leadconnectorhq.com",
  "linkedin.com",
  "facebookmail.com",
];

const AUTOMATED_LOCAL_PART =
  /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounces?|notifications?|newsletter|news|alerts?|automated|system)([._+-]|$)/i;

export type HeaderMap = Record<string, string>;

const EMAIL_RE = /[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** Every email address in a header value, lowercased and de-duplicated. */
export function parseAddresses(value: string | null | undefined): string[] {
  if (!value) return [];
  const found = value.match(EMAIL_RE) ?? [];
  return [...new Set(found.map((a) => a.toLowerCase()))];
}

export function domainOf(address: string): string {
  const at = address.lastIndexOf("@");
  return at >= 0 ? address.slice(at + 1).toLowerCase() : "";
}

export function isInternalAddress(address: string): boolean {
  const d = domainOf(address);
  return INTERNAL_DOMAINS.some((x) => d === x || d.endsWith(`.${x}`));
}

export function isAutomatedAddress(address: string): boolean {
  const lower = address.toLowerCase();
  const local = lower.slice(0, lower.lastIndexOf("@"));
  if (AUTOMATED_LOCAL_PART.test(local)) return true;
  const d = domainOf(lower);
  return AUTOMATED_DOMAINS.some((x) => d === x || d.endsWith(`.${x}`));
}

/** Mass mail, auto-replies, and bounces announce themselves in headers. */
export function isAutomatedMessage(headers: HeaderMap, fromAddress: string): boolean {
  if (isAutomatedAddress(fromAddress)) return true;
  if (headers["list-unsubscribe"] || headers["list-id"]) return true;
  const precedence = (headers["precedence"] ?? "").toLowerCase();
  if (["bulk", "list", "junk"].includes(precedence)) return true;
  const auto = (headers["auto-submitted"] ?? "").toLowerCase();
  if (auto && auto !== "no") return true;
  if (headers["x-auto-response-suppress"]) return true;
  return false;
}

/** Everyone on the message who is not on a Vident domain. */
export function externalParticipants(addresses: {
  from: string;
  to: string[];
  cc: string[];
}): string[] {
  const all = [addresses.from, ...addresses.to, ...addresses.cc];
  return [...new Set(all.filter((a) => a && !isInternalAddress(a) && !isAutomatedAddress(a)))];
}

/**
 * Stable key for a message across mailboxes. Two staff on the same chain share the
 * RFC 822 Message-ID, so the trail logs it once. Falls back to mailbox + Gmail id.
 */
export function buildMessageKey(
  rfcMessageId: string | null | undefined,
  mailbox: string,
  gmailId: string,
): string {
  const cleaned = (rfcMessageId ?? "").trim().replace(/^<|>$/g, "").toLowerCase();
  return cleaned ? `rfc:${cleaned}` : `gmail:${mailbox.toLowerCase()}:${gmailId}`;
}

/** Drop the quoted history under a reply so each note covers only what is new. */
export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (/^on .{5,200} wrote:$/i.test(t)) break;
    if (/^-{2,}\s*(original message|forwarded message)\s*-{2,}$/i.test(t)) break;
    // Outlook-style header block: "From: ..." followed by "Sent:" / "Date:".
    if (
      /^from:\s.+/i.test(t) &&
      out.length > 3 &&
      /^(sent|date):/i.test((lines[i + 1] ?? "").trim())
    ) {
      break;
    }
    if (t.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
