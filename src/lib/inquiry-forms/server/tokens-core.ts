/**
 * Inquiry Forms - submission tokens and keyed hashes. PURE (node:crypto only, no env, no DB).
 *
 * A submission is addressed by {submissionId, token}. The browser keeps the token; the DB keeps
 * only sha256(token) as hex. IP addresses and emails used as rate-limit keys are stored only as
 * HMAC-SHA256(secret, value).
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** 32 random bytes, base64url (43 chars). */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** What inquiry_submissions.token_hash stores. */
export function hashToken(token: string): string {
  return sha256Hex(token);
}

/** A token the server could have issued: base64url, 20..128 chars. */
export function isPlausibleToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{20,128}$/.test(value);
}

/** Constant-time compare of two hex digests (false on any length or format mismatch). */
export function hexDigestsEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (!/^[0-9a-f]+$/.test(a) || !/^[0-9a-f]+$/.test(b)) return false;
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** true when `token` hashes to the stored hash. */
export function tokenMatches(token: unknown, storedHash: string | null | undefined): boolean {
  if (!isPlausibleToken(token) || typeof storedHash !== "string") return false;
  return hexDigestsEqual(hashToken(token), storedHash.toLowerCase());
}

export function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

/**
 * The module secret: INQUIRY_FORMS_SECRET when set, else HMAC(SUPABASE_SERVICE_ROLE_KEY,
 * "inquiry-forms:v1") so no new env var is required. null when neither exists.
 */
export function deriveSecret(env: {
  INQUIRY_FORMS_SECRET?: string | undefined;
  SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
}): string | null {
  const own = env.INQUIRY_FORMS_SECRET?.trim();
  if (own) return own;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceKey) return hmacHex(serviceKey, "inquiry-forms:v1");
  return null;
}
