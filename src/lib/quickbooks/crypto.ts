import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function key(secret: string): Buffer {
  return createHash("sha256").update(`hub-qb-tokens:${secret}`).digest();
}

/** AES-256-GCM. Output: base64(iv | tag | ciphertext). */
export function encryptToken(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

export function decryptToken(blob: string, secret: string): string {
  const raw = Buffer.from(blob, "base64");
  const d = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}

/** Signed, expiring OAuth `state` so the callback can prove it started here, for this admin. */
export function signState(profileId: string, secret: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ p: profileId, t: now, n: randomBytes(6).toString("hex") })).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string, profileId: string, secret: string, now = Date.now(), maxAgeMs = 15 * 60_000): boolean {
  const [body, sig] = state.split(".");
  if (!body || !sig) return false;
  const want = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const v = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { p: string; t: number };
    return v.p === profileId && now - v.t >= 0 && now - v.t <= maxAgeMs;
  } catch {
    return false;
  }
}
