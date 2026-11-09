import "server-only";

import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/** Salted scrypt hash, stored as "salt:hash" (hex). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function key(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("Server secret not configured");
  return k;
}

function mac(portalId: string, expiry: number): string {
  return createHmac("sha256", key())
    .update(`venue-coordinator|${portalId}|${expiry}`)
    .digest("hex");
}

/** Short-lived proof that the coordinator password was entered for this venue. */
export function signCoordinatorToken(portalId: string): string {
  const expiry = Date.now() + TOKEN_TTL_MS;
  return `${expiry}.${mac(portalId, expiry)}`;
}

export function verifyCoordinatorToken(
  portalId: string,
  token: string | undefined | null,
): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const expiry = Number(expStr);
  if (!Number.isFinite(expiry) || expiry < Date.now() || !sig) return false;
  const expected = Buffer.from(mac(portalId, expiry), "hex");
  const actual = Buffer.from(sig, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
