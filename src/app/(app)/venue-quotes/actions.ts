"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { datetimeLocalEasternToIso } from "@/lib/av-erp/datetime";
import { createClient } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/venue-portals/access";
import {
  STARTER_ADDON_MAP_BY_NAME,
  STARTER_PACKAGE_PRODUCT_BY_NAME,
} from "@/lib/venue-portals/catalog-map";
import {
  eventDaysToGearLocalBounds,
  venueSelectionToOpportunityLines,
  venueTotalsToOpportunityLines,
} from "@/lib/venue-portals/convert-to-opportunity";
import type { SpaceSelection } from "@/lib/venue-portals/pricing";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type ChildTable =
  | "venue_portal_spaces"
  | "venue_portal_packages"
  | "venue_portal_addons"
  | "venue_portal_enhancements"
  | "venue_portal_technicians";

const CHILD_TABLES: ChildTable[] = [
  "venue_portal_spaces",
  "venue_portal_packages",
  "venue_portal_addons",
  "venue_portal_enhancements",
  "venue_portal_technicians",
];

async function admin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;
  return { supabase: await createClient(), profile };
}

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

function refresh(id?: string) {
  revalidatePath("/venue-quotes");
  if (id) revalidatePath(`/venue-quotes/${id}`);
}

function cleanSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugError(slug: string): string | null {
  if (slug.length < 3 || slug.length > 80 || !SLUG_RE.test(slug)) {
    return "Link name must be 3–80 characters: lowercase letters, numbers and dashes.";
  }
  return null;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function createPortalAction(input: {
  name: string;
  slug: string;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await admin();
  if (!ctx) return fail("Admins only.");
  const name = input.name.trim();
  const slug = cleanSlug(input.slug || input.name);
  if (!name) return fail("Venue name is required.");
  const se = slugError(slug);
  if (se) return fail(se);
  const { data, error } = await ctx.supabase
    .from("venue_portals")
    .insert({ name, slug, created_by: ctx.profile.id })
    .select("id")
    .single();
  if (error) {
    return fail(
      error.code === "23505"
        ? "That link name is already used by another venue."
        : error.message,
    );
  }
  refresh();
  return { ok: true, data: { id: data.id as string } };
}

export async function duplicatePortalAction(input: {
  sourceId: string;
  name: string;
  slug: string;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await admin();
  if (!ctx) return fail("Admins only.");
  const { supabase, profile } = ctx;
  const name = input.name.trim();
  const slug = cleanSlug(input.slug || input.name);
  if (!name) return fail("Venue name is required.");
  const se = slugError(slug);
  if (se) return fail(se);

  const { data: src, error: srcErr } = await supabase
    .from("venue_portals")
    .select("*")
    .eq("id", input.sourceId)
    .single();
  if (srcErr || !src) return fail("Source venue not found.");

  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    created_by: _cb,
    ...rest
  } = src as Record<string, unknown>;
  void _id; void _c; void _u; void _cb;
  const { data: created, error } = await supabase
    .from("venue_portals")
    .insert({ ...rest, name, slug, is_published: false, created_by: profile.id })
    .select("id")
    .single();
  if (error || !created) {
    return fail(
      error?.code === "23505"
        ? "That link name is already used by another venue."
        : (error?.message ?? "Could not duplicate."),
    );
  }
  const newId = created.id as string;

  const strip = (r: Record<string, unknown>) => {
    const { id: _i, created_at: _a, updated_at: _b, ...o } = r;
    void _i; void _a; void _b;
    return o;
  };

  for (const table of [
    "venue_portal_spaces",
    "venue_portal_addons",
    "venue_portal_enhancements",
  ] as const) {
    const { data: rows } = await supabase
      .from(table)
      .select("*")
      .eq("portal_id", input.sourceId);
    if (rows?.length) {
      await supabase
        .from(table)
        .insert(rows.map((r) => ({ ...strip(r), portal_id: newId })));
    }
  }

  const techIdMap = new Map<string, string>();
  const { data: techs } = await supabase
    .from("venue_portal_technicians")
    .select("*")
    .eq("portal_id", input.sourceId);
  for (const t of techs ?? []) {
    const { data: nt } = await supabase
      .from("venue_portal_technicians")
      .insert({ ...strip(t), portal_id: newId })
      .select("id")
      .single();
    if (nt) techIdMap.set(t.id as string, nt.id as string);
  }

  const { data: pkgs } = await supabase
    .from("venue_portal_packages")
    .select("*")
    .eq("portal_id", input.sourceId);
  for (const p of pkgs ?? []) {
    const { data: np } = await supabase
      .from("venue_portal_packages")
      .insert({ ...strip(p), portal_id: newId })
      .select("id")
      .single();
    if (!np) continue;
    const { data: items } = await supabase
      .from("venue_portal_package_items")
      .select("label, sort_order")
      .eq("package_id", p.id);
    const { data: links } = await supabase
      .from("venue_portal_package_technicians")
      .select("technician_id")
      .eq("package_id", p.id);
    const linkRows = (links ?? [])
      .map((l) => techIdMap.get(l.technician_id as string))
      .filter((x): x is string => !!x)
      .map((technician_id) => ({ package_id: np.id, technician_id }));
    if (linkRows.length) {
      await supabase.from("venue_portal_package_technicians").insert(linkRows);
    }
    if (items?.length) {
      await supabase
        .from("venue_portal_package_items")
        .insert(items.map((i) => ({ ...i, package_id: np.id })));
    }
  }

  refresh();
  return { ok: true, data: { id: newId } };
}

export type PortalFields = {
  name: string;
  slug: string;
  headline: string;
  intro: string;
  hero_image_url: string | null;
  logo_url: string | null;
  accent_color: string;
  event_types: string[];
  default_start_time: string;
  default_end_time: string;
  delivery_fee: number;
  tech_hourly_rate: number;
  savings_label: string;
  savings_pct: number;
  deposit_pct: number;
  notify_email: string;
  /** Blank = leave unchanged. */
  coordinator_password?: string;
  clear_coordinator_password?: boolean;
};

export async function savePortalAction(
  id: string,
  f: PortalFields,
): Promise<ActionResult> {
  const ctx = await admin();
  if (!ctx) return fail("Admins only.");
  const slug = cleanSlug(f.slug);
  const se = slugError(slug);
  if (se) return fail(se);
  if (!f.name.trim()) return fail("Venue name is required.");
  if (!/^#[0-9a-fA-F]{6}$/.test(f.accent_color)) {
    return fail("Accent color must look like #b08a4a.");
  }
  if (f.notify_email.trim() && !/^\S+@\S+\.\S+$/.test(f.notify_email.trim())) {
    return fail("Notification email doesn't look right.");
  }
  const pct = Math.min(100, Math.max(0, num(f.savings_pct)));
  const depositPct = Math.min(100, Math.max(0, num(f.deposit_pct)));
  const { error } = await ctx.supabase
    .from("venue_portals")
    .update({
      name: f.name.trim(),
      slug,
      headline: f.headline.trim(),
      intro: f.intro.trim(),
      hero_image_url: f.hero_image_url || null,
      logo_url: f.logo_url || null,
      accent_color: f.accent_color,
      event_types: f.event_types.map((e) => e.trim()).filter(Boolean),
      default_start_time: f.default_start_time,
      default_end_time: f.default_end_time,
      delivery_fee: Math.max(0, num(f.delivery_fee)),
      tech_hourly_rate: Math.max(0, num(f.tech_hourly_rate)),
      savings_label: f.savings_label.trim(),
      savings_pct: pct,
      deposit_pct: depositPct,
      notify_email: f.notify_email.trim() || null,
    })
    .eq("id", id);
  if (error) {
    return fail(
      error.code === "23505" ? "That link name is already in use." : error.message,
    );
  }

  const newPassword = (f.coordinator_password ?? "").trim();
  if (f.clear_coordinator_password) {
    await ctx.supabase.from("venue_portal_secrets").delete().eq("portal_id", id);
  } else if (newPassword) {
    if (newPassword.length < 6) {
      return fail("Coordinator password must be at least 6 characters (other changes were saved).");
    }
    const { error: pwErr } = await ctx.supabase
      .from("venue_portal_secrets")
      .upsert(
        {
          portal_id: id,
          coordinator_password_hash: hashPassword(newPassword),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "portal_id" },
      );
    if (pwErr) {
      return fail(
        pwErr.message.includes("venue_portal_secrets")
          ? "Run migration 138 in Supabase to enable coordinator passwords (other changes were saved)."
          : pwErr.message,
      );
    }
  }
  refresh(id);
  return { ok: true };
}

export async function setPublishedAction(
  id: string,
  published: boolean,
): Promise<ActionResult> {
  const ctx = await admin();
  if (!ctx) return fail("Admins only.");
  const { error } = await ctx.supabase
    .from("venue_portals")
    .update({ is_published: published })
    .eq("id", id);
  if (error) return fail(error.message);
  refresh(id);
  return { ok: true };
}

export async function deletePortalAction(id: string): Promise<ActionResult> {
  const ctx = await admin();
  if (!ctx) return fail("Admins only.");
  const { count } = await ctx.supabase
    .from("venue_portal_quote_requests")
    .select("id", { count: "exact", head: true })
    .eq("portal_id", id);
  if ((count ?? 0) > 0) {
    return fail(
      "This venue has quote requests. Unpublish it instead (requests are kept for your records).",
    );
  }
  const { error } = await ctx.supabase.from("venue_portals").delete().eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

/* ---------------- children ---------------- */

export type SpaceInput = {
  id?: string;
  name: string;
  image_url: string | null;
  capacity: number | null;
  is_custom_quote: boolean;
  is_active: boolean;
};
export type PackageInput = {
  id?: string;
  name: string;
  tagline: string;
  price: number;
  setup_fee: number;
  includes_technician: boolean;
  is_popular: boolean;
  is_active: boolean;
  items: string[];
  technician_ids: string[];
  /** Hub catalog product (preferred) or service when converting. */
  av_product_id?: string | null;
  av_service_id?: string | null;
};
export type TechnicianInput = {
  id?: string;
  name: string;
  rate_type: "hourly" | "daily";
  rate: number;
  is_active: boolean;
};
export type AddonInput = {
  id?: string;
  name: string;
  description: string;
  image_url: string | null;
  unit_price: number;
  price_unit: "each" | "flat" | "hour";
  min_quantity: number;
  max_quantity: number | null;
  is_orderable: boolean;
  note: string;
  is_active: boolean;
  av_product_id?: string | null;
  av_service_id?: string | null;
};
export type EnhancementInput = {
  id?: string;
  name: string;
  description: string;
  image_url: string | null;
  is_active: boolean;
};

async function nextSort(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: ChildTable,
  portalId: string,
): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select("sort_order")
    .eq("portal_id", portalId)
    .order("sort_order", { ascending: false })
    .limit(1);
  return ((data?.[0]?.sort_order as number | undefined) ?? 0) + 10;
}

async function upsertChild(
  table: ChildTable,
  portalId: string,
  id: string | undefined,
  values: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await admin();
  if (!ctx) return fail("Admins only.");
  if (!String(values.name ?? "").trim()) return fail("Name is required.");
  if (id) {
    const { error } = await ctx.supabase.from(table).update(values).eq("id", id);
    if (error) return fail(error.message);
    refresh(portalId);
    return { ok: true, data: { id } };
  }
  const sort_order = await nextSort(ctx.supabase, table, portalId);
  const { data, error } = await ctx.supabase
    .from(table)
    .insert({ ...values, portal_id: portalId, sort_order })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Could not save.");
  refresh(portalId);
  return { ok: true, data: { id: data.id as string } };
}

export async function saveSpaceAction(portalId: string, s: SpaceInput) {
  return upsertChild("venue_portal_spaces", portalId, s.id, {
    name: s.name.trim(),
    image_url: s.image_url || null,
    capacity: s.capacity == null ? null : Math.max(0, Math.round(num(s.capacity))),
    is_custom_quote: s.is_custom_quote,
    is_active: s.is_active,
  });
}

export async function saveEnhancementAction(portalId: string, e: EnhancementInput) {
  return upsertChild("venue_portal_enhancements", portalId, e.id, {
    name: e.name.trim(),
    description: e.description.trim(),
    image_url: e.image_url || null,
    is_active: e.is_active,
  });
}

function catalogFkPair(productId?: string | null, serviceId?: string | null) {
  const av_product_id = productId?.trim() || null;
  const av_service_id = av_product_id ? null : serviceId?.trim() || null;
  return { av_product_id, av_service_id };
}

export async function saveAddonAction(portalId: string, a: AddonInput) {
  if (!["each", "flat", "hour"].includes(a.price_unit)) return fail("Bad price unit.");
  const catalog = catalogFkPair(a.av_product_id, a.av_service_id);
  return upsertChild("venue_portal_addons", portalId, a.id, {
    name: a.name.trim(),
    description: a.description.trim(),
    image_url: a.image_url || null,
    unit_price: Math.max(0, num(a.unit_price)),
    price_unit: a.price_unit,
    min_quantity: Math.max(0, Math.round(num(a.min_quantity))),
    max_quantity:
      a.max_quantity == null ? null : Math.max(1, Math.round(num(a.max_quantity))),
    is_orderable: a.is_orderable,
    note: a.note.trim(),
    is_active: a.is_active,
    ...catalog,
  });
}

export async function savePackageAction(portalId: string, p: PackageInput) {
  const catalog = catalogFkPair(p.av_product_id, p.av_service_id);
  const res = await upsertChild("venue_portal_packages", portalId, p.id, {
    name: p.name.trim(),
    tagline: p.tagline.trim(),
    price: Math.max(0, num(p.price)),
    setup_fee: Math.max(0, num(p.setup_fee)),
    includes_technician: p.technician_ids.length > 0 || p.includes_technician,
    is_popular: p.is_popular,
    is_active: p.is_active,
    ...catalog,
  });
  if (!res.ok || !res.data) return res;
  const ctx = await admin();
  if (!ctx) return fail("Admins only.");
  const pkgId = res.data.id;
  await ctx.supabase.from("venue_portal_package_items").delete().eq("package_id", pkgId);
  const labels = p.items.map((i) => i.trim()).filter(Boolean);
  if (labels.length) {
    const { error } = await ctx.supabase
      .from("venue_portal_package_items")
      .insert(labels.map((label, i) => ({ package_id: pkgId, label, sort_order: (i + 1) * 10 })));
    if (error) return fail(error.message);
  }
  await ctx.supabase.from("venue_portal_package_technicians").delete().eq("package_id", pkgId);
  if (p.technician_ids.length) {
    const { error } = await ctx.supabase
      .from("venue_portal_package_technicians")
      .insert(p.technician_ids.map((technician_id) => ({ package_id: pkgId, technician_id })));
    if (error) return fail(error.message);
  }
  refresh(portalId);
  return res;
}

export async function saveTechnicianAction(portalId: string, t: TechnicianInput) {
  if (!["hourly", "daily"].includes(t.rate_type)) return fail("Bad rate type.");
  return upsertChild("venue_portal_technicians", portalId, t.id, {
    name: t.name.trim(),
    rate_type: t.rate_type,
    rate: Math.max(0, num(t.rate)),
    is_active: t.is_active,
  });
}

export async function deleteChildAction(
  table: ChildTable,
  portalId: string,
  id: string,
): Promise<ActionResult> {
  const ctx = await admin();
  if (!ctx) return fail("Admins only.");
  if (!CHILD_TABLES.includes(table)) return fail("Bad table.");
  const { error } = await ctx.supabase.from(table).delete().eq("id", id).eq("portal_id", portalId);
  if (error) return fail(error.message);
  refresh(portalId);
  return { ok: true };
}

export async function moveChildAction(
  table: ChildTable,
  portalId: string,
  id: string,
  dir: "up" | "down",
): Promise<ActionResult> {
  const ctx = await admin();
  if (!ctx) return fail("Admins only.");
  if (!CHILD_TABLES.includes(table)) return fail("Bad table.");
  const { data } = await ctx.supabase
    .from(table)
    .select("id, sort_order")
    .eq("portal_id", portalId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as { id: string; sort_order: number }[];
  const i = rows.findIndex((r) => r.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return { ok: true };
  const order = rows.map((r) => r.id);
  [order[i], order[j]] = [order[j], order[i]];
  for (let k = 0; k < order.length; k++) {
    await ctx.supabase.from(table).update({ sort_order: (k + 1) * 10 }).eq("id", order[k]);
  }
  refresh(portalId);
  return { ok: true };
}

export async function updateRequestStatusAction(
  id: string,
  status: string,
): Promise<ActionResult> {
  const ctx = await admin();
  if (!ctx) return fail("Admins only.");
  if (!["new", "contacted", "quoted", "booked", "lost"].includes(status)) {
    return fail("Bad status.");
  }
  const { error } = await ctx.supabase
    .from("venue_portal_quote_requests")
    .update({ status })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/venue-quotes/requests");
  return { ok: true };
}

export async function deleteRequestAction(id: string): Promise<ActionResult> {
  const ctx = await admin();
  if (!ctx) return fail("Admins only.");
  const { error } = await ctx.supabase
    .from("venue_portal_quote_requests")
    .delete()
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/venue-quotes/requests");
  revalidatePath("/venue-quotes");
  return { ok: true };
}

/** One-click: venue request → draft Hub AV quote with free-text lines. */
export async function convertVenueRequestToOpportunityAction(
  requestId: string,
): Promise<ActionResult<{ opportunityId: string }>> {
  const ctx = await admin();
  if (!ctx) return fail("Admins only.");
  if (!requestId) return fail("Missing request.");

  const { data: req, error: reqErr } = await ctx.supabase
    .from("venue_portal_quote_requests")
    .select("*, venue_portals ( name, slug )")
    .eq("id", requestId)
    .maybeSingle();
  if (reqErr || !req) return fail(reqErr?.message ?? "Request not found.");
  if (req.opportunity_id) {
    return {
      ok: true,
      data: { opportunityId: req.opportunity_id as string },
    };
  }

  const portal = req.venue_portals as
    | { name?: string; slug?: string }
    | { name?: string; slug?: string }[]
    | null;
  const portalRow = Array.isArray(portal) ? portal[0] : portal;
  const venueName = portalRow?.name || "Venue";

  const clientName =
    `${req.client_first ?? ""} ${req.client_last ?? ""}`.trim() ||
    `${req.contact_first ?? ""} ${req.contact_last ?? ""}`.trim() ||
    "Venue quote client";
  const clientEmail = String(
    req.client_email || req.contact_email || "",
  )
    .trim()
    .toLowerCase();
  const clientPhone = String(req.client_phone || req.contact_phone || "").trim();

  let customerId: string | null = null;
  if (clientEmail.includes("@")) {
    const { data: existing } = await ctx.supabase
      .from("av_customers")
      .select("id")
      .ilike("email", clientEmail)
      .eq("is_retired", false)
      .limit(1)
      .maybeSingle();
    customerId = (existing?.id as string | undefined) ?? null;
  }
  if (!customerId) {
    const { data: created, error: custErr } = await ctx.supabase
      .from("av_customers")
      .insert({
        name: clientName,
        contact_name: `${req.contact_first ?? ""} ${req.contact_last ?? ""}`.trim(),
        email: clientEmail,
        phone: clientPhone,
        notes: `From venue quote ${venueName}${portalRow?.slug ? ` (/quote/${portalRow.slug})` : ""}`,
        created_by: ctx.profile.id,
      })
      .select("id")
      .single();
    if (custErr || !created) {
      return fail(custErr?.message ?? "Could not create customer.");
    }
    customerId = created.id as string;
  }

  const { data: defaultRate } = await ctx.supabase
    .from("av_rate_definitions")
    .select("id")
    .eq("is_default", true)
    .maybeSingle();

  const days = (req.event_days ?? []) as {
    date?: string;
    startTime?: string;
    endTime?: string;
  }[];
  const bounds = eventDaysToGearLocalBounds(days);
  const gearStarts = bounds.startLocal
    ? datetimeLocalEasternToIso(bounds.startLocal)
    : null;
  const gearEnds = bounds.endLocal
    ? datetimeLocalEasternToIso(bounds.endLocal)
    : null;

  const depositStatus = String(req.deposit_status || "none");
  const depositAmount = Number(req.deposit_amount) || 0;
  const noteParts = [
    `Converted from venue request (${venueName}).`,
    req.event_type ? `Event: ${req.event_type}.` : "",
    req.guest_count ? `Guests: ${req.guest_count}.` : "",
    req.notes ? `Customer notes: ${req.notes}` : "",
    depositStatus === "paid" && depositAmount > 0
      ? `Deposit paid online: $${depositAmount.toFixed(2)}.`
      : depositStatus === "pending" && depositAmount > 0
        ? `Deposit pending: $${depositAmount.toFixed(2)}.`
        : "",
  ].filter(Boolean);

  const { data: opp, error: oppErr } = await ctx.supabase
    .from("av_opportunities")
    .insert({
      subject: `${venueName} — ${req.event_type || "Event"}`.slice(0, 200),
      status: "draft",
      customer_id: customerId,
      rate_definition_id: defaultRate?.id ?? null,
      gear_starts_at: gearStarts,
      gear_ends_at: gearEnds,
      charge_starts_at: gearStarts,
      charge_ends_at: gearEnds,
      notes: noteParts.join(" "),
      created_by: ctx.profile.id,
      reference: "",
    })
    .select("id")
    .single();
  if (oppErr || !opp) {
    if (/opportunity_id|column/i.test(oppErr?.message ?? "")) {
      return fail(
        "Convert needs migration 155_venue_convert_invoice_pay.sql in Supabase.",
      );
    }
    return fail(oppErr?.message ?? "Could not create quote.");
  }

  const opportunityId = opp.id as string;
  const { data: group } = await ctx.supabase
    .from("av_opportunity_groups")
    .insert({
      opportunity_id: opportunityId,
      name: "Venue quote",
      sort_order: 0,
    })
    .select("id")
    .single();

  const portalId = String(req.portal_id);
  let pkgRows: {
    id: string;
    name: string;
    price?: number;
    av_product_id?: string | null;
    av_service_id?: string | null;
  }[] = [];
  let addonRows: {
    id: string;
    name: string;
    unit_price?: number;
    av_product_id?: string | null;
    av_service_id?: string | null;
  }[] = [];
  {
    const mapped = await Promise.all([
      ctx.supabase
        .from("venue_portal_packages")
        .select("id, name, price, av_product_id, av_service_id")
        .eq("portal_id", portalId),
      ctx.supabase
        .from("venue_portal_addons")
        .select("id, name, unit_price, av_product_id, av_service_id")
        .eq("portal_id", portalId),
    ]);
    if (
      mapped[0].error &&
      /av_product_id|av_service_id|column/i.test(mapped[0].error.message)
    ) {
      const fallback = await Promise.all([
        ctx.supabase
          .from("venue_portal_packages")
          .select("id, name, price")
          .eq("portal_id", portalId),
        ctx.supabase
          .from("venue_portal_addons")
          .select("id, name, unit_price")
          .eq("portal_id", portalId),
      ]);
      pkgRows = (fallback[0].data ?? []) as typeof pkgRows;
      addonRows = (fallback[1].data ?? []) as typeof addonRows;
    } else {
      pkgRows = (mapped[0].data ?? []) as typeof pkgRows;
      addonRows = (mapped[1].data ?? []) as typeof addonRows;
    }
  }

  const lines = venueSelectionToOpportunityLines({
    selection: (req.selection ?? []) as SpaceSelection[],
    totals: (req.totals ?? {}) as Parameters<
      typeof venueTotalsToOpportunityLines
    >[0],
    packages: pkgRows.map((p) => ({
      id: String(p.id),
      name: String(p.name ?? ""),
      unitPrice: Number(p.price) || 0,
      avProductId: p.av_product_id ?? null,
      avServiceId: p.av_service_id ?? null,
    })),
    addons: addonRows.map((a) => ({
      id: String(a.id),
      name: String(a.name ?? ""),
      unitPrice: Number(a.unit_price) || 0,
      avProductId: a.av_product_id ?? null,
      avServiceId: a.av_service_id ?? null,
    })),
  });
  if (lines.length === 0) {
    const total = Number((req.totals as { total?: number } | null)?.total) || 0;
    if (total > 0) {
      lines.push({
        description: `${venueName} estimated package`,
        qty: 1,
        unitPrice: total,
      });
    }
  }

  if (group && lines.length > 0) {
    const { error: lineErr } = await ctx.supabase
      .from("av_opportunity_lines")
      .insert(
        lines.map((l, i) => ({
          opportunity_id: opportunityId,
          group_id: group.id,
          description: l.description.slice(0, 500),
          qty: l.qty,
          unit_price: l.unitPrice,
          discount_pct: 0,
          sort_order: i,
          text_kind: "rental" as const,
          product_id: l.productId || null,
          service_id: l.serviceId || null,
        })),
      );
    if (lineErr) return fail(lineErr.message);
  }

  const nextStatus =
    req.submit_kind === "book" || depositStatus === "paid"
      ? "booked"
      : "quoted";
  const { error: linkErr } = await ctx.supabase
    .from("venue_portal_quote_requests")
    .update({
      opportunity_id: opportunityId,
      converted_at: new Date().toISOString(),
      status: nextStatus,
    })
    .eq("id", requestId);
  if (linkErr) {
    if (/opportunity_id|column/i.test(linkErr.message)) {
      return fail(
        "Convert needs migration 155_venue_convert_invoice_pay.sql in Supabase.",
      );
    }
    return fail(linkErr.message);
  }

  revalidatePath("/venue-quotes/requests");
  revalidatePath("/venue-quotes");
  revalidatePath("/rentals/quotes");
  revalidatePath(`/rentals/quotes/${opportunityId}`);
  return { ok: true, data: { opportunityId } };
}

/** Create a second (or new) venue with a starter AV catalog ready to edit/publish. */
export async function createPortalWithStarterCatalogAction(input: {
  name: string;
  slug: string;
}): Promise<ActionResult<{ id: string }>> {
  const created = await createPortalAction(input);
  if (!created.ok || !created.data?.id) return created;
  const portalId = created.data.id;
  const ctx = await admin();
  if (!ctx) return fail("Admins only.");

  const spaces = [
    { name: "Ballroom", capacity: 200, sort_order: 10 },
    { name: "Boardroom", capacity: 40, sort_order: 20 },
    { name: "Foyer / breakout", capacity: 80, sort_order: 30 },
  ];
  const { data: spaceRows } = await ctx.supabase
    .from("venue_portal_spaces")
    .insert(spaces.map((s) => ({ ...s, portal_id: portalId })))
    .select("id, name");

  const { data: techRows } = await ctx.supabase
    .from("venue_portal_technicians")
    .insert([
      {
        portal_id: portalId,
        name: "Audio technician",
        rate_type: "hourly",
        rate: 85,
        sort_order: 10,
      },
      {
        portal_id: portalId,
        name: "Video technician",
        rate_type: "hourly",
        rate: 95,
        sort_order: 20,
      },
    ])
    .select("id, name");

  const audioId = techRows?.find((t) => t.name.startsWith("Audio"))?.id;
  const videoId = techRows?.find((t) => t.name.startsWith("Video"))?.id;

  const completeProductId =
    STARTER_PACKAGE_PRODUCT_BY_NAME["Complete Meeting"] ?? null;
  let pkgInsert = await ctx.supabase
    .from("venue_portal_packages")
    .insert({
      portal_id: portalId,
      name: "Complete Meeting",
      tagline: "Screen, audio, and on-site tech support",
      price: 1850,
      setup_fee: 350,
      includes_technician: true,
      is_popular: true,
      sort_order: 10,
      av_product_id: completeProductId,
      av_service_id: null,
    })
    .select("id")
    .single();
  if (
    pkgInsert.error &&
    /av_product_id|av_service_id|column/i.test(pkgInsert.error.message)
  ) {
    pkgInsert = await ctx.supabase
      .from("venue_portal_packages")
      .insert({
        portal_id: portalId,
        name: "Complete Meeting",
        tagline: "Screen, audio, and on-site tech support",
        price: 1850,
        setup_fee: 350,
        includes_technician: true,
        is_popular: true,
        sort_order: 10,
      })
      .select("id")
      .single();
  }
  const pkg = pkgInsert.data;

  if (pkg) {
    await ctx.supabase.from("venue_portal_package_items").insert([
      { package_id: pkg.id, label: "LED or projection screen", sort_order: 10 },
      { package_id: pkg.id, label: "Mixer + room speakers", sort_order: 20 },
      { package_id: pkg.id, label: "2 wireless mics", sort_order: 30 },
      { package_id: pkg.id, label: "Confidence / confidence feed", sort_order: 40 },
    ]);
    const techLinks = [audioId, videoId].filter(Boolean).map((technician_id) => ({
      package_id: pkg.id,
      technician_id: technician_id as string,
    }));
    if (techLinks.length) {
      await ctx.supabase
        .from("venue_portal_package_technicians")
        .insert(techLinks);
    }
  }

  const starterAddons = [
    {
      name: "Wireless microphone",
      description: "Handheld or lav",
      unit_price: 75,
      price_unit: "each" as const,
      sort_order: 10,
    },
    {
      name: "Confidence monitor",
      description: "Downstage confidence",
      unit_price: 150,
      price_unit: "flat" as const,
      sort_order: 20,
    },
    {
      name: "Extra technician hours",
      description: "Beyond package coverage",
      unit_price: 95,
      price_unit: "hour" as const,
      min_quantity: 2,
      sort_order: 30,
    },
  ];
  await ctx.supabase.from("venue_portal_addons").insert(
    starterAddons.map((a) => {
      const map = STARTER_ADDON_MAP_BY_NAME[a.name] ?? {};
      return {
        portal_id: portalId,
        ...a,
        av_product_id: map.productId ?? null,
        av_service_id: map.productId ? null : (map.serviceId ?? null),
      };
    }),
  );

  await ctx.supabase
    .from("venue_portals")
    .update({
      headline: "Build your AV package",
      intro:
        "Pick your spaces and packages for a live estimate. Send a quote to our team, or Book Now with a deposit.",
      delivery_fee: 250,
      tech_hourly_rate: 85,
      savings_pct: 10,
      savings_label: "Partner Savings",
      deposit_pct: 50,
      is_published: false,
    })
    .eq("id", portalId);

  void spaceRows;
  refresh(portalId);
  return { ok: true, data: { id: portalId } };
}
