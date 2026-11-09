import "server-only";

/**
 * Inquiry Forms - spam checks that need the DB or the network (pure rules live in spam-core.ts).
 * Infrastructure failures never turn a visitor into spam: a counter that cannot be read counts as
 * "not over the limit", and a Turnstile outage is logged, not held against the visitor.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessSettings } from "../types";
import { rateHit } from "./db";
import { readTurnstileResult, turnstileEnabled, type TurnstileOutcome } from "./spam-core";

/** Count one hit; null when the counter could not be updated (logged). */
export async function countHit(sb: SupabaseClient, key: string, windowStart: string): Promise<number | null> {
  try {
    return await rateHit(sb, key, windowStart);
  } catch (err) {
    console.error("[inquiry-forms] rate counter failed", key.split(":")[0], err instanceof Error ? err.message : err);
    return null;
  }
}

export function isTurnstileOn(business: Pick<BusinessSettings, "spam">): boolean {
  return turnstileEnabled(
    {
      TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    },
    business,
  );
}

/** The public site key, only when Turnstile is on. */
export function turnstileSiteKey(business: Pick<BusinessSettings, "spam">): string | null {
  return isTurnstileOn(business) ? (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? null) : null;
}

/** Cloudflare siteverify. "missing" = no token sent; "error" = we could not ask Cloudflare. */
export async function verifyTurnstile(token: string | null, ip: string | null): Promise<TurnstileOutcome | "missing"> {
  if (!token) return "missing";
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return "error";
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[inquiry-forms] turnstile siteverify HTTP", res.status);
      return "error";
    }
    return readTurnstileResult(await res.json().catch(() => null));
  } catch (err) {
    console.error("[inquiry-forms] turnstile siteverify failed", err instanceof Error ? err.message : err);
    return "error";
  }
}
