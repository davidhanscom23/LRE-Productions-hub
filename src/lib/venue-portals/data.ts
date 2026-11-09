import "server-only";

import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import type { PriceUnit } from "@/lib/venue-portals/pricing";
import type { PortalBundle } from "@/lib/venue-portals/types";

type Row = Record<string, unknown>;

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) =>
  typeof v === "string" && v.trim() ? v : null;
const hhmm = (v: unknown, fallback: string) =>
  typeof v === "string" && /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : fallback;

export type LoadedPortal = {
  bundle: PortalBundle;
  /** Server-only: where quote notifications go. Never sent to the browser. */
  notifyEmail: string | null;
  /** Server-only: true when a coordinator password protects the savings. */
  hasCoordinatorPassword: boolean;
  /** Server-only: stored password hash (never sent to the browser). */
  coordinatorPasswordHash: string | null;
};

/**
 * Copy of the bundle that is safe to send to the browser: the venue savings
 * are removed so clients can't see them in the page. Coordinators receive the
 * savings only after entering the venue password.
 */
export function scrubSavings(bundle: PortalBundle): PortalBundle {
  return {
    ...bundle,
    portal: {
      ...bundle.portal,
      rates: { ...bundle.portal.rates, savingsPct: 0, savingsLabel: "" },
    },
  };
}

/**
 * Loads one portal with all its active catalog rows via the service-role
 * client (there are no anon RLS policies on purpose). Unpublished portals are
 * only returned when the caller explicitly opts in (admin preview).
 */
export async function loadPortalBundle(
  slug: string,
  opts: { includeUnpublished?: boolean } = {},
): Promise<LoadedPortal | null> {
  if (!isServiceRoleConfigured()) return null;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;

  const db = createServiceClient();
  const { data: p } = await db
    .from("venue_portals")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!p) return null;
  const portal = p as Row;
  if (!portal.is_published && !opts.includeUnpublished) return null;

  const portalId = String(portal.id);
  const [spacesRes, packagesRes, addonsRes, enhRes] = await Promise.all([
    db.from("venue_portal_spaces").select("*").eq("portal_id", portalId)
      .eq("is_active", true).order("sort_order").order("name"),
    db.from("venue_portal_packages").select("*").eq("portal_id", portalId)
      .eq("is_active", true).order("sort_order").order("name"),
    db.from("venue_portal_addons").select("*").eq("portal_id", portalId)
      .eq("is_active", true).order("sort_order").order("name"),
    db.from("venue_portal_enhancements").select("*").eq("portal_id", portalId)
      .eq("is_active", true).order("sort_order").order("name"),
  ]);

  const packageRows = (packagesRes.data ?? []) as Row[];
  const packageIds = packageRows.map((r) => String(r.id));
  const itemsByPackage = new Map<string, string[]>();
  if (packageIds.length > 0) {
    const { data: items } = await db
      .from("venue_portal_package_items")
      .select("package_id,label,sort_order")
      .in("package_id", packageIds)
      .order("sort_order");
    for (const it of (items ?? []) as Row[]) {
      const k = String(it.package_id);
      const list = itemsByPackage.get(k) ?? [];
      list.push(str(it.label));
      itemsByPackage.set(k, list);
    }
  }

  // Technician roles (migration 137). Missing tables => legacy single-rate behavior.
  const technicianRows: Row[] = [];
  const techIdsByPackage = new Map<string, string[]>();
  const techRes = await db
    .from("venue_portal_technicians")
    .select("*")
    .eq("portal_id", portalId)
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (!techRes.error) {
    technicianRows.push(...((techRes.data ?? []) as Row[]));
    if (packageIds.length > 0) {
      const { data: links } = await db
        .from("venue_portal_package_technicians")
        .select("package_id,technician_id")
        .in("package_id", packageIds);
      for (const l of (links ?? []) as Row[]) {
        const k = String(l.package_id);
        const list = techIdsByPackage.get(k) ?? [];
        list.push(String(l.technician_id));
        techIdsByPackage.set(k, list);
      }
    }
  }
  const activeTechIds = new Set(technicianRows.map((r) => String(r.id)));

  const bundle: PortalBundle = {
    portal: {
      id: portalId,
      slug: str(portal.slug),
      name: str(portal.name),
      headline: str(portal.headline) || "Build your AV package",
      intro: str(portal.intro),
      heroImageUrl: strOrNull(portal.hero_image_url),
      logoUrl: strOrNull(portal.logo_url),
      accentColor: /^#[0-9a-fA-F]{6}$/.test(str(portal.accent_color))
        ? str(portal.accent_color)
        : "#b08a4a",
      eventTypes: Array.isArray(portal.event_types)
        ? (portal.event_types as unknown[]).map(String)
        : [],
      defaultStartTime: hhmm(portal.default_start_time, "18:00"),
      defaultEndTime: hhmm(portal.default_end_time, "22:00"),
      isPublished: Boolean(portal.is_published),
      depositPct: Math.min(100, Math.max(0, num(portal.deposit_pct) || 50)),
      rates: {
        deliveryFee: num(portal.delivery_fee),
        techHourlyRate: num(portal.tech_hourly_rate),
        savingsPct: num(portal.savings_pct),
        savingsLabel: str(portal.savings_label) || "Savings",
      },
    },
    spaces: ((spacesRes.data ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      name: str(r.name),
      imageUrl: strOrNull(r.image_url),
      capacity: r.capacity == null ? null : num(r.capacity),
      isCustomQuote: Boolean(r.is_custom_quote),
    })),
    packages: packageRows.map((r) => ({
      id: String(r.id),
      name: str(r.name),
      tagline: str(r.tagline),
      price: num(r.price),
      setupFee: num(r.setup_fee),
      includesTechnician: Boolean(r.includes_technician),
      technicianIds: (techIdsByPackage.get(String(r.id)) ?? []).filter((id) =>
        activeTechIds.has(id),
      ),
      isPopular: Boolean(r.is_popular),
      items: itemsByPackage.get(String(r.id)) ?? [],
    })),
    technicians: technicianRows.map((r) => ({
      id: String(r.id),
      name: str(r.name),
      rateType: str(r.rate_type) === "daily" ? "daily" : "hourly",
      rate: num(r.rate),
    })),
    addons: ((addonsRes.data ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      name: str(r.name),
      description: str(r.description),
      imageUrl: strOrNull(r.image_url),
      unitPrice: num(r.unit_price),
      priceUnit: (["each", "flat", "hour"].includes(str(r.price_unit))
        ? str(r.price_unit)
        : "each") as PriceUnit,
      minQuantity: num(r.min_quantity),
      maxQuantity: r.max_quantity == null ? null : num(r.max_quantity),
      isOrderable: r.is_orderable !== false,
      note: str(r.note),
    })),
    enhancements: ((enhRes.data ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      name: str(r.name),
      description: str(r.description),
      imageUrl: strOrNull(r.image_url),
    })),
  };

  // Coordinator password lives in its own admin-only table (migration 138).
  const { data: secret } = await db
    .from("venue_portal_secrets")
    .select("coordinator_password_hash")
    .eq("portal_id", portalId)
    .maybeSingle();
  const coordinatorPasswordHash = strOrNull(
    (secret as Row | null)?.coordinator_password_hash,
  );

  return {
    bundle,
    notifyEmail: strOrNull(portal.notify_email),
    hasCoordinatorPassword: coordinatorPasswordHash !== null,
    coordinatorPasswordHash,
  };
}
