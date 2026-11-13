import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canAccessAv } from "@/lib/av-access";

export { canAccessAv };

export async function requireAvErpAccess() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) {
    return {
      supabase,
      profile: null,
      error: "You must be signed in." as const,
    };
  }
  if (!canAccessAv(profile)) {
    return {
      supabase,
      profile: null,
      error: "LRE AV access required." as const,
    };
  }
  return { supabase, profile, error: null };
}
