"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Award,
  BarChart3,
  BookOpen,
  Boxes,
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
  Clock,
  GraduationCap,
  HardHat,
  Heart,
  Home,
  LayoutGrid,
  ImagePlus,
  Inbox,
  KeyRound,
  LifeBuoy,
  ListChecks,
  CalendarDays,
  Film,
  FileText,
  FolderOpen,
  FormInput,
  Handshake,
  MapPinned,
  Megaphone,
  Medal,
  MonitorPlay,
  MessageSquare,
  MessageSquareQuote,
  MessagesSquare,
  Network,
  Package,
  Plane,
  Radio,
  Receipt,
  Rocket,
  Smartphone,
  Sparkles,
  Stethoscope,
  Map as MapIcon,
  Target,
  Trophy,
  Truck,
  UserPlus,
  Users,
  UsersRound,
  Video,
  Vote,
  Wand2,
  Warehouse,
  X,
  Ruler,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { TeamColorsLegend } from "@/components/layout/team-colors-legend";
import { useMobileNav } from "@/components/layout/mobile-nav";
import { CHANGELOG_SEEN_KEY, CHANGELOG_STAMP } from "@/lib/changelog";
import { COMPANY } from "@/lib/company";
import type { StaffColorEntry } from "@/lib/people/color";
import type { ToolsCategoryId } from "@/lib/tools/catalog";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /**
   * Tools page section. Required for every item except Home (`/`).
   * New Hub modules must set this so they appear under the right Tools group.
   */
  toolsCategory?: ToolsCategoryId;
  /** When true, only users with Calendar access see this link. */
  calendarAccess?: boolean;
  /** When true, only admin or AV-department users see this link. */
  videntAvAccess?: boolean;
  /** When true, hide unless Staff Handbook is visible to this user. */
  handbookAccess?: boolean;
  /** When true, only admin or trainer see this link. */
  marketerAccess?: boolean;
  /** When true, only admins see this link. */
  adminOnly?: boolean;
  /** When true, guests may see this link in read-only Guest Hub. */
  guestAccess?: boolean;
};

type NavGroupId =
  | "daily"
  | "work"
  | "people"
  | "learn"
  | "field"
  | "marketing"
  | "admin";

type NavGroup = {
  id: NavGroupId;
  label: string | null;
  /** Always expanded; no disclosure control. */
  pinned?: boolean;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "daily",
    label: null,
    pinned: true,
    items: [
      { href: "/", label: "Home", icon: Home, guestAccess: true },
      {
        href: "/for-you",
        label: "For You",
        icon: Inbox,
        toolsCategory: "me",
      },
      {
        href: "/points",
        label: "Hub points",
        icon: Trophy,
        toolsCategory: "me",
      },
      {
        href: "/winners",
        label: "Winners",
        icon: Medal,
        toolsCategory: "me",
      },
      {
        href: "/ask",
        label: "Ask the Hub",
        icon: Sparkles,
        toolsCategory: "me",
      },
      {
        href: "/my-week",
        label: "My Week",
        icon: CalendarDays,
        toolsCategory: "me",
      },
      {
        href: "/my-calendar",
        label: "My Calendar",
        icon: CalendarPlus,
        toolsCategory: "me",
      },
      {
        href: "/announcements",
        label: "Announcements",
        icon: Megaphone,
        guestAccess: false,
        toolsCategory: "comms",
      },
      {
        href: "/chat",
        label: "Chat",
        icon: MessageSquare,
        toolsCategory: "comms",
      },
      {
        href: "/forum",
        label: "Forum",
        icon: MessagesSquare,
        toolsCategory: "comms",
      },
      {
        href: "/changelog",
        label: "What's New",
        icon: Rocket,
        toolsCategory: "comms",
      },
    ],
  },
  {
    id: "work",
    label: "Work",
    items: [
      {
        href: "/calendar",
        label: "Calendar",
        icon: Calendar,
        calendarAccess: true,
        toolsCategory: "events",
      },
      {
        href: "/time-off",
        label: "Time Off",
        icon: CalendarClock,
        toolsCategory: "staffing",
      },
      {
        href: "/action-center",
        label: "Action Center",
        icon: ListChecks,
        toolsCategory: "staffing",
      },
      {
        href: "/sms",
        label: "SMS Portal",
        icon: Smartphone,
        adminOnly: true,
        toolsCategory: "comms",
      },
      {
        href: "/communications",
        label: "Communications",
        icon: Radio,
        adminOnly: true,
        toolsCategory: "comms",
      },
      {
        href: "/meetings",
        label: "Meetings",
        icon: Sparkles,
        marketerAccess: true,
        toolsCategory: "comms",
      },
      {
        href: "/drive",
        label: "Google Drive",
        icon: FolderOpen,
        marketerAccess: true,
        toolsCategory: "learn",
      },
      {
        href: "/expenses",
        label: "Expenses",
        icon: Receipt,
        toolsCategory: "staffing",
      },
      {
        href: "/contractor-pay",
        label: "Contractor Pay",
        icon: Briefcase,
        toolsCategory: "staffing",
      },
      {
        href: "/quoting",
        label: "Quoting",
        icon: ClipboardList,
        toolsCategory: "quotes",
      },
      {
        href: "/venue-quotes",
        label: "Venue Quotes",
        icon: ClipboardList,
        marketerAccess: true,
        toolsCategory: "quotes",
      },
      {
        href: "/proposals",
        label: "Proposals",
        icon: FileText,
        toolsCategory: "quotes",
      },
      {
        href: "/venue-quotes",
        label: "Venue Quotes",
        icon: Building2,
        adminOnly: true,
        toolsCategory: "quotes",
      },
      {
        href: "/staffing",
        label: "Staffing",
        icon: UsersRound,
        marketerAccess: true,
        toolsCategory: "staffing",
      },
      {
        href: "/rentals",
        label: "Vident AV",
        icon: Package,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/quotes",
        label: "AV Estimates",
        icon: ClipboardList,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/invoices",
        label: "AV Invoices",
        icon: Receipt,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/costs",
        label: "AV Costs",
        icon: BarChart3,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/reports",
        label: "AV Reports",
        icon: FileText,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/developer",
        label: "AV Developer",
        icon: KeyRound,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/warehouse",
        label: "AV Warehouse",
        icon: Warehouse,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/stock",
        label: "AV Stock",
        icon: Boxes,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/calendar",
        label: "AV Gear calendar",
        icon: Calendar,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/planner",
        label: "AV Planner",
        icon: MapPinned,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/travel",
        label: "AV Travel",
        icon: Plane,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/activities",
        label: "AV Activities",
        icon: ListChecks,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/customers",
        label: "AV Customers",
        icon: Users,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/venues",
        label: "AV Venues",
        icon: Building2,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/suppliers",
        label: "AV Suppliers",
        icon: Truck,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/crew",
        label: "AV Crew",
        icon: HardHat,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/contractors",
        label: "AV Contractors",
        icon: HardHat,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/serials",
        label: "AV Serials",
        icon: Boxes,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/templates",
        label: "AV Templates",
        icon: FileText,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/rentals/catalog",
        label: "AV Catalog",
        icon: Package,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/av-portals",
        label: "AV Event Portals",
        icon: ClipboardList,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/av-show",
        label: "AV Show Control",
        icon: MonitorPlay,
        videntAvAccess: true,
        toolsCategory: "vident-av",
      },
      {
        href: "/honeybook",
        label: "HoneyBook",
        icon: Handshake,
        toolsCategory: "quotes",
      },
      {
        href: "/floor-plans",
        label: "Floor Plans",
        icon: Ruler,
        toolsCategory: "quotes",
      },
      {
        href: "/services",
        label: "Services Catalog",
        icon: ListChecks,
        toolsCategory: "quotes",
      },
      {
        href: "/scheduling",
        label: "Scheduling",
        icon: CalendarClock,
        toolsCategory: "quotes",
      },
      {
        href: "/inquiry-forms",
        label: "Inquiry Forms",
        icon: FormInput,
        adminOnly: true,
        toolsCategory: "quotes",
      },
      {
        href: "/vendors",
        label: "Vendors",
        icon: Building2,
        toolsCategory: "quotes",
      },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      {
        href: "/people",
        label: "People",
        icon: Users,
        toolsCategory: "people",
      },
      {
        href: "/directory",
        label: "Directory",
        icon: Network,
        toolsCategory: "people",
      },
      {
        href: "/teams",
        label: "Teams",
        icon: UsersRound,
        toolsCategory: "people",
      },
      {
        href: "/reviews",
        label: "Performance Reviews",
        icon: Award,
        toolsCategory: "people",
      },
      {
        href: "/hiring",
        label: "Hiring",
        icon: Briefcase,
        adminOnly: true,
        toolsCategory: "people",
      },
      {
        href: "/onboarding",
        label: "Onboarding",
        icon: UserPlus,
        marketerAccess: true,
        toolsCategory: "people",
      },
      {
        href: "/kudos",
        label: "Kudos",
        icon: Heart,
        toolsCategory: "people",
      },
      {
        href: "/polls",
        label: "Polls",
        icon: Vote,
        toolsCategory: "people",
      },
      {
        href: "/pebbles-and-rocks",
        label: "Pebbles & Rocks",
        icon: Target,
        toolsCategory: "people",
      },
    ],
  },
  {
    id: "learn",
    label: "Learn & refs",
    items: [
      {
        href: "/training-portal",
        label: "Training Portal",
        icon: GraduationCap,
        guestAccess: true,
        toolsCategory: "learn",
      },
      {
        href: "/resources",
        label: "Resources",
        icon: FolderOpen,
        guestAccess: true,
        toolsCategory: "learn",
      },
      {
        href: "/marketing-library",
        label: "Marketing Library",
        icon: Film,
        guestAccess: true,
        toolsCategory: "learn",
      },
      {
        href: "/videos",
        label: "Video Archives",
        icon: Video,
        toolsCategory: "learn",
      },
      {
        href: "/documents",
        label: "Documents",
        icon: BookOpen,
        toolsCategory: "learn",
      },
      {
        href: "/support-guide",
        label: "Support Guide",
        icon: LifeBuoy,
        guestAccess: true,
        toolsCategory: "learn",
      },
    ],
  },
  {
    id: "field",
    label: "Field tools",
    items: [
      {
        href: "/event-packets",
        label: "Event Packets",
        icon: ClipboardCheck,
        toolsCategory: "events",
      },
      {
        href: "/client-reviews",
        label: "Client Reviews",
        icon: MessageSquareQuote,
        toolsCategory: "events",
      },
      {
        href: "/end-of-event-report",
        label: "End of Event Report",
        icon: ClipboardList,
        toolsCategory: "events",
      },
      {
        href: "/submit-event-photos",
        label: "Submit Event Photos",
        icon: ImagePlus,
        toolsCategory: "events",
      },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    items: [
      {
        href: "/social-studio",
        label: "Social Studio",
        icon: Megaphone,
        toolsCategory: "marketing",
      },
      {
        href: "/image-studio",
        label: "Image Studio",
        icon: Wand2,
        adminOnly: true,
        toolsCategory: "marketing",
      },
      {
        href: "/marketing",
        label: "Marketing Queue",
        icon: Target,
        marketerAccess: true,
        toolsCategory: "marketing",
      },
      {
        href: "/content-sla",
        label: "Content SLA",
        icon: Clock,
        marketerAccess: true,
        toolsCategory: "marketing",
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      {
        href: "/reports",
        label: "Reports",
        icon: BarChart3,
        adminOnly: true,
        toolsCategory: "admin",
      },
      {
        href: "/hub-switcher",
        label: "Hub switcher",
        icon: LayoutGrid,
        adminOnly: true,
        toolsCategory: "admin",
      },
      {
        href: "/hub-health",
        label: "Hub health",
        icon: Stethoscope,
        adminOnly: true,
        toolsCategory: "admin",
      },
      {
        href: "/page-map",
        label: "Page Map",
        icon: MapIcon,
        adminOnly: true,
        toolsCategory: "admin",
      },
    ],
  },
];

/** Flat list for any callers that need every route. */
export const PRIMARY_NAV: NavItem[] = NAV_GROUPS.filter((g) => g.id !== "field")
  .flatMap((g) => g.items);

export const FIELD_TOOLS_NAV: NavItem[] =
  NAV_GROUPS.find((g) => g.id === "field")?.items ?? [];

export const NAV_ITEMS = [...PRIMARY_NAV, ...FIELD_TOOLS_NAV];

// Short pinned list: everything else lives on the Tools page (/tools).
export const SIDEBAR_PINNED_HREFS = [
  "/",
  "/for-you",
  "/my-calendar",
  "/chat",
  "/ask",
  "/teams",
  "/people",
  "/resources",
];

export function itemIsActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLink({
  href,
  label,
  icon: Icon,
  onNavigate,
  showNewBadge = false,
  forceActive,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onNavigate: () => void;
  showNewBadge?: boolean;
  forceActive?: boolean;
}) {
  const pathname = usePathname();
  const active = forceActive ?? itemIsActive(pathname, href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--brand-soft)] text-[var(--brand)]"
          : "text-[var(--foreground)]/80 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" />
      <span className="leading-snug">{label}</span>
      {showNewBadge ? (
        <span className="ml-auto rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[9px] leading-none font-bold tracking-wide text-white">
          NEW
        </span>
      ) : null}
    </Link>
  );
}

type SidebarProps = {
  /** Admins always; staff when the shared HoneyBook calendar is connected. */
  showCalendar?: boolean;
  /** Admins or anyone with the AV department. */
  showVidentAv?: boolean;
  /** Admins always while draft; everyone once published. */
  showHandbook?: boolean;
  /** Admins and trainers. */
  showMarketing?: boolean;
  /** Read-only guest shell — only guestAccess nav items. */
  isGuest?: boolean;
  teamColors?: StaffColorEntry[];
  isAdmin?: boolean;
};

export function filterItem(
  item: NavItem,
  opts: {
    isGuest: boolean;
    isAdmin: boolean;
    showCalendar: boolean;
    showVidentAv: boolean;
    showHandbook: boolean;
    showMarketing: boolean;
  },
): boolean {
  if (opts.isGuest) return Boolean(item.guestAccess);
  if (item.adminOnly && !opts.isAdmin) return false;
  if (item.calendarAccess && !opts.showCalendar) return false;
  if (item.videntAvAccess && !opts.showVidentAv) return false;
  if (item.handbookAccess && !opts.showHandbook) return false;
  if (item.marketerAccess && !opts.showMarketing) return false;
  return true;
}

export function Sidebar({
  showCalendar = false,
  showVidentAv = false,
  showHandbook = false,
  showMarketing = false,
  isGuest = false,
  teamColors = [],
  isAdmin = false,
}: SidebarProps) {
  const pathname = usePathname();
  const { open, setOpen } = useMobileNav();
  const [changelogUnseen, setChangelogUnseen] = useState(false);

  // Show a NEW badge on "What's New" until this device has viewed the latest
  // changelog entries (the /changelog page records the stamp on open).
  useEffect(() => {
    const check = () => {
      try {
        setChangelogUnseen(
          window.localStorage.getItem(CHANGELOG_SEEN_KEY) !== CHANGELOG_STAMP,
        );
      } catch {
        setChangelogUnseen(false);
      }
    };
    check();
    window.addEventListener("vident-changelog-seen", check);
    return () => window.removeEventListener("vident-changelog-seen", check);
  }, [pathname]);

  const closeMobile = () => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches
    ) {
      return;
    }
    setOpen(false);
  };

  const access = useMemo(
    () => ({
      isGuest,
      isAdmin,
      showCalendar,
      showVidentAv,
      showHandbook,
      showMarketing,
    }),
    [
      isGuest,
      isAdmin,
      showCalendar,
      showVidentAv,
      showHandbook,
      showMarketing,
    ],
  );

  const groups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => filterItem(item, access)),
    })).filter((group) => group.items.length > 0);
  }, [access]);

  const pinnedItems = useMemo(() => {
    const all = groups.flatMap((g) => g.items);
    return SIDEBAR_PINNED_HREFS.map((href) =>
      all.find((i) => i.href === href),
    ).filter((i): i is NavItem => Boolean(i));
  }, [groups]);

  // "Tools" lights up on /tools and on any tool that is not pinned above.
  const toolsActive = useMemo(() => {
    if (pathname.startsWith("/tools")) return true;
    const pinned = new Set(SIDEBAR_PINNED_HREFS);
    return groups
      .flatMap((g) => g.items)
      .some((i) => !pinned.has(i.href) && itemIsActive(pathname, i.href));
  }, [groups, pathname]);

  return (
    <>
      {/* Mobile-only dimmed backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={() => setOpen(false)}
        className={[
          "fixed inset-0 z-40 bg-[var(--foreground)]/40 transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      <aside
        className={[
          "hub-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(17.5rem,88vw)] flex-col border-r border-[var(--border)] bg-[var(--sidebar)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-transform duration-200 md:w-60",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-4">
          <BrandLogo
            alt=""
            className="h-7 w-auto max-w-[9.5rem] object-contain object-left"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-[var(--foreground)]">
              {COMPANY.displayName}
            </p>
            <p className="truncate text-[11px] text-[var(--muted)]">
              {isGuest ? "Guest Hub (read-only)" : "Staff Hub"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto p-3">
          <div className="space-y-0.5">
            {pinnedItems.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                onNavigate={closeMobile}
              />
            ))}
            <NavLink
              href="/tools"
              label="Tools"
              icon={LayoutGrid}
              onNavigate={closeMobile}
              forceActive={toolsActive}
              showNewBadge={changelogUnseen}
            />
          </div>

          {!isGuest ? (
            <TeamColorsLegend staff={teamColors} isAdmin={isAdmin} />
          ) : null}
        </nav>
      </aside>

      {/* Desktop layout spacer — keeps main content clear of the fixed sidebar */}
      <div
        aria-hidden
        className={[
          "hidden shrink-0 transition-[width] duration-200 md:block",
          open ? "w-60" : "w-0",
        ].join(" ")}
      />
    </>
  );
}
