"use server";

import { createHash, timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { guestSafeNextPath } from "@/lib/auth/guest";

function codesEqual(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function guestAccessAction(input: {
  code: string;
  next?: string | null;
}): Promise<{ error: string | null; redirectTo?: string }> {
  const expected = process.env.GUEST_ACCESS_CODE?.trim() ?? "";
  const email = process.env.GUEST_AUTH_EMAIL?.trim() ?? "";
  const password = process.env.GUEST_AUTH_PASSWORD ?? "";

  if (!expected || !email || !password) {
    return {
      error:
        "Guest access is not configured yet. Ask an admin to set GUEST_ACCESS_CODE and the shared guest account env vars.",
    };
  }

  const code = input.code.trim();
  if (!code || !codesEqual(code, expected)) {
    return { error: "That access code isn’t valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error:
        "Guest sign-in failed. Ask an admin to check the shared guest account.",
    };
  }

  // Confirm the shared account is actually role=guest (misconfiguration guard).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Guest sign-in failed. Try again." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "guest") {
    await supabase.auth.signOut();
    return {
      error:
        "Guest account is misconfigured (role must be guest). Ask an admin.",
    };
  }

  return { error: null, redirectTo: guestSafeNextPath(input.next) };
}
