"use server";

import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { signCoordinatorToken, verifyPassword } from "@/lib/venue-portals/access";
import { loadPortalBundle } from "@/lib/venue-portals/data";
import { getCurrentProfile } from "@/lib/auth/profile";

export type CoordinatorAccessResult =
  | { ok: true; token: string; savingsPct: number; savingsLabel: string }
  | { ok: false; error: string };

/**
 * Checks the venue's coordinator password. On success returns a short-lived
 * signed token plus the venue's savings terms (the only way the browser ever
 * learns them). Wrong guesses are slowed down.
 */
export async function verifyCoordinatorPasswordAction(
  slug: string,
  password: string,
): Promise<CoordinatorAccessResult> {
  if (!isServiceRoleConfigured()) {
    return { ok: false, error: "Not available right now. Please try again later." };
  }
  const profile = await getCurrentProfile();
  const loaded = await loadPortalBundle(String(slug).slice(0, 80), {
    includeUnpublished: profile?.role === "admin",
  });
  const hash = loaded?.coordinatorPasswordHash;
  // Same delay for every outcome so guesses stay slow and uniform.
  await new Promise((r) => setTimeout(r, 600));
  if (!loaded || !hash) return { ok: false, error: "That password isn't right." };
  const attempt = String(password ?? "").slice(0, 200);
  if (!attempt || !verifyPassword(attempt, hash)) {
    return { ok: false, error: "That password isn't right." };
  }
  return {
    ok: true,
    token: signCoordinatorToken(loaded.bundle.portal.id),
    savingsPct: loaded.bundle.portal.rates.savingsPct,
    savingsLabel: loaded.bundle.portal.rates.savingsLabel,
  };
}
