import "server-only";

/**
 * Inquiry Forms - submission tokens and keyed hashes with the module secret.
 * Secret = INQUIRY_FORMS_SECRET, else HMAC(SUPABASE_SERVICE_ROLE_KEY, "inquiry-forms:v1").
 */
import { deriveSecret, hashToken, hmacHex, newToken, tokenMatches } from "./tokens-core";

export { hashToken, newToken, tokenMatches };

export function inquirySecret(): string {
  const secret = deriveSecret({
    INQUIRY_FORMS_SECRET: process.env.INQUIRY_FORMS_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!secret) throw new Error("Inquiry Forms needs INQUIRY_FORMS_SECRET or SUPABASE_SERVICE_ROLE_KEY.");
  return secret;
}

/** HMAC-SHA256(secret, ip) as hex; null without an IP. */
export function ipHashFor(ip: string | null): string | null {
  return ip ? hmacHex(inquirySecret(), ip) : null;
}

/** Rate-limit key for an email address (never stored in the clear). */
export function emailKeyFor(email: string): string {
  return hmacHex(inquirySecret(), `email:${email.trim().toLowerCase()}`);
}
