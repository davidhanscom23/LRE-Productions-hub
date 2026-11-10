import { type LucideIcon, Speaker } from "lucide-react";
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
};

/** Fallback Event Planning Platforms when no admin-managed department_links exist. */
export const DEFAULT_PLANNING_LINKS: Record<
  TeamDepartment,
  { title: string; url: string; description: string }[]
> = {
  Audiovisual: [
    {
      title: "LRE AV",
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
};

/** Button accent colors for planning platform CTAs (cycles by index). */
export const PLANNING_BUTTON_STYLES = [
  "bg-[var(--brand)] hover:opacity-90",
  "bg-[#3f3f46] hover:opacity-90 dark:bg-[#52525b]",
  "bg-[#52525b] hover:opacity-90",
  "bg-[#27272a] hover:opacity-90",
] as const;

export const TRAINING_PORTAL_HREF = "/training-portal";

/**
 * The AV Fundamental Resource Guide renders with the global var(--brand) /
 * var(--brand-soft) tokens. This className pins them to the LRE hub colors
 * for everything nested inside, in both light and dark mode.
 */
export const AV_GUIDE_BRAND_VARS =
  "[--brand:#b01418] [--brand-soft:#fbeaea] dark:[--brand:#e0393e] dark:[--brand-soft:#3a1517]";
