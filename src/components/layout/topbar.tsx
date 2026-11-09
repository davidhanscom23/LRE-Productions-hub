"use client";

import { Eye, LayoutGrid, Menu } from "lucide-react";
import { HubSwitcherMenu } from "@/components/hub-switcher/hub-switcher-menu";
import type { HubTile } from "@/lib/hub-switcher/tiles";
import { startViewAsStaffAction } from "@/lib/auth/view-as-actions";
import { AppearanceMenu } from "@/components/theme-toggle";
import { useMobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { OnlinePresence } from "@/components/presence/online-presence";
import { GlobalSearch } from "@/components/search/global-search";
import { isGuestRole } from "@/lib/auth/guest";
import { colorSoftBackground, normalizeHexColor } from "@/lib/people/color";
import type { Profile } from "@/lib/types/database";
import { ROLE_LABELS } from "@/lib/types/database";
import { SignOutButton } from "@/components/auth/sign-out-button";

type TopbarProps = {
  profile: Profile;
  viewAs?: { canSwitch: boolean; viewing: boolean };
  hubTiles?: HubTile[];
};

export function Topbar({ profile, viewAs, hubTiles = [] }: TopbarProps) {
  const { toggle } = useMobileNav();
  const isGuest = isGuestRole(profile.role);
  const displayName = isGuest
    ? "Guest"
    : profile.full_name?.trim() || profile.email.split("@")[0] || "Staff";
  const hex = normalizeHexColor(profile.color);

  return (
    <header className="z-30 flex h-14 w-full min-w-0 shrink-0 items-center gap-2 overflow-x-clip border-b border-[var(--border)] bg-[var(--surface)] px-3 sm:gap-3 sm:px-4">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--foreground)] hover:bg-[var(--surface-hover)] sm:h-9 sm:w-9 sm:text-[var(--muted)] sm:hover:text-[var(--foreground)]"
        aria-label="Open menu"
        title="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {!isGuest ? <GlobalSearch /> : <div className="min-w-0 flex-1" />}

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {viewAs?.canSwitch && !viewAs.viewing ? (
          <button
            type="button"
            title="Preview the hub as a staff member"
            aria-label="View as staff"
            onClick={async () => {
              await startViewAsStaffAction();
              window.location.assign("/");
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          >
            <Eye className="h-4 w-4" />
            <span className="hidden md:inline">View as staff</span>
          </button>
        ) : null}
        {!isGuest && hubTiles.length ? <HubSwitcherMenu tiles={hubTiles} /> : null}
        {!isGuest && !hubTiles.length ? (
          <button
            type="button"
            className="hidden h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] sm:inline-flex"
            aria-label="Quick links"
            title="Quick links"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        ) : null}

        {!isGuest ? (
          <AppearanceMenu preferredTheme={profile.theme_preference} />
        ) : null}

        {!isGuest ? (
          <OnlinePresence
            userId={profile.id}
            name={displayName}
            color={profile.color}
          />
        ) : null}

        {!isGuest ? <NotificationBell /> : null}

        <div className="hidden items-center gap-2 border-l border-[var(--border)] pl-2 sm:flex">
          <div className="text-right">
            <p className="text-sm font-medium text-[var(--foreground)]">
              {displayName}
            </p>
            <p className="text-[11px] text-[var(--muted)]">
              {isGuest ? "Read-only" : ROLE_LABELS[profile.role]}
            </p>
          </div>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
            style={
              hex
                ? {
                    backgroundColor: colorSoftBackground(hex, 0.22),
                    color: hex,
                    boxShadow: `0 0 0 2px ${hex}`,
                  }
                : {
                    backgroundColor: "var(--brand-soft)",
                    color: "var(--brand)",
                  }
            }
            aria-hidden
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>

        <SignOutButton />
      </div>
    </header>
  );
}
