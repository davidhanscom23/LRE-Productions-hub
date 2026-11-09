import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { AvTokenScope } from "@/lib/av-erp/terminal-token-types";

export function hashIntegrationToken(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function mintApiTokenPlaintext(): {
  plaintext: string;
  prefix: string;
  hash: string;
} {
  const secret = randomBytes(32).toString("hex");
  const plaintext = `avk_live_${secret}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, 16),
    hash: hashIntegrationToken(plaintext),
  };
}

export function scopesInclude(
  scopes: string[] | null | undefined,
  need: AvTokenScope,
): boolean {
  return Array.isArray(scopes) && scopes.includes(need);
}

export function hashesMatch(stored: string, computed: string): boolean {
  try {
    const a = Buffer.from(stored, "utf8");
    const b = Buffer.from(computed, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
