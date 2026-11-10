"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  Boxes,
  Building2,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  Film,
  FolderOpen,
  FormInput,
  GraduationCap,
  Handshake,
  HardHat,
  Heart,
  ImagePlus,
  Inbox,
  KeyRound,
  LayoutGrid,
  LifeBuoy,
  ListChecks,
  Map as MapIcon,
  MapPinned,
  Megaphone,
  Medal,
  MessageSquare,
  MessagesSquare,
  MonitorPlay,
  Network,
  Package,
  Pencil,
  Plane,
  Radio,
  Receipt,
  Rocket,
  Share2,
  Smartphone,
  Sparkles,
  Stethoscope,
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
  type LucideIcon,
} from "lucide-react";
import { firstNameFrom, greetingForHour } from "@/lib/home/greeting";
import { BrandLogo } from "@/components/brand-logo";
import { HolidayPopup } from "@/components/holidays/holiday-popup";
import {
  useHoliday,
  useHolidayForcePopup,
} from "@/components/holidays/holiday-context";
import { holidayDateKeyNy } from "@/lib/holidays/holidays";
import { COMPANY } from "@/lib/company";
import { saveShortcutsAction } from "@/lib/home/shortcut-actions";
import {
  DEFAULT_SHORTCUT_HREFS,
  SHORTCUT_DEFS,
  isShortcutAccessible,
  type ShortcutAccess,
} from "@/lib/home/shortcuts";
import { weatherDisplay, type HubWeather } from "@/lib/weather";

type HomeWelcomeProps = {
  fullName: string;
  profileId?: string;
  email: string;
  weather: HubWeather | null;
  isAdmin?: boolean;
  showCalendar?: boolean;
  showVidentAv?: boolean;
  showMarketing?: boolean;
  showHandbook?: boolean;
  /** The user's saved shortcut hrefs in order, or null to use the default set. */
  pinnedHrefs?: string[] | null;
  isGuest?: boolean;
};

const SHORTCUT_ICONS: Record<string, { icon: LucideIcon; iconClass: string }> = {
  "/ask": { icon: Sparkles, iconClass: "bg-[var(--brand-soft)] text-[var(--brand)]" },
  "/my-week": { icon: CalendarDays, iconClass: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  "/for-you": { icon: Inbox, iconClass: "bg-[var(--brand-soft)] text-[var(--brand)]" },
  "/points": { icon: Trophy, iconClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  "/winners": { icon: Medal, iconClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  "/calendar": { icon: Calendar, iconClass: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300" },
  "/chat": { icon: MessageSquare, iconClass: "bg-[var(--brand-soft)] text-[var(--brand)]" },
  "/time-off": { icon: CalendarClock, iconClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  "/action-center": { icon: ListChecks, iconClass: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  "/expenses": { icon: Receipt, iconClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  "/announcements": { icon: Megaphone, iconClass: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
  "/kudos": { icon: Heart, iconClass: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300" },
  "/polls": { icon: Vote, iconClass: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300" },
  "/rentals": { icon: Package, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/teams": { icon: UsersRound, iconClass: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  "/people": { icon: Users, iconClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  "/directory": { icon: Network, iconClass: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300" },
  "/reviews": { icon: Award, iconClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300" },
  "/training-portal": { icon: GraduationCap, iconClass: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  "/resources": { icon: FolderOpen, iconClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  "/documents": { icon: BookOpen, iconClass: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" },
  "/staff-handbook": { icon: BookOpen, iconClass: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" },
  "/support-guide": { icon: LifeBuoy, iconClass: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  "/event-packets": { icon: ClipboardCheck, iconClass: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300" },
  "/social-studio": { icon: Share2, iconClass: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300" },
  "/end-of-event-report": { icon: ClipboardList, iconClass: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  "/submit-event-photos": { icon: ImagePlus, iconClass: "bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300" },
  "/marketing": { icon: Target, iconClass: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  "/image-studio": { icon: Wand2, iconClass: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" },
  "/hiring": { icon: Briefcase, iconClass: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  "/onboarding": { icon: UserPlus, iconClass: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
  "/venue-quotes": { icon: Building2, iconClass: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300" },
  "/tools": { icon: LayoutGrid, iconClass: "bg-[var(--brand-soft)] text-[var(--brand)]" },
  "/my-calendar": { icon: CalendarPlus, iconClass: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300" },
  "/forum": { icon: MessagesSquare, iconClass: "bg-[var(--brand-soft)] text-[var(--brand)]" },
  "/changelog": { icon: Rocket, iconClass: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
  "/pebbles-and-rocks": { icon: Target, iconClass: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  "/contractor-pay": { icon: Briefcase, iconClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  "/quoting": { icon: ClipboardList, iconClass: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300" },
  "/proposals": { icon: FileText, iconClass: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300" },
  "/vendors": { icon: Building2, iconClass: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  "/marketing-library": { icon: Film, iconClass: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
  "/videos": { icon: Video, iconClass: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  "/meetings": { icon: Sparkles, iconClass: "bg-[var(--brand-soft)] text-[var(--brand)]" },
  "/drive": { icon: FolderOpen, iconClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  "/sms": { icon: Smartphone, iconClass: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  "/communications": { icon: Radio, iconClass: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
  "/inquiry-forms": { icon: FormInput, iconClass: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300" },
  "/hub-health": { icon: Stethoscope, iconClass: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  "/page-map": { icon: MapIcon, iconClass: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  "/honeybook": { icon: Handshake, iconClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  "/staffing": { icon: UsersRound, iconClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  "/content-sla": { icon: Clock, iconClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  "/client-reviews": { icon: MessageSquare, iconClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  "/av-portals": { icon: ClipboardList, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/av-show": { icon: MonitorPlay, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/quotes": { icon: ClipboardList, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/invoices": { icon: Receipt, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/costs": { icon: BarChart3, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/reports": { icon: FileText, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/developer": { icon: KeyRound, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/warehouse": { icon: Warehouse, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/stock": { icon: Boxes, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/calendar": { icon: Calendar, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/planner": { icon: MapPinned, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/travel": { icon: Plane, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/activities": { icon: ListChecks, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/customers": { icon: Users, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/venues": { icon: Building2, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/suppliers": { icon: Truck, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/crew": { icon: HardHat, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/contractors": { icon: HardHat, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/serials": { icon: Boxes, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/templates": { icon: FileText, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/rentals/catalog": { icon: Package, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  "/reports": { icon: BarChart3, iconClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
};

const GUEST_FEATURE_LINKS = [
  { href: "/resources", label: "Resources", description: "Public shared files & links.", icon: FolderOpen, iconClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  { href: "/training-portal", label: "Training Portal", description: "Browse published courses (read-only).", icon: GraduationCap, iconClass: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  { href: "/support-guide", label: "Support Guide", description: "Hub how-to playbooks.", icon: LifeBuoy, iconClass: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
] as const;

const CTA_LINKS = [
  { href: "/event-packets", label: "Event Packets (complete after events)", icon: ClipboardCheck },
  { href: "/social-studio", label: "Social Studio (captions & exports)", icon: Megaphone },
  { href: "/submit-event-photos", label: "Submit Event Photos & Videos", icon: ImagePlus },
  { href: "/end-of-event-report", label: "End of Event Report", icon: ClipboardList },
] as const;

const featureHoverClass =
  "group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition-all duration-200 ease-out hover:-translate-y-1 hover:border-[var(--brand)]/35 hover:bg-[var(--brand-soft)]/30 hover:shadow-md";

const ctaHoverClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--brand)]/40 hover:bg-[var(--brand-soft)]/40 hover:text-[var(--brand)] hover:shadow-md active:translate-y-0";

/**
 * A unique color per shortcut, derived from its index in SHORTCUT_DEFS via the
 * golden angle so no two tiles repeat and any NEW tile added to the catalog
 * automatically gets its own distinct hue. Works on light and dark surfaces
 * (translucent tint background + a mid-lightness icon color).
 */
export function shortcutStyle(href: string): { backgroundColor: string; color: string } {
  const idx = SHORTCUT_DEFS.findIndex((d) => d.href === href);
  const hue = (((idx < 0 ? 0 : idx) * 137.508) % 360 + 360) % 360;
  return {
    backgroundColor: `hsl(${hue} 70% 55% / 0.16)`,
    color: `hsl(${hue} 62% 52%)`,
  };
}

function iconFor(href: string) {
  const entry = SHORTCUT_ICONS[href];
  return { icon: entry?.icon ?? Sparkles, style: shortcutStyle(href) };
}

export function HomeWelcome({
  fullName,
  profileId = "",
  email,
  weather,
  isAdmin = false,
  showCalendar = false,
  showVidentAv = false,
  showMarketing = false,
  showHandbook = false,
  pinnedHrefs = null,
  isGuest = false,
}: HomeWelcomeProps) {
  const [greeting] = useState(() => greetingForHour(new Date().getHours()));
  const [dateLabel] = useState(() =>
    new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
  );

  const access: ShortcutAccess = useMemo(
    () => ({
      isAdmin,
      showCalendar,
      showVidentAv,
      showMarketing,
      showHandbook,
    }),
    [
      isAdmin,
      showCalendar,
      showVidentAv,
      showMarketing,
      showHandbook,
    ],
  );

  const accessibleDefs = useMemo(
    () => SHORTCUT_DEFS.filter((d) => isShortcutAccessible(d.gate, access)),
    [access],
  );
  const accessibleSet = useMemo(
    () => new Set(accessibleDefs.map((d) => d.href)),
    [accessibleDefs],
  );

  const visibleHrefs = useMemo(() => {
    const chosen = pinnedHrefs ?? DEFAULT_SHORTCUT_HREFS;
    return chosen.filter((h) => accessibleSet.has(h));
  }, [pinnedHrefs, accessibleSet]);

  const holidayTheme = useHoliday();
  const holidayForce = useHolidayForcePopup();
  const holiday = isGuest ? null : holidayTheme;
  const firstName = isGuest ? "Guest" : firstNameFrom(fullName, email);
  const greetName = firstName;
  const wx = weather ? weatherDisplay(weather.weatherCode) : null;

  return (
    <section
      className={`overflow-hidden rounded-[var(--panel-radius)] border border-[var(--border)] bg-[var(--surface)] shadow-sm${holiday ? " hl-home" : ""}`}
    >
      {holiday ? (
        <HolidayPopup
          id={holiday.id}
          dateKey={holidayDateKeyNy()}
          force={holidayForce}
        />
      ) : null}
      <div
        className={`px-5 pt-8 pb-6 text-center sm:px-8${holiday ? " hl-hero" : ""}`}
      >
        <BrandLogo alt={COMPANY.displayName} className="mx-auto h-20 w-auto max-w-[16rem] object-contain" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
          {holiday ? holiday.greeting : COMPANY.hubTitle}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
          {holiday
            ? holiday.subline
            : isGuest
            ? "Read-only guest browse â confidential staff modules stay hidden."
            : COMPANY.hubSubtitle}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-[var(--border)] bg-[var(--surface-hover)] px-5 py-2.5 text-sm sm:px-8">
        <div className="min-w-0">
          <p className="text-[var(--foreground)]">
            <span className="font-medium">{greeting}, {greetName}</span>
            {dateLabel ? <span className="text-[var(--muted)]"> · {dateLabel}</span> : null}
          </p>
        </div>
        {weather && wx ? (
          <p className="inline-flex items-center gap-1.5 font-medium text-[var(--foreground)]" title={`${wx.label} in ${weather.label}`}>
            <span aria-hidden>{wx.emoji}</span>
            <span>{weather.tempF}°</span>
          </p>
        ) : null}
      </div>

      {isGuest ? (
        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          {GUEST_FEATURE_LINKS.map(({ href, label, description, icon: Icon, iconClass }) => (
            <Link key={href} href={href} className={featureHoverClass}>
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 ease-out group-hover:scale-110 ${iconClass}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="font-semibold text-[var(--foreground)]">{label}</p>
              <p className="mt-1 text-sm leading-snug text-[var(--muted)]">{description}</p>
            </Link>
          ))}
        </div>
      ) : (
        <ShortcutGrid
          visibleHrefs={visibleHrefs}
          accessibleDefs={accessibleDefs}
          pinnedHrefs={pinnedHrefs}
        />
      )}

      {!isGuest ? (
        <div className="grid gap-3 border-t border-[var(--border)] p-5 sm:grid-cols-2 sm:p-6">
          {CTA_LINKS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`group ${ctaHoverClass}`}>
              <Icon className="h-4 w-4 shrink-0 transition-transform duration-200 ease-out group-hover:scale-110" />
              {label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ShortcutGrid({
  visibleHrefs,
  accessibleDefs,
  pinnedHrefs,
}: {
  visibleHrefs: string[];
  accessibleDefs: typeof SHORTCUT_DEFS;
  pinnedHrefs: string[] | null;
}) {
  const [open, setOpen] = useState(false);
  const defByHref = useMemo(
    () => new Map(accessibleDefs.map((d) => [d.href, d])),
    [accessibleDefs],
  );

  return (
    <div className="p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        >
          <Pencil className="h-3.5 w-3.5" /> Customize
        </button>
      </div>
      {visibleHrefs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
          No shortcuts pinned. Click <span className="font-medium">Customize</span> to add some.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
          {visibleHrefs.map((href) => {
            const def = defByHref.get(href);
            if (!def) return null;
            const { icon: Icon, style } = iconFor(href);
            return (
              <Link
                key={href}
                href={href}
                title={def.description}
                className="group flex flex-col items-center gap-2 rounded-xl text-center"
              >
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-[1.1rem] border border-[var(--border)] transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:scale-105 group-hover:shadow-md"
                  style={style}
                >
                  <Icon className="h-7 w-7" />
                </span>
                <span className="text-xs leading-tight font-medium text-[var(--foreground)] group-hover:text-[var(--brand)]">
                  {def.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
      {open ? (
        <CustomizeModal
          accessibleDefs={accessibleDefs}
          pinnedHrefs={pinnedHrefs}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function CustomizeModal({
  accessibleDefs,
  pinnedHrefs,
  onClose,
}: {
  accessibleDefs: typeof SHORTCUT_DEFS;
  pinnedHrefs: string[] | null;
  onClose: () => void;
}) {
  const accessibleHrefs = useMemo(
    () => accessibleDefs.map((d) => d.href),
    [accessibleDefs],
  );
  const defByHref = useMemo(
    () => new Map(accessibleDefs.map((d) => [d.href, d])),
    [accessibleDefs],
  );

  const [order, setOrder] = useState<string[]>(() => {
    const base = pinnedHrefs ?? DEFAULT_SHORTCUT_HREFS;
    return base.filter((h) => accessibleHrefs.includes(h));
  });
  const [pending, startTransition] = useTransition();

  const unselected = accessibleDefs.filter((d) => !order.includes(d.href));

  function move(index: number, dir: -1 | 1) {
    setOrder((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function add(href: string) {
    setOrder((prev) => (prev.includes(href) ? prev : [...prev, href]));
  }
  function remove(href: string) {
    setOrder((prev) => prev.filter((h) => h !== href));
  }

  function save() {
    startTransition(async () => {
      await saveShortcutsAction(order);
      onClose();
      window.location.reload();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Customize shortcuts</h2>
          <button type="button" onClick={onClose} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">Close</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            On your Home ({order.length})
          </p>
          {order.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">Nothing pinned yet — add some below.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {order.map((href, i) => {
                const d = defByHref.get(href);
                if (!d) return null;
                return (
                  <li key={href} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[var(--foreground)]">{d.label}</span>
                    </span>
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-30">↑</button>
                    <button type="button" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-30">↓</button>
                    <button type="button" onClick={() => remove(href)} aria-label="Remove" className="inline-flex h-7 items-center rounded-md px-2 text-xs text-[var(--muted)] hover:text-red-600">Remove</button>
                  </li>
                );
              })}
            </ul>
          )}

          {unselected.length > 0 ? (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Add more</p>
              <ul className="mt-2 space-y-1.5">
                {unselected.map((d) => (
                  <li key={d.href} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[var(--foreground)]">{d.label}</span>
                      <span className="block text-xs text-[var(--muted)]">{d.description}</span>
                    </span>
                    <button type="button" onClick={() => add(d.href)} className="inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--brand)] hover:bg-[var(--brand-soft)]">+ Add</button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-5 py-3">
          <button
            type="button"
            onClick={() => setOrder(DEFAULT_SHORTCUT_HREFS.filter((h) => accessibleHrefs.includes(h)))}
            className="text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Reset to default
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)]">Cancel</button>
            <button type="button" disabled={pending} onClick={save} className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
