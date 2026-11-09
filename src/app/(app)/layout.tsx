import { AppShell } from "@/components/layout/app-shell";
import { isGuestRole } from "@/lib/auth/guest";
import { touchHubVisit } from "@/lib/auth/hub-visit";
import {
  getCurrentProfile,
  getRealProfile,
  isViewingAsStaff,
} from "@/lib/auth/profile";
import { loadHubTiles } from "@/lib/hub-switcher/data";
import { isSharedCalendarConfigured } from "@/lib/calendar/settings";
import { activeHolidayId } from "@/lib/holidays/holidays";
import { adminHolidayPreview } from "@/lib/holidays/holiday-preview";
import { canViewStaffHandbook } from "@/lib/handbook/settings";
import { normalizeHexColor, type StaffColorEntry } from "@/lib/people/color";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Profile } from "@/lib/types/database";

async function resolveProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (profile) return profile;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Auth session without a profiles row — never invent staff privileges.
  // Least privilege until an admin (re)creates the profile.
  return {
    id: user.id,
    email: user.email ?? "",
    full_name:
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Guest",
    role: "guest",
    avatar_url: null,
    departments: [],
    title: null,
    phone: null,
    birthday: null,
    start_date: null,
    bio: null,
    facebook_url: null,
    instagram_url: null,
    linkedin_url: null,
    twitter_url: null,
    is_active: true,
    color: null,
    reports_to: null,
    theme_preference: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function loadTeamColors(): Promise<StaffColorEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, color, is_active")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (!error && data) {
    return data.map((row) => ({
      id: row.id as string,
      full_name: (row.full_name as string) ?? "",
      email: (row.email as string) ?? "",
      color: normalizeHexColor((row as { color?: unknown }).color),
      is_active: Boolean(row.is_active),
    }));
  }

  // Before migration 018: color column may not exist yet
  const { data: fallback } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  return (fallback ?? []).map((row) => ({
    id: row.id as string,
    full_name: (row.full_name as string) ?? "",
    email: (row.email as string) ?? "",
    color: null,
    is_active: Boolean(row.is_active),
  }));
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await resolveProfile();
  const realProfile = await getRealProfile();
  const viewAs = {
    canSwitch: realProfile?.role === "admin",
    viewing: await isViewingAsStaff(),
  };
  const guest = isGuestRole(profile.role);
  if (!guest) await touchHubVisit();
  const teamColors = guest ? [] : await loadTeamColors();
  const showHandbook = guest
    ? false
    : await canViewStaffHandbook(profile.role === "admin");
  const showCalendar =
    !guest &&
    (profile.role === "admin" || (await isSharedCalendarConfigured()));

  const hubTiles = guest ? [] : await loadHubTiles(profile);

  const holidayPreview = guest
    ? null
    : await adminHolidayPreview(profile.role);
  const holiday = guest ? null : (holidayPreview ?? activeHolidayId());

  return (
    <AppShell
      profile={profile}
      teamColors={teamColors}
      showHandbook={showHandbook}
      showCalendar={showCalendar}
      viewAs={viewAs}
      holiday={holiday}
      hubTiles={hubTiles}
    >
      {children}
    </AppShell>
  );
}
