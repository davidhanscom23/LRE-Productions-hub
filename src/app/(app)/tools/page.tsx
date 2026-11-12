import { redirect } from "next/navigation";
import { ToolsLauncher } from "@/components/tools/tools-launcher";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isGuestRole } from "@/lib/auth/guest";
import { isSharedCalendarConfigured } from "@/lib/calendar/settings";
import { canViewStaffHandbook } from "@/lib/handbook/settings";
import { createClient } from "@/lib/supabase/server";
import { canAccessVidentAv } from "@/lib/vident-av-access";

export const metadata = { title: "Tools" };

export default async function ToolsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isGuest = isGuestRole(profile.role);
  const isAdmin = profile.role === "admin";
  const showCalendar = !isGuest && (isAdmin || (await isSharedCalendarConfigured()));
  const showHandbook = isGuest ? false : await canViewStaffHandbook(isAdmin);
  const showMarketing = profile.role === "admin" || profile.role === "trainer";

  let pinnedHrefs: string[] | null = null;
  if (!isGuest) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("home_shortcuts")
        .select("href")
        .eq("user_id", profile.id)
        .order("sort_order", { ascending: true });
      if (data && data.length) pinnedHrefs = data.map((r) => r.href as string);
    } catch {
      // falls back to the default quick tools
    }
  }

  return (
    <ToolsLauncher
      pinnedHrefs={pinnedHrefs}
      profile={profile}
      access={{
        isGuest,
        isAdmin,
        showCalendar,
        showVidentAv: !isGuest && canAccessVidentAv(profile),
        showHandbook,
        showMarketing: !isGuest && showMarketing,
      }}
    />
  );
}
