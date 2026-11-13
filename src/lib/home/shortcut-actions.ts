"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { isSharedCalendarConfigured } from "@/lib/calendar/settings";
import { canViewStaffHandbook } from "@/lib/handbook/settings";
import { createClient } from "@/lib/supabase/server";
import { canAccessAv } from "@/lib/av-access";
import {
  accessibleShortcutHrefs,
  type ShortcutAccess,
} from "@/lib/home/shortcuts";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

/** Save the current user's Home shortcut selection (access-validated server-side). */
export async function saveShortcutsAction(hrefs: string[]): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const isAdmin = profile.role === "admin";
  const access: ShortcutAccess = {
    isAdmin,
    showCalendar: isAdmin || (await isSharedCalendarConfigured()),
    showAv: canAccessAv(profile),
    showMarketing: profile.role === "admin" || profile.role === "trainer",
    showHandbook: await canViewStaffHandbook(isAdmin),
  };

  // Only keep hrefs this user is actually allowed to pin (no admin-only tiles
  // for staff/trainers), de-duplicated, order preserved, capped.
  const allowed = accessibleShortcutHrefs(access);
  const seen = new Set<string>();
  const clean = (Array.isArray(hrefs) ? hrefs : [])
    .filter((h) => typeof h === "string" && allowed.has(h))
    .filter((h) => (seen.has(h) ? false : (seen.add(h), true)))
    .slice(0, 12);

  const supabase = await createClient();
  const { error: delError } = await supabase
    .from("home_shortcuts")
    .delete()
    .eq("user_id", profile.id);
  if (delError) return { error: delError.message };

  if (clean.length > 0) {
    const rows = clean.map((href, i) => ({
      user_id: profile.id,
      href,
      sort_order: i,
    }));
    const { error } = await supabase.from("home_shortcuts").insert(rows);
    if (error) return { error: error.message };
  }

  revalidatePath("/");
  return { error: null };
}
