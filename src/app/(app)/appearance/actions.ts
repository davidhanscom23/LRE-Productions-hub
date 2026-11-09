"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeThemePreference,
  type ThemePreference,
} from "@/lib/theme/preference";

export async function saveThemePreferenceAction(
  value: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const preference = normalizeThemePreference(value);
  if (!preference) {
    return { ok: false, error: "Choose Light, Dark, or System." };
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return { ok: false, error: "You need to be signed in." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ theme_preference: preference satisfies ThemePreference })
    .eq("id", profile.id);

  if (error) {
    // Column missing until migration 019 is applied — local theme still works.
    if (/theme_preference/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Appearance sync isn’t set up in the database yet. Your choice still applies on this device.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
