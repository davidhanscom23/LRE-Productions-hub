import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canAccessVidentAv } from "@/lib/vident-av-access";

export { canAccessVidentAv };

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
  if (!canAccessVidentAv(profile)) {
    return {
      supabase,
      profile: null,
      error: "Vident AV access required." as const,
    };
  }
  return { supabase, profile, error: null };
}
