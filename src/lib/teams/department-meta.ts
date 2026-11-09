import {
  Building2,
  Flag,
  Heart,
  type LucideIcon,
  Speaker,
} from "lucide-react";
import type { TeamDepartment } from "@/lib/types/teams";

export const DEPARTMENT_META: Record<
  TeamDepartment,
  {
    label: string;
    blurb: string;
    icon: LucideIcon;
  }
> = {
  Audiovisual: {
    label: "Audiovisual",
    blurb: "AV and event production resources, training, and tools.",
    icon: Speaker,
  },
  Corporate: {
    label: "Corporate",
    blurb: "Resources, training, and tools for corporate events.",
    icon: Building2,
  },
  "Wedding & Social": {
    label: "Wedding & Social",
    blurb: "Resources, training, and tools for weddings and social events.",
    icon: Heart,
  },
  Golf: {
    label: "Golf",
    blurb: "Resources, training, and tools for golf events.",
    icon: Flag,
  },
};

/** Fallback Event Planning Platforms when no admin-managed department_links exist. */
export const DEFAULT_PLANNING_LINKS: Record<
  TeamDepartment,
  { title: string; url: string; description: string }[]
> = {
  Audiovisual: [
    {
      title: "Vident AV",
      url: "/rentals",
      description: "Gear quotes, warehouse, invoices, and crew.",
    },
    {
      title: "AV Show Control",
      url: "/av-show",
      description: "Screens and lower thirds for live shows.",
    },
    {
      title: "AV Event Portals",
      url: "/av-portals",
      description: "Client planning checklists before load-in.",
    },
  ],
  Corporate: [
    {
      title: "Quoting",
      url: "/quoting",
      description: "Corporate service quotes (non-rental) with pricing notes.",
    },
    {
      title: "Vident AV",
      url: "/rentals",
      description: "Rental gear quotes, warehouse, and invoices for AV shows.",
    },
    {
      title: "AV Event Portals",
      url: "/av-portals",
      description: "Client show-day checklist link (floor plan, run of show, files).",
    },
    {
      title: "AV Show Control",
      url: "/av-show",
      description: "Launch screens and lower thirds on show day.",
    },
    {
      title: "Venue Quotes",
      url: "/venue-quotes",
      description: "Public instant-quote portals (Hyatt / starter catalogs).",
    },
    {
      title: "Calendar",
      url: "/calendar",
      description: "Shared company schedule and CRM project dates.",
    },
  ],
  "Wedding & Social": [
    {
      title: "Event Packets",
      url: "/event-packets",
      description: "Day-of notes, media, and post-event completion.",
    },
    {
      title: "Calendar",
      url: "/calendar",
      description: "Shared wedding and social schedule from the company feed.",
    },
    {
      title: "Quoting",
      url: "/quoting",
      description: "Wedding & Social estimates with department pricing notes.",
    },
    {
      title: "My Week",
      url: "/my-week",
      description: "Your Hub tasks plus HoneyBook tasks assigned to you.",
    },
    {
      title: "Support Guide",
      url: "/support-guide",
      description: "Hub how-tos for packets, calendar, and field tools.",
    },
  ],
  Golf: [],
};

/** Button accent colors for planning platform CTAs (cycles by index). */
export const PLANNING_BUTTON_STYLES = [
  "bg-[var(--brand)] hover:opacity-90",
  "bg-[#3f3f46] hover:opacity-90 dark:bg-[#52525b]",
  "bg-[#52525b] hover:opacity-90",
  "bg-[#27272a] hover:opacity-90",
] as const;

export const TRAINING_PORTAL_HREF = "/training-portal";
