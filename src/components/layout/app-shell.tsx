"use client";

import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import type { HubTile } from "@/lib/hub-switcher/tiles";
import { Topbar } from "@/components/layout/topbar";
import { ViewAsBanner } from "@/components/layout/view-as-banner";
import { MottoBar } from "@/components/layout/motto-bar";
import { GearChecklistDuePopup } from "@/components/event-checklist/due-popup";
import { HuddleBar } from "@/components/huddle/huddle-bar";
import { MobileNavProvider } from "@/components/layout/mobile-nav";
import { HubPointsDiscoverTracker } from "@/components/points/hub-points-discover-tracker";
import { HowToVideoLink } from "@/components/how-to/how-to-video-link";
import { HolidayAtmosphere } from "@/components/holidays/holiday-atmosphere";
import { HolidayProvider } from "@/components/holidays/holiday-context";
import {
  HOLIDAY_THEMES,
  isHolidayId,
  type HolidayId,
} from "@/lib/holidays/holidays";
import { isGuestRole } from "@/lib/auth/guest";
import { canAccessVidentAv } from "@/lib/vident-av-access";
import type { StaffColorEntry } from "@/lib/people/color";
import type { Profile } from "@/lib/types/database";

type AppShellProps = {
  profile: Profile;
  teamColors: StaffColorEntry[];
  showHandbook?: boolean;
  /** Shared HoneyBook/work calendar configured (all non-guests can open Calendar). */
  showCalendar?: boolean;
  /** Real admins can preview the hub as staff; `viewing` = currently doing so. */
  viewAs?: { canSwitch: boolean; viewing: boolean };
  /** Hubs this person can jump to from the top bar (empty = none). */
  hubTiles?: HubTile[];
  /** Active holiday skin for today (or an admin preview), resolved on the server. */
  holiday?: HolidayId | null;
  children: React.ReactNode;
};

export function AppShell({
  profile,
  teamColors,
  showHandbook = false,
  showCalendar: showCalendarProp,
  viewAs = { canSwitch: false, viewing: false },
  holiday = null,
  hubTiles = [],
  children,
}: AppShellProps) {
  const isGuest = isGuestRole(profile.role);
  const params = useSearchParams();
  const previewParam = params.get("holiday");
  // ?holiday=<id> previews a skin for admins only; guests never get one.
  const holidayPreview =
    profile.role === "admin" && isHolidayId(previewParam) ? previewParam : null;
  const holidayId: HolidayId | null = isGuest ? null : (holidayPreview ?? holiday);
  const forcePopup = params.get("holidayPopup") === "1";
  const showCalendar =
    showCalendarProp ?? (!isGuest && profile.role === "admin");
  const isAdmin = profile.role === "admin";
  const showVidentAv = !isGuest && canAccessVidentAv(profile);
  const showMarketing =
    !isGuest &&
    (profile.role === "admin" || profile.role === "trainer");

  return (
    <HolidayProvider id={holidayId} forcePopup={forcePopup}>
    <MobileNavProvider>
        {/*
          h-dvh + safe-area padding: on the installed iOS home-screen app the
          status bar overlays the page; without inset padding the Topbar (menu +
          search) sits under the clock and looks “zoomed away”.
        */}
        <div
          className="relative flex h-dvh max-h-dvh w-full max-w-[100dvw] overflow-hidden bg-[var(--background)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          {...(holidayId ? { "data-holiday": holidayId } : {})}
        >
          {holidayId ? <HolidayAtmosphere id={holidayId} /> : null}
          <div className="relative z-10 flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <Sidebar
            showCalendar={showCalendar}
            showVidentAv={showVidentAv}
            showHandbook={!isGuest && showHandbook}
            showMarketing={showMarketing}
            isGuest={isGuest}
            teamColors={isGuest ? [] : teamColors}
            isAdmin={isAdmin}
          />
          <div className="hub-main-column flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
            {viewAs.viewing ? <ViewAsBanner /> : null}
            <Topbar profile={profile} viewAs={viewAs} hubTiles={hubTiles} />
            {!isGuest ? <HuddleBar isAdmin={isAdmin} /> : null}
            {!isGuest && !viewAs.viewing ? <GearChecklistDuePopup /> : null}
            {!isGuest ? (
              <MottoBar
                holidayTagline={holidayId ? HOLIDAY_THEMES[holidayId].tagline : null}
              />
            ) : null}
            {!isGuest ? <HubPointsDiscoverTracker enabled /> : null}
            <main className="relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8">
              {!isGuest ? <HowToVideoLink profile={profile} /> : null}
              {children}
            </main>
          </div>
          </div>
        </div>
    </MobileNavProvider>
    </HolidayProvider>
  );
}
