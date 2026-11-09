import type { Department, UserRole } from "@/lib/types/database";

export type OnboardingResource = {
  id: string;
  slug: string;
  title: string;
  description: string;
  url: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  /**
   * Empty = no department affinity (admins only see these unless adminOnly).
   * Otherwise viewers must share at least one department.
   */
  departments: Department[];
  /** When true, only admins see the card (interview docs). */
  adminOnly: boolean;
};

/** Vident company Drive — paste Form/Sheet/Doc links from here onto each card. */
export const VIDENT_ONBOARDING_DRIVE_URL =
  "https://drive.google.com/drive/folders/1m3XSbIg6_3_GN431KH2Iw7hjQsr_VgWF";

/** Canonical new-hire form cards (fallback if onboarding_resources is empty). */
export const DEFAULT_ONBOARDING_RESOURCES: Omit<
  OnboardingResource,
  "id" | "created_at" | "updated_at"
>[] = [
  {
    slug: "corporate-onboarding-form",
    title: "Corporate Onboarding Form",
    description: "Complete the Corporate team onboarding form",
    url: "",
    sort_order: 10,
    departments: ["Corporate"],
    adminOnly: false,
  },
  {
    slug: "wedding-social-onboarding-form",
    title: "Weddings & Social Onboarding Form",
    description: "Complete the Weddings & Social team onboarding form",
    url: "",
    sort_order: 20,
    departments: ["Wedding & Social"],
    adminOnly: false,
  },
  {
    slug: "golf-onboarding-form",
    title: "Golf Onboarding Form",
    description: "Complete the Golf team onboarding form",
    url: "",
    sort_order: 30,
    departments: ["Golf"],
    adminOnly: false,
  },
  {
    slug: "av-onboarding-form",
    title: "AV Onboarding Form",
    description: "Complete the AV team onboarding form",
    url: "",
    sort_order: 40,
    departments: ["Audiovisual"],
    adminOnly: false,
  },
  {
    slug: "office-onboarding-form",
    title: "Office Onboarding Form",
    description: "Complete the Office new hire onboarding form",
    url: "",
    sort_order: 50,
    departments: ["Office"],
    adminOnly: false,
  },
  {
    slug: "av-interview-questions",
    title: "Interview Questions - AV",
    description: "AV interview questions document",
    url: "",
    sort_order: 60,
    departments: ["Audiovisual"],
    adminOnly: true,
  },
];

const SLUG_DEPARTMENTS: Record<string, Department[]> = Object.fromEntries(
  DEFAULT_ONBOARDING_RESOURCES.map((r) => [r.slug, r.departments]),
);

const SLUG_ADMIN_ONLY: Record<string, boolean> = Object.fromEntries(
  DEFAULT_ONBOARDING_RESOURCES.map((r) => [r.slug, r.adminOnly]),
);

/** Infer departments from slug when the DB row has no departments column. */
export function departmentsForOnboardingSlug(slug: string): Department[] {
  if (SLUG_DEPARTMENTS[slug]) return SLUG_DEPARTMENTS[slug];
  const lower = slug.toLowerCase();
  if (
    lower.includes("audiovisual") ||
    lower.startsWith("av-") ||
    lower.includes("-av")
  ) {
    return ["Audiovisual"];
  }
  if (lower.includes("corporate")) return ["Corporate"];
  if (lower.includes("wedding") || lower.includes("social"))
    return ["Wedding & Social"];
  if (lower.includes("golf")) return ["Golf"];
  if (lower.includes("office")) return ["Office"];
  return [];
}

/** Interview docs are admin-facing only. */
export function isAdminOnlyOnboardingSlug(slug: string): boolean {
  if (SLUG_ADMIN_ONLY[slug] != null) return SLUG_ADMIN_ONLY[slug];
  const lower = slug.toLowerCase();
  if (lower.includes("interview") || lower.includes("question")) return true;
  return false;
}

export function withOnboardingMeta(
  resource: Omit<OnboardingResource, "departments" | "adminOnly"> & {
    departments?: Department[] | null;
    adminOnly?: boolean | null;
  },
): OnboardingResource {
  return {
    ...resource,
    departments:
      resource.departments && resource.departments.length > 0
        ? resource.departments
        : departmentsForOnboardingSlug(resource.slug),
    adminOnly:
      typeof resource.adminOnly === "boolean"
        ? resource.adminOnly
        : isAdminOnlyOnboardingSlug(resource.slug),
  };
}

export function hasOnboardingUrl(resource: Pick<OnboardingResource, "url">): boolean {
  return Boolean(resource.url?.trim());
}

function matchesViewerDepartments(
  resource: OnboardingResource,
  viewerDepartments: Department[],
): boolean {
  if (resource.departments.length === 0) return false;
  return resource.departments.some((dept) => viewerDepartments.includes(dept));
}

/**
 * Admins see every card (including unset URLs so they can paste links).
 * Staff and trainers only see non-admin cards that already have a URL and
 * match at least one of their assigned departments.
 * Admin-only cards (AV interview questions) are hidden from everyone except admins.
 */
export function filterOnboardingForViewer(
  resources: OnboardingResource[],
  viewer: { role: UserRole; departments: Department[] },
): OnboardingResource[] {
  if (viewer.role === "admin") {
    return resources;
  }

  return resources.filter((resource) => {
    if (resource.adminOnly) return false;
    if (!hasOnboardingUrl(resource)) return false;
    return matchesViewerDepartments(resource, viewer.departments);
  });
}
