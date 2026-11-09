"use server";

import { moveId, moveLineInSection } from "@/lib/av-erp/line-order";
import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";
import {
  contractFileName,
  estimateFileName,
} from "@/lib/av-erp/estimate-pdf";
import { newChangeOrderShareToken } from "@/lib/av-erp/change-orders";
import {
  changeOrderAmountDelta,
  type ChangeOrderLineInput,
} from "@/lib/av-erp/change-order-lines";
import {
  loadCustomerEstimateByOpportunityId,
  newEstimateShareToken,
} from "@/lib/av-erp/public-estimate";
import {
  buildStampedOpportunityPdf,
  resendSignedPdfBySignatureId,
} from "@/lib/av-erp/signed-document-email";
import { datetimeLocalEasternToIso } from "@/lib/av-erp/datetime";
import {
  freeQtyForWindow,
  reserveQtyForShortage,
  type HoldWindow,
} from "@/lib/av-erp/availability";
import {
  accessoryLineQty,
  accessoryRollupUnitPrice,
  isCumulativePackageName,
  effectiveProductUnitPrice,
} from "@/lib/av-erp/product-accessories";
import type { AvOpportunityStatus } from "@/lib/av-erp/types";
import { COMPANY } from "@/lib/company";
import { sendEmailDetailed } from "@/lib/email/send";

export type AvActionResult = { ok: true } | { ok: false; error: string };
export type ShortageLine = {
  lineId: string;
  productName: string;
  needed: number;
  free: number;
  short: number;
};
export type ConfirmReserveResult =
  | { ok: true; pastShortage?: boolean }
  | { ok: false; error: string; shortages?: ShortageLine[] };
export type CreateOpportunityResult =
  | { ok: true; id: string }
  | { ok: false; error: string };
export type DownloadEstimateResult =
  | { ok: true; pdfBase64: string; fileName: string }
  | { ok: false; error: string };
export type ShareLinkResult =
  | { ok: true; token: string; path: string }
  | { ok: false; error: string };

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string, fallback = 0) {
  const n = Number(str(formData, key) || String(fallback));
  return Number.isFinite(n) ? n : fallback;
}

function nullableId(formData: FormData, key: string) {
  const v = str(formData, key);
  return v || null;
}

const STATUSES: AvOpportunityStatus[] = [
  "draft",
  "quotation",
  "order",
  "closed",
];

function revalidateQuote(id?: string) {
  revalidatePath("/rentals/quotes");
  if (id) revalidatePath(`/rentals/quotes/${id}`);
}

export async function createOpportunityAction(): Promise<CreateOpportunityResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const { data: defaultRate } = await supabase
    .from("av_rate_definitions")
    .select("id")
    .eq("is_default", true)
    .maybeSingle();

  const { data, error: insertError } = await supabase
    .from("av_opportunities")
    .insert({
      subject: "New estimate",
      status: "draft",
      rate_definition_id: defaultRate?.id ?? null,
      created_by: profile.id,
      reference: "", // trigger assigns Q-####
    })
    .select("id")
    .single();

  if (insertError || !data) {
    return { ok: false, error: insertError?.message ?? "Could not create estimate" };
  }

  await supabase.from("av_opportunity_groups").insert({
    opportunity_id: data.id,
    name: "Gear",
    sort_order: 0,
  });

  revalidateQuote(data.id);
  return { ok: true, id: data.id as string };
}

export async function updateOpportunityHeaderAction(
  formData: FormData,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Missing estimate id." };

  const statusRaw = str(formData, "status") || "draft";
  const status = STATUSES.includes(statusRaw as AvOpportunityStatus)
    ? (statusRaw as AvOpportunityStatus)
    : "draft";

  const { error: updateError } = await supabase
    .from("av_opportunities")
    .update({
      subject: str(formData, "subject") || "Untitled estimate",
      status,
      customer_id: nullableId(formData, "customer_id"),
      venue_id: nullableId(formData, "venue_id"),
      rate_definition_id: nullableId(formData, "rate_definition_id"),
      gear_starts_at: datetimeLocalEasternToIso(str(formData, "gear_starts_at")),
      gear_ends_at: datetimeLocalEasternToIso(str(formData, "gear_ends_at")),
      charge_starts_at: datetimeLocalEasternToIso(
        str(formData, "charge_starts_at"),
      ),
      charge_ends_at: datetimeLocalEasternToIso(str(formData, "charge_ends_at")),
      bill_whole_event: str(formData, "bill_whole_event") === "on",
      surcharge_pct: Math.min(100, Math.max(0, num(formData, "surcharge_pct"))),
      discount_pct: Math.min(100, Math.max(0, num(formData, "discount_pct"))),
      venue_markup_enabled: str(formData, "venue_markup_enabled") === "on",
      venue_markup_pct: Math.min(
        100,
        Math.max(0, num(formData, "venue_markup_pct")),
      ),
      transport_notes: str(formData, "transport_notes"),
      notes: str(formData, "notes"),
    })
    .eq("id", id);

  if (updateError) return { ok: false, error: updateError.message };

  // Billing type has its own update so the rest still saves before migration 187 is run.
  const billingType = str(formData, "billing_type") === "venue" ? "venue" : "direct";
  const { error: billingError } = await supabase
    .from("av_opportunities")
    .update({ billing_type: billingType })
    .eq("id", id);
  if (billingError && billingType === "venue") {
    return {
      ok: false,
      error: "Venue billing needs migration 187_av_billing_type.sql in Supabase.",
    };
  }

  // Event link has its own update so the rest still saves before migration 192 is run.
  if (formData.has("honeybook_project_id")) {
    const projectId = nullableId(formData, "honeybook_project_id");
    const { error: linkError } = await supabase
      .from("av_opportunities")
      .update({ honeybook_project_id: projectId })
      .eq("id", id);
    if (linkError && projectId) {
      return {
        ok: false,
        error: "Linking an event needs migration 192_event_gear_checklists.sql in Supabase.",
      };
    }
  }
  revalidateQuote(id);
  return { ok: true };
}

export async function addOpportunityGroupAction(
  formData: FormData,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  const opportunityId = str(formData, "opportunity_id");
  const name = str(formData, "name") || "Section";
  if (!opportunityId) return { ok: false, error: "Missing estimate." };

  const { count } = await supabase
    .from("av_opportunity_groups")
    .select("id", { count: "exact", head: true })
    .eq("opportunity_id", opportunityId);

  const { error: insertError } = await supabase
    .from("av_opportunity_groups")
    .insert({
      opportunity_id: opportunityId,
      name,
      sort_order: count ?? 0,
    });
  if (insertError) return { ok: false, error: insertError.message };
  revalidateQuote(opportunityId);
  return { ok: true };
}

export async function addOpportunityLineAction(
  formData: FormData,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const opportunityId = str(formData, "opportunity_id");
  if (!opportunityId) return { ok: false, error: "Missing estimate." };

  const productId = nullableId(formData, "product_id");
  const serviceId = nullableId(formData, "service_id");
  let description = str(formData, "description");
  let unitPrice = Math.max(0, num(formData, "unit_price"));
  const unitPriceProvided = Boolean(str(formData, "unit_price"));
  let productKind: string | null = null;
  let cumulativePackage = false;

  type AccRow = {
    child_product_id: string;
    qty: number;
    is_required: boolean;
  };
  let accessories: AccRow[] = [];
  const childById = new Map<
    string,
    { id: string; name: string; rental_price: number }
  >();

  if (productId) {
    const { data: product } = await supabase
      .from("av_products")
      .select("name, rental_price, kind")
      .eq("id", productId)
      .maybeSingle();
    if (product) {
      description = description || (product.name as string);
      productKind = (product.kind as string) || null;
      cumulativePackage = isCumulativePackageName(product.name as string);

      // "*" keeps working before migration 189 adds is_optional.
      const { data: accRows } = await supabase
        .from("av_product_accessories")
        .select("*")
        .eq("parent_product_id", productId);
      // Optional items are added by hand from the package line.
      accessories = (accRows ?? [])
        .filter((a) => !a.is_optional)
        .map((a) => ({
          child_product_id: a.child_product_id as string,
          qty: Number(a.qty) || 1,
          is_required: Boolean(a.is_required),
        }));

      if (accessories.length > 0) {
        const childIds = accessories.map((a) => a.child_product_id);
        const { data: childProducts } = await supabase
          .from("av_products")
          .select("id, name, rental_price")
          .in("id", childIds);
        for (const p of childProducts ?? []) {
          childById.set(p.id as string, {
            id: p.id as string,
            name: p.name as string,
            rental_price: Number(p.rental_price) || 0,
          });
        }
      }

      if (cumulativePackage) {
        // Header line only: the nested items carry the price.
        unitPrice = 0;
      } else if (!unitPriceProvided) {
        const rollup = accessoryRollupUnitPrice(
          accessories.map((a) => ({
            qty: a.qty,
            unitPrice: childById.get(a.child_product_id)?.rental_price ?? 0,
          })),
        );
        unitPrice = effectiveProductUnitPrice(
          Number(product.rental_price) || 0,
          rollup,
        );
      }
    }
  } else if (serviceId) {
    const { data: service } = await supabase
      .from("av_services")
      .select("name, unit_price")
      .eq("id", serviceId)
      .maybeSingle();
    if (service) {
      description = description || (service.name as string);
      if (!unitPriceProvided) {
        unitPrice = Number(service.unit_price) || 0;
      }
    }
  }

  if (!productId && !serviceId && !description) {
    return { ok: false, error: "Pick a product/service or enter a description." };
  }

  const textKindRaw = str(formData, "text_kind");
  const textKind =
    !productId && !serviceId
      ? textKindRaw === "sale"
        ? "sale"
        : textKindRaw === "rental"
          ? "rental"
          : "rental"
      : null;

  const { count } = await supabase
    .from("av_opportunity_lines")
    .select("id", { count: "exact", head: true })
    .eq("opportunity_id", opportunityId);

  const parentQty = Math.max(0.01, num(formData, "qty", 1));
  let sortOrder = count ?? 0;
  const groupId = nullableId(formData, "group_id");
  const discountPct = Math.min(
    100,
    Math.max(0, num(formData, "discount_pct")),
  );
  /** Packages bill on the parent; included gear nests at $0. */
  const nestAccessoriesAtZero =
    productKind === "package" && !cumulativePackage;

  const { data: parentLine, error: insertError } = await supabase
    .from("av_opportunity_lines")
    .insert({
      opportunity_id: opportunityId,
      group_id: groupId,
      product_id: productId,
      service_id: serviceId,
      description,
      qty: parentQty,
      unit_price: unitPrice,
      discount_pct: discountPct,
      sort_order: sortOrder,
      text_kind: textKind,
    })
    .select("id")
    .single();
  if (insertError || !parentLine) {
    return { ok: false, error: insertError?.message ?? "Could not add line" };
  }

  // Auto-nest catalog accessories under the new product line.
  if (productId && accessories.length > 0) {
    const childRows = [];
    for (const acc of accessories) {
      const child = childById.get(acc.child_product_id);
      if (!child) continue;
      sortOrder += 1;
      childRows.push({
        opportunity_id: opportunityId,
        group_id: groupId,
        parent_line_id: parentLine.id as string,
        product_id: child.id,
        service_id: null,
        description: child.name,
        qty: Math.max(0.01, accessoryLineQty(parentQty, acc.qty)),
        unit_price: nestAccessoriesAtZero ? 0 : child.rental_price,
        discount_pct: 0,
        sort_order: sortOrder,
      });
    }
    if (childRows.length > 0) {
      const { error: childError } = await supabase
        .from("av_opportunity_lines")
        .insert(childRows);
      if (childError) return { ok: false, error: childError.message };
    }
  }

  revalidateQuote(opportunityId);
  return { ok: true };
}

/**
 * Add one optional Comes-with item under a package line already on the
 * estimate. Priced at the item's catalog price; edit or delete like any line.
 */
export async function addOptionalPackageItemAction(
  formData: FormData,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const lineId = str(formData, "line_id");
  const opportunityId = str(formData, "opportunity_id");
  const childProductId = str(formData, "child_product_id");
  if (!lineId || !opportunityId || !childProductId) {
    return { ok: false, error: "Missing package line or item." };
  }

  const { data: parent } = await supabase
    .from("av_opportunity_lines")
    .select("id, product_id, parent_line_id, group_id, qty")
    .eq("id", lineId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (!parent || !parent.product_id || parent.parent_line_id) {
    return { ok: false, error: "Package line not found." };
  }

  const { data: acc } = await supabase
    .from("av_product_accessories")
    .select("qty")
    .eq("parent_product_id", parent.product_id)
    .eq("child_product_id", childProductId)
    .maybeSingle();
  if (!acc) {
    return { ok: false, error: "That item is not part of this package." };
  }

  const { data: existing } = await supabase
    .from("av_opportunity_lines")
    .select("id")
    .eq("parent_line_id", lineId)
    .eq("product_id", childProductId)
    .limit(1);
  if (existing && existing.length > 0) {
    return { ok: false, error: "That item is already on this package." };
  }

  const { data: child } = await supabase
    .from("av_products")
    .select("id, name, rental_price")
    .eq("id", childProductId)
    .maybeSingle();
  if (!child) return { ok: false, error: "Item not found." };

  const { count } = await supabase
    .from("av_opportunity_lines")
    .select("id", { count: "exact", head: true })
    .eq("opportunity_id", opportunityId);

  const { error: insertError } = await supabase
    .from("av_opportunity_lines")
    .insert({
      opportunity_id: opportunityId,
      group_id: parent.group_id,
      parent_line_id: lineId,
      product_id: child.id,
      service_id: null,
      description: child.name,
      qty: Math.max(
        0.01,
        accessoryLineQty(Number(parent.qty) || 1, Number(acc.qty) || 1),
      ),
      unit_price: Number(child.rental_price) || 0,
      discount_pct: 0,
      sort_order: count ?? 0,
    });
  if (insertError) return { ok: false, error: insertError.message };

  revalidateQuote(opportunityId);
  return { ok: true };
}

/**
 * Set a package parent line's unit price from catalog Comes-with rollup
 * and zero nested accessory line prices (included gear).
 */
export async function repricePackageLineFromAccessoriesAction(
  formData: FormData,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  const opportunityId = str(formData, "opportunity_id");
  if (!id || !opportunityId) return { ok: false, error: "Missing line." };

  const { data: line } = await supabase
    .from("av_opportunity_lines")
    .select("id, product_id, parent_line_id")
    .eq("id", id)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (!line) return { ok: false, error: "Line not found." };
  if (line.parent_line_id) {
    return { ok: false, error: "Use this on the package line, not an accessory." };
  }
  if (!line.product_id) {
    return { ok: false, error: "This line is not a catalog product." };
  }

  const { data: product } = await supabase
    .from("av_products")
    .select("name, kind, rental_price")
    .eq("id", line.product_id)
    .maybeSingle();
  if (!product || product.kind !== "package") {
    return { ok: false, error: "Only package products can use this." };
  }
  if (isCumulativePackageName(product.name as string)) {
    return {
      ok: false,
      error: "This package is priced by the items inside it. Edit those lines.",
    };
  }

  const { data: accessories } = await supabase
    .from("av_product_accessories")
    .select("child_product_id, qty")
    .eq("parent_product_id", line.product_id);
  const childIds = (accessories ?? []).map((a) => a.child_product_id as string);
  const childPrice = new Map<string, number>();
  if (childIds.length > 0) {
    const { data: children } = await supabase
      .from("av_products")
      .select("id, rental_price")
      .in("id", childIds);
    for (const c of children ?? []) {
      childPrice.set(c.id as string, Number(c.rental_price) || 0);
    }
  }

  const rollup = accessoryRollupUnitPrice(
    (accessories ?? []).map((a) => ({
      qty: Number(a.qty) || 1,
      unitPrice: childPrice.get(a.child_product_id as string) ?? 0,
    })),
  );
  const unitPrice = effectiveProductUnitPrice(
    Number(product.rental_price) || 0,
    rollup,
  );

  const { error: parentErr } = await supabase
    .from("av_opportunity_lines")
    .update({ unit_price: unitPrice })
    .eq("id", id);
  if (parentErr) return { ok: false, error: parentErr.message };

  const { error: childErr } = await supabase
    .from("av_opportunity_lines")
    .update({ unit_price: 0 })
    .eq("parent_line_id", id)
    .eq("opportunity_id", opportunityId);
  if (childErr) return { ok: false, error: childErr.message };

  revalidateQuote(opportunityId);
  return { ok: true };
}

export async function updateOpportunityLineAction(
  formData: FormData,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  const opportunityId = str(formData, "opportunity_id");
  if (!id || !opportunityId) return { ok: false, error: "Missing line." };

  const { data: existing } = await supabase
    .from("av_opportunity_lines")
    .select("product_id, service_id")
    .eq("id", id)
    .maybeSingle();
  const isFreeText =
    existing && !existing.product_id && !existing.service_id;
  const textKindRaw = str(formData, "text_kind");
  const textKind = isFreeText
    ? textKindRaw === "sale"
      ? "sale"
      : "rental"
    : null;

  const { error: updateError } = await supabase
    .from("av_opportunity_lines")
    .update({
      description: str(formData, "description"),
      qty: Math.max(0.01, num(formData, "qty", 1)),
      unit_price: Math.max(0, num(formData, "unit_price")),
      discount_pct: Math.min(100, Math.max(0, num(formData, "discount_pct"))),
      text_kind: textKind,
    })
    .eq("id", id);
  if (updateError) return { ok: false, error: updateError.message };
  revalidateQuote(opportunityId);
  return { ok: true };
}

export async function deleteOpportunityLineAction(
  formData: FormData,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  const id = str(formData, "id");
  const opportunityId = str(formData, "opportunity_id");
  if (!id || !opportunityId) return { ok: false, error: "Missing line." };

  await supabase.from("av_holds").delete().eq("line_id", id);
  const { error: delError } = await supabase
    .from("av_opportunity_lines")
    .delete()
    .eq("id", id);
  if (delError) return { ok: false, error: delError.message };
  revalidateQuote(opportunityId);
  return { ok: true };
}

/** Deletes a quote and cascaded groups, lines, and holds. */
export async function deleteOpportunityAction(
  opportunityId: string,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!opportunityId) return { ok: false, error: "Missing estimate." };

  const { error: delError } = await supabase
    .from("av_opportunities")
    .delete()
    .eq("id", opportunityId);
  if (delError) return { ok: false, error: delError.message };

  revalidatePath("/rentals/quotes");
  return { ok: true };
}

/**
 * Replace holds for this opportunity from product lines over the gear window.
 * Blocks when any line is short unless confirm_anyway=on (then reserves free
 * qty only and notes who confirmed past the shortage).
 */
export async function confirmAndReserveAction(
  formData: FormData,
): Promise<ConfirmReserveResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const opportunityId = str(formData, "opportunity_id");
  if (!opportunityId) return { ok: false, error: "Missing estimate." };
  const confirmAnyway = str(formData, "confirm_anyway") === "on";

  const { data: opp, error: oppError } = await supabase
    .from("av_opportunities")
    .select("id, gear_starts_at, gear_ends_at, status, notes, reference")
    .eq("id", opportunityId)
    .maybeSingle();
  if (oppError || !opp) {
    return { ok: false, error: oppError?.message ?? "Estimate not found." };
  }
  if (!opp.gear_starts_at || !opp.gear_ends_at) {
    return {
      ok: false,
      error: "Set gear out and gear back dates before reserving.",
    };
  }

  const { data: lines, error: linesError } = await supabase
    .from("av_opportunity_lines")
    .select("id, product_id, qty, description")
    .eq("opportunity_id", opportunityId)
    .not("product_id", "is", null);
  if (linesError) return { ok: false, error: linesError.message };

  const productIds = [
    ...new Set(
      (lines ?? [])
        .map((l) => l.product_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [{ data: products }, { data: otherHolds }] = await Promise.all([
    productIds.length
      ? supabase
          .from("av_products")
          .select("id, name, kind, qty_owned, buffer_pct, turnaround_hours")
          .in("id", productIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            name: string;
            kind: string;
            qty_owned: number;
            buffer_pct: number;
            turnaround_hours: number;
          }>,
        }),
    productIds.length
      ? supabase
          .from("av_holds")
          .select("product_id, qty, starts_at, ends_at, opportunity_id")
          .in("product_id", productIds)
      : Promise.resolve({ data: [] as HoldWindow[] }),
  ]);

  const productById = new Map(
    (products ?? []).map((p) => [p.id as string, p]),
  );
  const holds = (otherHolds ?? []) as HoldWindow[];

  const shortages: ShortageLine[] = [];
  const reservePlan: Array<{
    lineId: string;
    productId: string;
    qty: number;
  }> = [];

  for (const line of lines ?? []) {
    const productId = line.product_id as string | null;
    if (!productId) continue;
    const product = productById.get(productId);
    if (!product) continue;
    const needed = Number(line.qty) || 0;
    if (needed <= 0) continue;

    // Packages / sale / consumable: no rental stock pool — reserve full qty, no shortage block
    if (product.kind !== "rental") {
      reservePlan.push({
        lineId: line.id as string,
        productId,
        qty: needed,
      });
      continue;
    }

    const free = freeQtyForWindow({
      qtyOwned: Number(product.qty_owned) || 0,
      bufferPct: Number(product.buffer_pct) || 0,
      startsAt: opp.gear_starts_at as string,
      endsAt: opp.gear_ends_at as string,
      holds: holds.filter((h) => h.product_id === productId),
      excludeOpportunityId: opportunityId,
      turnaroundHours: Number(product.turnaround_hours) || 0,
    });
    const { reserve, short } = reserveQtyForShortage(needed, free);
    if (short > 0) {
      shortages.push({
        lineId: line.id as string,
        productName:
          (product.name as string) ||
          (line.description as string) ||
          "Product",
        needed,
        free,
        short,
      });
    }
    if (confirmAnyway) {
      if (reserve > 0) {
        reservePlan.push({
          lineId: line.id as string,
          productId,
          qty: reserve,
        });
      }
    } else {
      reservePlan.push({
        lineId: line.id as string,
        productId,
        qty: needed,
      });
    }
  }

  if (shortages.length > 0 && !confirmAnyway) {
    const summary = shortages
      .slice(0, 4)
      .map((s) => `${s.productName} short ${s.short}`)
      .join("; ");
    return {
      ok: false,
      error: `Gear shortage on this estimate (${summary}). Confirm anyway to reserve what is free.`,
      shortages,
    };
  }

  await supabase.from("av_holds").delete().eq("opportunity_id", opportunityId);

  const holdRows = reservePlan.map((r) => ({
    opportunity_id: opportunityId,
    line_id: r.lineId,
    product_id: r.productId,
    qty: r.qty,
    starts_at: opp.gear_starts_at as string,
    ends_at: opp.gear_ends_at as string,
    created_by: profile.id,
  }));

  if (holdRows.length > 0) {
    const { error: holdError } = await supabase
      .from("av_holds")
      .insert(holdRows);
    if (holdError) return { ok: false, error: holdError.message };
  }

  const updates: Record<string, unknown> = {};
  if (opp.status === "draft") {
    updates.status = "quotation";
  }
  if (confirmAnyway && shortages.length > 0) {
    const when = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "medium",
      timeStyle: "short",
    });
    const who = profile.full_name || profile.email || profile.id;
    const detail = shortages
      .map((s) => `${s.productName}: needed ${s.needed}, free ${s.free}, short ${s.short}`)
      .join("; ");
    const stamp = `Confirmed past a shortage by ${who} on ${when} (Eastern). ${detail}`;
    const prior = String(opp.notes ?? "").trim();
    updates.notes = prior ? `${prior}\n\n${stamp}` : stamp;
  }
  if (Object.keys(updates).length > 0) {
    await supabase
      .from("av_opportunities")
      .update(updates)
      .eq("id", opportunityId);
  }

  revalidateQuote(opportunityId);
  return {
    ok: true,
    pastShortage: confirmAnyway && shortages.length > 0,
  };
}

export async function clearHoldsAction(
  formData: FormData,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  const opportunityId = str(formData, "opportunity_id");
  if (!opportunityId) return { ok: false, error: "Missing estimate." };
  const { error: delError } = await supabase
    .from("av_holds")
    .delete()
    .eq("opportunity_id", opportunityId);
  if (delError) return { ok: false, error: delError.message };
  revalidateQuote(opportunityId);
  return { ok: true };
}

/** Customer-facing estimate PDF (venue markup folded into prices). */
export async function downloadEstimatePdfAction(
  opportunityId: string,
): Promise<DownloadEstimateResult> {
  const { error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const estimate = await loadCustomerEstimateByOpportunityId(opportunityId);
  if (!estimate) return { ok: false, error: "Estimate not found." };

  const stamped = await buildStampedOpportunityPdf(opportunityId, "estimate", {
    preferArchive: true,
  });
  if (!stamped) return { ok: false, error: "Could not build PDF." };
  return {
    ok: true,
    pdfBase64: Buffer.from(stamped.bytes).toString("base64"),
    fileName: stamped.fileName || estimateFileName(estimate),
  };
}

/** Contract PDF (same RMS layout as estimate, labeled Contract + signature). */
export async function downloadContractPdfAction(
  opportunityId: string,
): Promise<DownloadEstimateResult> {
  const { error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const estimate = await loadCustomerEstimateByOpportunityId(opportunityId);
  if (!estimate) return { ok: false, error: "Estimate not found." };

  const stamped = await buildStampedOpportunityPdf(opportunityId, "contract", {
    preferArchive: true,
  });
  if (!stamped) return { ok: false, error: "Could not build PDF." };
  return {
    ok: true,
    pdfBase64: Buffer.from(stamped.bytes).toString("base64"),
    fileName: stamped.fileName || contractFileName(estimate),
  };
}

export type ResendSignedPdfResult =
  | { ok: true; to: string }
  | { ok: false; error: string };

/** Staff resend of an accepted signed PDF (prefer immutable archive). */
export async function resendSignedPdfAction(
  signatureId: string,
): Promise<ResendSignedPdfResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!signatureId) return { ok: false, error: "Missing signature." };

  const { data: sig } = await supabase
    .from("av_customer_document_signatures")
    .select("opportunity_id")
    .eq("id", signatureId)
    .maybeSingle();

  const sent = await resendSignedPdfBySignatureId(signatureId);
  if (!sent.ok) {
    return {
      ok: false,
      error: sent.error || (sent.skipped ? "No customer email." : "Send failed."),
    };
  }
  if (sig?.opportunity_id) {
    revalidateQuote(sig.opportunity_id as string);
  }
  return { ok: true, to: sent.to || "" };
}

/** Enable (or rotate) the public estimate share link. */
export async function enableEstimateShareAction(
  opportunityId: string,
): Promise<ShareLinkResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!opportunityId) return { ok: false, error: "Missing estimate." };

  const { data: existing } = await supabase
    .from("av_opportunities")
    .select("share_token")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Estimate not found." };

  const token =
    (existing.share_token as string | null) || newEstimateShareToken();

  const { error: updateError } = await supabase
    .from("av_opportunities")
    .update({ share_token: token, share_enabled: true })
    .eq("id", opportunityId);
  if (updateError) return { ok: false, error: updateError.message };

  revalidateQuote(opportunityId);
  revalidatePath(`/estimate/${token}`);
  return { ok: true, token, path: `/estimate/${token}` };
}

export async function revokeEstimateShareAction(
  opportunityId: string,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!opportunityId) return { ok: false, error: "Missing estimate." };

  const { error: updateError } = await supabase
    .from("av_opportunities")
    .update({ share_enabled: false })
    .eq("id", opportunityId);
  if (updateError) return { ok: false, error: updateError.message };

  revalidateQuote(opportunityId);
  return { ok: true };
}

export type EmailEstimateResult =
  | { ok: true; to: string }
  | { ok: false; error: string };

/** Enable share if needed, then email the public estimate link to the customer. */
export async function emailEstimateAction(
  opportunityId: string,
): Promise<EmailEstimateResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!opportunityId) return { ok: false, error: "Missing estimate." };

  const share = await enableEstimateShareAction(opportunityId);
  if (!share.ok) return { ok: false, error: share.error };

  const { data: opp } = await supabase
    .from("av_opportunities")
    .select("reference, subject, customer_id")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!opp) return { ok: false, error: "Estimate not found." };
  if (!opp.customer_id) {
    return { ok: false, error: "Add a customer with an email first." };
  }

  const { data: customer } = await supabase
    .from("av_customers")
    .select("name, email")
    .eq("id", opp.customer_id)
    .maybeSingle();
  const to = String(customer?.email ?? "")
    .trim()
    .toLowerCase();
  if (!to || !to.includes("@")) {
    return { ok: false, error: "Customer has no email address." };
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const vercelHost = process.env.VERCEL_URL?.replace(/^https?:\/\//, "");
  const origin =
    configured ||
    (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
  const link = `${origin}${share.path}`;
  const subject =
    `Estimate ${opp.reference}` +
    (opp.subject ? ` — ${opp.subject}` : "");

  const sent = await sendEmailDetailed({
    to,
    subject,
    text: [
      `Hi${customer?.name ? ` ${customer.name}` : ""},`,
      "",
      `Your estimate from ${COMPANY.displayName} is ready:`,
      link,
      "",
      "You can review the totals, download a PDF, and accept with an electronic signature (or decline) from that page.",
      "",
      `— ${COMPANY.displayName}`,
    ].join("\n"),
    html: `<p>Hi${customer?.name ? ` ${customer.name}` : ""},</p>
<p>Your estimate from ${COMPANY.displayName} is ready.</p>
<p><a href="${link}">View estimate ${opp.reference}</a></p>
<p>Review the totals, download a PDF, and accept with an electronic signature (or decline) from that page.</p>
<p>— ${COMPANY.displayName}</p>`,
  });
  if (!sent.ok) {
    return {
      ok: false,
      error: sent.error || "Email could not be sent (check Resend config).",
    };
  }

  revalidateQuote(opportunityId);
  return { ok: true, to };
}

export async function addOpportunityNoteAction(
  opportunityId: string,
  body: string,
): Promise<AvActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };
  const text = String(body ?? "").trim();
  if (!opportunityId || !text) {
    return { ok: false, error: "Note cannot be empty." };
  }

  const { error: insertError } = await supabase
    .from("av_opportunity_notes")
    .insert({
      opportunity_id: opportunityId,
      body: text.slice(0, 4000),
      author_id: profile.id,
    });
  if (insertError) return { ok: false, error: insertError.message };

  revalidateQuote(opportunityId);
  return { ok: true };
}

export async function saveQuoteAsTemplateAction(
  opportunityId: string,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!opportunityId) return { ok: false, error: "Missing estimate." };

  const { error: updateError } = await supabase
    .from("av_opportunities")
    .update({ is_template: true })
    .eq("id", opportunityId);
  if (updateError) return { ok: false, error: updateError.message };

  revalidateQuote(opportunityId);
  revalidatePath("/rentals/quotes");
  return { ok: true };
}

export type CreateChangeOrderResult =
  | { ok: true; id: string; number: string }
  | { ok: false; error: string };

export async function createChangeOrderAction(input: {
  opportunityId: string;
  subject: string;
  summary: string;
  amountDelta?: number;
}): Promise<CreateChangeOrderResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };
  if (!input.opportunityId) return { ok: false, error: "Missing estimate." };

  const subject = String(input.subject ?? "").trim().slice(0, 200);
  const summary = String(input.summary ?? "").trim().slice(0, 4000);
  if (!subject) return { ok: false, error: "Subject is required." };

  const { count, error: countError } = await supabase
    .from("av_change_orders")
    .select("id", { count: "exact", head: true })
    .eq("opportunity_id", input.opportunityId);
  if (countError) {
    if (/av_change_orders|relation|does not exist/i.test(countError.message)) {
      return {
        ok: false,
        error:
          "Change orders need migration 152_av_customer_esign.sql in Supabase.",
      };
    }
    return { ok: false, error: countError.message };
  }

  const number = `CO-${(count ?? 0) + 1}`;
  const { data, error: insertError } = await supabase
    .from("av_change_orders")
    .insert({
      opportunity_id: input.opportunityId,
      number,
      subject,
      summary,
      amount_delta: Number(input.amountDelta) || 0,
      status: "draft",
      created_by: profile.id,
    })
    .select("id, number")
    .maybeSingle();
  if (insertError) return { ok: false, error: insertError.message };
  if (!data) return { ok: false, error: "Could not create change order." };

  revalidateQuote(input.opportunityId);
  return { ok: true, id: data.id, number: data.number };
}

export async function enableChangeOrderShareAction(
  changeOrderId: string,
): Promise<ShareLinkResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!changeOrderId) return { ok: false, error: "Missing change order." };

  const { data: existing, error: loadError } = await supabase
    .from("av_change_orders")
    .select("id, opportunity_id, share_token, status")
    .eq("id", changeOrderId)
    .maybeSingle();
  if (loadError) {
    if (/av_change_orders|relation|does not exist/i.test(loadError.message)) {
      return {
        ok: false,
        error:
          "Change orders need migration 152_av_customer_esign.sql in Supabase.",
      };
    }
    return { ok: false, error: loadError.message };
  }
  if (!existing) return { ok: false, error: "Change order not found." };
  if (existing.status === "void") {
    return { ok: false, error: "This change order is void." };
  }

  const token =
    (existing.share_token as string | null) || newChangeOrderShareToken();
  const { error: updateError } = await supabase
    .from("av_change_orders")
    .update({
      share_token: token,
      share_enabled: true,
      status: existing.status === "draft" ? "sent" : existing.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", changeOrderId);
  if (updateError) return { ok: false, error: updateError.message };

  revalidateQuote(existing.opportunity_id);
  revalidatePath(`/change-order/${token}`);
  return { ok: true, token, path: `/change-order/${token}` };
}

export async function voidChangeOrderAction(
  changeOrderId: string,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!changeOrderId) return { ok: false, error: "Missing change order." };

  const { data: existing } = await supabase
    .from("av_change_orders")
    .select("id, opportunity_id, status")
    .eq("id", changeOrderId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Change order not found." };
  if (existing.status === "accepted") {
    return { ok: false, error: "Accepted change orders cannot be voided." };
  }

  const { error: updateError } = await supabase
    .from("av_change_orders")
    .update({
      status: "void",
      share_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", changeOrderId);
  if (updateError) return { ok: false, error: updateError.message };

  revalidateQuote(existing.opportunity_id);
  return { ok: true };
}

async function recomputeChangeOrderAmountDelta(
  supabase: Awaited<ReturnType<typeof requireAvErpAccess>>["supabase"],
  changeOrderId: string,
): Promise<AvActionResult> {
  const { data: lines, error } = await supabase
    .from("av_change_order_lines")
    .select(
      "source_line_id, description, qty, unit_price, discount_pct, sort_order, apply_mode, text_kind, product_id, service_id",
    )
    .eq("change_order_id", changeOrderId);
  if (error) {
    if (/av_change_order_lines|relation|does not exist/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Change-order lines need migration 153_av_tax_co_lines_signed.sql in Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }

  const sourceIds = (lines ?? [])
    .map((l) => l.source_line_id as string | null)
    .filter((id): id is string => Boolean(id));
  const sourceById = new Map<
    string,
    { qty: number; unit_price: number; discount_pct: number }
  >();
  if (sourceIds.length > 0) {
    const { data: sources } = await supabase
      .from("av_opportunity_lines")
      .select("id, qty, unit_price, discount_pct")
      .in("id", sourceIds);
    for (const s of sources ?? []) {
      sourceById.set(s.id as string, {
        qty: Number(s.qty) || 0,
        unit_price: Number(s.unit_price) || 0,
        discount_pct: Number(s.discount_pct) || 0,
      });
    }
  }

  const mapped: ChangeOrderLineInput[] = (lines ?? []).map((l, i) => ({
    source_line_id: (l.source_line_id as string | null) ?? null,
    product_id: (l.product_id as string | null) ?? null,
    service_id: (l.service_id as string | null) ?? null,
    description: String(l.description || ""),
    qty: Number(l.qty) || 0,
    unit_price: Number(l.unit_price) || 0,
    discount_pct: Number(l.discount_pct) || 0,
    sort_order: Number(l.sort_order) || i,
    text_kind: (l.text_kind as "rental" | "sale" | null) ?? null,
    apply_mode: (l.apply_mode as ChangeOrderLineInput["apply_mode"]) || "add",
  }));
  const amountDelta = changeOrderAmountDelta(mapped, sourceById);
  const { error: updateError } = await supabase
    .from("av_change_orders")
    .update({
      amount_delta: amountDelta,
      updated_at: new Date().toISOString(),
    })
    .eq("id", changeOrderId);
  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true };
}

export async function addChangeOrderLineAction(input: {
  changeOrderId: string;
  description: string;
  qty: number;
  unitPrice: number;
  applyMode?: "add" | "adjust_qty" | "remove";
  sourceLineId?: string | null;
}): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!input.changeOrderId) return { ok: false, error: "Missing change order." };

  const { data: co } = await supabase
    .from("av_change_orders")
    .select("id, opportunity_id, status")
    .eq("id", input.changeOrderId)
    .maybeSingle();
  if (!co) return { ok: false, error: "Change order not found." };
  if (co.status === "accepted" || co.status === "void") {
    return { ok: false, error: "This change order can no longer be edited." };
  }

  const applyMode = input.applyMode ?? "add";
  let description = String(input.description ?? "").trim().slice(0, 500);
  let qty = Number(input.qty) || 0;
  let unitPrice = Number(input.unitPrice) || 0;
  const sourceLineId: string | null =
    applyMode === "add" ? null : input.sourceLineId ?? null;

  if (applyMode !== "add") {
    if (!sourceLineId) {
      return { ok: false, error: "Pick an estimate line to adjust or remove." };
    }
    const { data: source } = await supabase
      .from("av_opportunity_lines")
      .select("id, opportunity_id, description, qty, unit_price")
      .eq("id", sourceLineId)
      .maybeSingle();
    if (!source || source.opportunity_id !== co.opportunity_id) {
      return { ok: false, error: "Estimate line not found on this opportunity." };
    }
    if (!description) {
      description = String(source.description || "").slice(0, 500);
    }
    if (applyMode === "remove") {
      description = description || "Remove line";
      qty = 0;
      unitPrice = 0;
    } else if (applyMode === "adjust_qty") {
      if (!(qty > 0)) {
        return { ok: false, error: "New quantity must be greater than zero." };
      }
      if (!unitPrice) unitPrice = Number(source.unit_price) || 0;
    }
  } else if (!description) {
    return { ok: false, error: "Description is required." };
  }

  const { count } = await supabase
    .from("av_change_order_lines")
    .select("id", { count: "exact", head: true })
    .eq("change_order_id", input.changeOrderId);

  const { error: insertError } = await supabase.from("av_change_order_lines").insert({
    change_order_id: input.changeOrderId,
    source_line_id: sourceLineId,
    description:
      applyMode === "remove" ? description || "Remove line" : description,
    qty,
    unit_price: unitPrice,
    discount_pct: 0,
    sort_order: count ?? 0,
    apply_mode: applyMode,
  });
  if (insertError) {
    if (/av_change_order_lines|relation|does not exist/i.test(insertError.message)) {
      return {
        ok: false,
        error:
          "Change-order lines need migration 153_av_tax_co_lines_signed.sql in Supabase.",
      };
    }
    return { ok: false, error: insertError.message };
  }

  const recomputed = await recomputeChangeOrderAmountDelta(
    supabase,
    input.changeOrderId,
  );
  if (!recomputed.ok) return recomputed;
  revalidateQuote(co.opportunity_id);
  return { ok: true };
}

export async function deleteChangeOrderLineAction(
  lineId: string,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!lineId) return { ok: false, error: "Missing line." };

  const { data: line } = await supabase
    .from("av_change_order_lines")
    .select("id, change_order_id")
    .eq("id", lineId)
    .maybeSingle();
  if (!line) return { ok: false, error: "Line not found." };

  const { data: co } = await supabase
    .from("av_change_orders")
    .select("id, opportunity_id, status")
    .eq("id", line.change_order_id)
    .maybeSingle();
  if (!co) return { ok: false, error: "Change order not found." };
  if (co.status === "accepted" || co.status === "void") {
    return { ok: false, error: "This change order can no longer be edited." };
  }

  const { error: delError } = await supabase
    .from("av_change_order_lines")
    .delete()
    .eq("id", lineId);
  if (delError) return { ok: false, error: delError.message };

  const recomputed = await recomputeChangeOrderAmountDelta(supabase, co.id);
  if (!recomputed.ok) return recomputed;
  revalidateQuote(co.opportunity_id);
  return { ok: true };
}

/** Rename an estimate section. */
export async function renameOpportunityGroupAction(formData: FormData): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  const id = str(formData, "id");
  const opportunityId = str(formData, "opportunity_id");
  const name = str(formData, "name").slice(0, 80);
  if (!id || !opportunityId) return { ok: false, error: "Missing section." };
  if (!name) return { ok: false, error: "Give the section a name." };
  const { error: e } = await supabase.from("av_opportunity_groups").update({ name }).eq("id", id);
  if (e) return { ok: false, error: e.message };
  revalidateQuote(opportunityId);
  return { ok: true };
}

/** Move a section up or down among the estimate's sections. */
export async function moveOpportunityGroupAction(formData: FormData): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  const id = str(formData, "id");
  const opportunityId = str(formData, "opportunity_id");
  const delta = str(formData, "direction") === "up" ? -1 : 1;
  if (!id || !opportunityId) return { ok: false, error: "Missing section." };
  const { data: groups, error: e } = await supabase
    .from("av_opportunity_groups")
    .select("id")
    .eq("opportunity_id", opportunityId)
    .order("sort_order")
    .order("created_at");
  if (e) return { ok: false, error: e.message };
  const order = moveId((groups ?? []).map((g) => String(g.id)), id, delta);
  for (let i = 0; i < order.length; i++) {
    const { error: ue } = await supabase.from("av_opportunity_groups").update({ sort_order: i }).eq("id", order[i]);
    if (ue) return { ok: false, error: ue.message };
  }
  revalidateQuote(opportunityId);
  return { ok: true };
}

/** Move an item up or down inside its section (package contents go with the package). */
export async function moveOpportunityLineAction(formData: FormData): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  const id = str(formData, "id");
  const opportunityId = str(formData, "opportunity_id");
  const delta = str(formData, "direction") === "up" ? -1 : 1;
  if (!id || !opportunityId) return { ok: false, error: "Missing line." };
  const { data: line } = await supabase.from("av_opportunity_lines").select("group_id").eq("id", id).maybeSingle();
  if (!line) return { ok: false, error: "Line not found." };
  let q = supabase.from("av_opportunity_lines").select("id, parent_line_id").eq("opportunity_id", opportunityId);
  q = line.group_id ? q.eq("group_id", line.group_id) : q.is("group_id", null);
  const { data: lines, error: e } = await q.order("sort_order").order("created_at");
  if (e) return { ok: false, error: e.message };
  const order = moveLineInSection(
    (lines ?? []).map((l) => ({ id: String(l.id), parent_line_id: (l.parent_line_id as string | null) ?? null })),
    id,
    delta,
  );
  for (let i = 0; i < order.length; i++) {
    const { error: ue } = await supabase.from("av_opportunity_lines").update({ sort_order: i }).eq("id", order[i]);
    if (ue) return { ok: false, error: ue.message };
  }
  revalidateQuote(opportunityId);
  return { ok: true };
}

/** Move an item (and anything packaged under it) to another section, at the end. */
export async function moveOpportunityLineToGroupAction(formData: FormData): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  const id = str(formData, "id");
  const opportunityId = str(formData, "opportunity_id");
  const groupId = nullableId(formData, "group_id");
  if (!id || !opportunityId) return { ok: false, error: "Missing line." };
  let q = supabase.from("av_opportunity_lines").select("id", { count: "exact", head: true }).eq("opportunity_id", opportunityId);
  q = groupId ? q.eq("group_id", groupId) : q.is("group_id", null);
  const { count } = await q;
  const base = count ?? 0;
  const { error: e1 } = await supabase.from("av_opportunity_lines").update({ group_id: groupId, sort_order: base }).eq("id", id);
  if (e1) return { ok: false, error: e1.message };
  const { error: e2 } = await supabase
    .from("av_opportunity_lines")
    .update({ group_id: groupId, sort_order: base + 1 })
    .eq("parent_line_id", id);
  if (e2) return { ok: false, error: e2.message };
  revalidateQuote(opportunityId);
  return { ok: true };
}
