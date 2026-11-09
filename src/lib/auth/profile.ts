import { cache } from "react";
import { cookies } from "next/headers";
import { VIEW_AS_COOKIE, VIEW_AS_STAFF } from "@/lib/auth/view-as";
import { createClient } from "@/lib/supabase/server";
import { normalizeHexColor } from "@/lib/people/color";
import {
  normalizeDepartments,
  type Profile,
} from "@/lib/types/database";
import {
  PROFILE_SAFE_COLUMNS,
  PROFILE_SAFE_COLUMNS_PRE_SOCIAL,
  PROFILE_SAFE_COLUMNS_PRE_THEME,
  isProfilesSocialSelectError,
  isProfilesThemeSelectError,
} from "@/lib/types/profile-columns";
import { normalizeThemePreference } from "@/lib/theme/preference";

function mapProfileRow(data: Record<string, unknown>): Profile {
  const row = data as Profile & { reports_to?: string | null };
  return {
    ...row,
    departments: normalizeDepartments(data.departments),
    color: normalizeHexColor(data.color),
    reports_to: row.reports_to ?? null,
    facebook_url: row.facebook_url ?? null,
    instagram_url: row.instagram_url ?? null,
    linkedin_url: row.linkedin_url ?? null,
    twitter_url: row.twitter_url ?? null,
    theme_preference: normalizeThemePreference(data.theme_preference),
  };
}

/**
 * Cached per request: the signed-in user. Wrapping this in React `cache()`
 * means the network `auth.getUser()` call happens once per request even though
 * many helpers (layout, page, calendar helpers) all need the user.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Cached per request. The layout AND the page both call this on every
 * navigation; `cache()` dedupes it so we don't re-run the select + RPCs twice.
 */
export const getRealProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const user = await getSessionUser();

  if (!user) return null;

  let { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SAFE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  if (error && isProfilesSocialSelectError(error.message)) {
    const fallbackSocial = await supabase
      .from("profiles")
      .select(PROFILE_SAFE_COLUMNS_PRE_SOCIAL)
      .eq("id", user.id)
      .maybeSingle();
    data = fallbackSocial.data as typeof data;
    error = fallbackSocial.error;
  }

  // Before migration 019: theme_preference column may not exist yet.
  if (error && isProfilesThemeSelectError(error.message)) {
    const fallback = await supabase
      .from("profiles")
      .select(PROFILE_SAFE_COLUMNS_PRE_THEME)
      .eq("id", user.id)
      .maybeSingle();
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error || !data) return null;

  return mapProfileRow(data as Record<string, unknown>);
});

/**
 * The profile the app should act on. For a real admin who switched on
 * "View as staff", this is their profile with the role downgraded to staff, so
 * every page, menu and gate renders exactly as a staff member sees it. Database
 * access is unchanged (row-level security still sees the real admin).
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const real = await getRealProfile();
  if (!real) return null;
  if (real.role === "admin") {
    try {
      const jar = await cookies();
      if (jar.get(VIEW_AS_COOKIE)?.value === VIEW_AS_STAFF) {
        return { ...real, role: "staff" };
      }
    } catch {
      // cookies() unavailable outside a request — use the real profile
    }
  }
  return real;
});

/** True when a real admin is currently previewing the hub as staff. */
export async function isViewingAsStaff(): Promise<boolean> {
  const real = await getRealProfile();
  if (!real || real.role !== "admin") return false;
  try {
    const jar = await cookies();
    return jar.get(VIEW_AS_COOKIE)?.value === VIEW_AS_STAFF;
  } catch {
    return false;
  }
}
