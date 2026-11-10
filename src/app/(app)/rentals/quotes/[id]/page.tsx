import { notFound, redirect } from "next/navigation";
import { QuoteEditorClient } from "@/components/av-erp/quote-editor-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import type { HoldWindow } from "@/lib/av-erp/availability";
import { loadBillingType } from "@/lib/av-erp/billing-type";
import {
  loadEstimateProjectLink,
  loadLinkableProjects,
} from "@/lib/event-checklist/project-link";
import { loadJobFinanceForOpportunity } from "@/lib/av-erp/job-finance";
import {
  accessoryRollupUnitPrice,
  effectiveProductUnitPrice,
} from "@/lib/av-erp/product-accessories";
import { loadAcceptedSignaturesForOpportunity } from "@/lib/av-erp/signed-pdf-archive";
import type {
  AvChangeOrder,
  AvChangeOrderLine,
  AvCustomer,
  AvJobCost,
  AvJobVenue,
  AvOpportunity,
  AvOpportunityAttachment,
  AvOpportunityGroup,
  AvOpportunityLine,
  AvOpportunityNote,
  AvOpportunityPlanMarker,
  AvOpportunityRender,
  AvProduct,
  AvRateDefinition,
  AvService,
  AvSupplier,
} from "@/lib/av-erp/types";
import { isGeminiConfigured } from "@/lib/gemini/credentials";
import { canManageHoneyBookCrm } from "@/lib/honeybook/access";
import { mergeCategories } from "@/lib/services-catalog/category-list";
import { createClient } from "@/lib/supabase/server";
import { canAccessVidentAv } from "@/lib/vident-av-access";

const AV_OPP_MEDIA_BUCKET = "av-opportunity-media";
const SIGNED_URL_TTL_SEC = 60 * 60;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata() {
  return { title: "Estimate — LRE AV" };
}

export default async function AvQuoteDetailPage({ params }: Props) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessVidentAv(profile)) redirect("/rentals");

  const supabase = await createClient();
  let { data: opportunity, error } = await supabase
    .from("av_opportunities")
    .select(
      "id, reference, subject, status, customer_id, venue_id, rate_definition_id, gear_starts_at, gear_ends_at, charge_starts_at, charge_ends_at, bill_whole_event, surcharge_pct, discount_pct, venue_markup_pct, venue_markup_enabled, transport_notes, notes, is_template, source_opportunity_id, external_rms_id, share_token, share_enabled, estimate_response, estimate_responded_at, estimate_response_note, estimate_signer_name, contract_response, contract_responded_at, contract_response_note, contract_signer_name, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  // Pre-152 / pre-151 DBs lack e-sign columns — fall back so the quote still loads.
  if (error) {
    const mid = await supabase
      .from("av_opportunities")
      .select(
        "id, reference, subject, status, customer_id, venue_id, rate_definition_id, gear_starts_at, gear_ends_at, charge_starts_at, charge_ends_at, bill_whole_event, surcharge_pct, discount_pct, venue_markup_pct, venue_markup_enabled, transport_notes, notes, is_template, source_opportunity_id, external_rms_id, share_token, share_enabled, estimate_response, estimate_responded_at, estimate_response_note, created_at, updated_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (mid.data) {
      opportunity = {
        ...mid.data,
        estimate_signer_name: "",
        contract_response: null,
        contract_responded_at: null,
        contract_response_note: "",
        contract_signer_name: "",
      };
      error = mid.error;
    } else {
      const fallback = await supabase
        .from("av_opportunities")
        .select(
          "id, reference, subject, status, customer_id, venue_id, rate_definition_id, gear_starts_at, gear_ends_at, charge_starts_at, charge_ends_at, bill_whole_event, surcharge_pct, discount_pct, venue_markup_pct, venue_markup_enabled, transport_notes, notes, is_template, source_opportunity_id, external_rms_id, share_token, share_enabled, created_at, updated_at",
        )
        .eq("id", id)
        .maybeSingle();
      opportunity = fallback.data
        ? {
            ...fallback.data,
            estimate_response: null,
            estimate_responded_at: null,
            estimate_response_note: "",
            estimate_signer_name: "",
            contract_response: null,
            contract_responded_at: null,
            contract_response_note: "",
            contract_signer_name: "",
          }
        : null;
      error = fallback.error;
    }
  }

  if (error || !opportunity) notFound();

  const [
    groupsRes,
    linesRes,
    holdsRes,
    customersRes,
    venuesRes,
    ratesRes,
    productsRes,
    servicesRes,
    accessoriesRes,
    costsRes,
    suppliersRes,
    crewRes,
    attachmentsRes,
    markersRes,
    rendersRes,
    notesRes,
    changeOrdersRes,
  ] = await Promise.all([
    supabase
      .from("av_opportunity_groups")
      .select("id, opportunity_id, name, sort_order")
      .eq("opportunity_id", id)
      .order("sort_order"),
    supabase
      .from("av_opportunity_lines")
      .select(
        "id, opportunity_id, group_id, parent_line_id, product_id, service_id, description, qty, unit_price, discount_pct, sort_order, text_kind",
      )
      .eq("opportunity_id", id)
      .order("sort_order"),
    supabase
      .from("av_holds")
      .select("product_id, qty, starts_at, ends_at, opportunity_id")
      .order("starts_at"),
    supabase
      .from("av_customers")
      .select("id, name")
      .eq("is_retired", false)
      .order("name"),
    supabase
      .from("av_job_venues")
      .select("id, name")
      .eq("is_retired", false)
      .order("name"),
    supabase
      .from("av_rate_definitions")
      .select(
        "id, name, charged_mode, day_count_rule, leeway_minutes, fewest_units, billable_days_map, is_default, is_active, sort_order",
      )
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("av_products")
      .select(
        "id, group_id, name, code, description, kind, rental_price, sale_price, replacement_charge, qty_owned, buffer_pct, turnaround_hours, weight_lbs, photo_path, is_active, external_rms_id",
      )
      .eq("is_active", true)
      .order("name")
      .limit(500),
    supabase
      .from("av_services")
      .select(
        "id, name, code, description, kind, unit_price, is_active, external_rms_id",
      )
      .eq("is_active", true)
      .order("name")
      .limit(200),
    supabase
      .from("av_product_accessories")
      .select("*"),
    supabase
      .from("av_job_costs")
      .select(
        "id, opportunity_id, amount, category, supplier_id, description, cost_date, booking_id, created_at, updated_at",
      )
      .eq("opportunity_id", id)
      .order("cost_date", { ascending: false }),
    supabase
      .from("av_suppliers")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("av_contractor_bookings")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", id)
      .neq("status", "cancelled"),
    supabase
      .from("av_opportunity_attachments")
      .select(
        "id, opportunity_id, kind, storage_path, file_name, content_type, created_at",
      )
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("av_opportunity_plan_markers")
      .select(
        "id, opportunity_id, attachment_id, line_id, label, x, y",
      )
      .eq("opportunity_id", id),
    supabase
      .from("av_opportunity_renders")
      .select(
        "id, opportunity_id, attachment_id, storage_path, status, prompt, error_message, show_on_estimate, approved_at, created_at",
      )
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("av_opportunity_notes")
      .select(
        "id, opportunity_id, body, author_id, created_at, profiles!av_opportunity_notes_author_id_fkey ( full_name )",
      )
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("av_change_orders")
      .select(
        "id, opportunity_id, number, subject, summary, amount_delta, status, share_token, share_enabled, response_note, signer_name, responded_at, created_by, created_at, updated_at",
      )
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const changeOrders = changeOrdersRes.error
    ? []
    : ((changeOrdersRes.data ?? []).map((row) => ({
        ...row,
        amount_delta: Number(row.amount_delta) || 0,
      })) as AvChangeOrder[]);

  const changeOrderLinesByCoId: Record<string, AvChangeOrderLine[]> = {};
  if (changeOrders.length > 0) {
    const { data: coLines } = await supabase
      .from("av_change_order_lines")
      .select(
        "id, change_order_id, source_line_id, product_id, service_id, description, qty, unit_price, discount_pct, sort_order, text_kind, apply_mode, created_at",
      )
      .in(
        "change_order_id",
        changeOrders.map((c) => c.id),
      )
      .order("sort_order");
    for (const row of coLines ?? []) {
      const coId = row.change_order_id as string;
      const list = changeOrderLinesByCoId[coId] ?? [];
      list.push({
        ...(row as AvChangeOrderLine),
        qty: Number(row.qty) || 0,
        unit_price: Number(row.unit_price) || 0,
        discount_pct: Number(row.discount_pct) || 0,
        sort_order: Number(row.sort_order) || 0,
        text_kind: (row.text_kind as "rental" | "sale" | null) ?? null,
        apply_mode:
          (row.apply_mode as AvChangeOrderLine["apply_mode"]) || "add",
      });
      changeOrderLinesByCoId[coId] = list;
    }
  }

  const holds: HoldWindow[] = (holdsRes.data ?? []).map((h) => ({
    product_id: h.product_id as string,
    qty: Number(h.qty),
    starts_at: h.starts_at as string,
    ends_at: h.ends_at as string,
    opportunity_id: h.opportunity_id as string,
  }));

  let finance = null;
  try {
    finance = await loadJobFinanceForOpportunity(supabase, id);
  } catch {
    finance = null;
  }

  const costs = costsRes.error ? [] : ((costsRes.data ?? []) as AvJobCost[]);
  const suppliers = suppliersRes.error
    ? []
    : ((suppliersRes.data ?? []) as Pick<AvSupplier, "id" | "name">[]);

  const lines = ((linesRes.data ?? []) as AvOpportunityLine[]).map((l) => ({
    ...l,
    text_kind: l.text_kind ?? null,
  }));

  const products = (productsRes.data ?? []) as AvProduct[];
  const childPriceById = new Map(
    products.map((p) => [p.id, Number(p.rental_price) || 0]),
  );
  const childNameById = new Map(products.map((p) => [p.id, p.name]));
  const missingChildIds = Array.from(
    new Set(
      (accessoriesRes.data ?? [])
        .map((row) => row.child_product_id as string)
        .filter((cid) => !childPriceById.has(cid)),
    ),
  );
  if (missingChildIds.length > 0) {
    const { data: missingChildren } = await supabase
      .from("av_products")
      .select("id, name, rental_price")
      .in("id", missingChildIds);
    for (const c of missingChildren ?? []) {
      childPriceById.set(c.id as string, Number(c.rental_price) || 0);
      childNameById.set(c.id as string, c.name as string);
    }
  }
  const rollupParts = new Map<string, { qty: number; unitPrice: number }[]>();
  /** Optional Comes-with items per product (not auto-added to estimates). */
  const optionalAccessories: {
    parent_product_id: string;
    child_product_id: string;
    qty: number;
    name: string;
    price: number;
  }[] = [];
  for (const row of accessoriesRes.data ?? []) {
    if (row.is_optional) {
      optionalAccessories.push({
        parent_product_id: row.parent_product_id as string,
        child_product_id: row.child_product_id as string,
        qty: Number(row.qty) || 1,
        name: childNameById.get(row.child_product_id as string) ?? "Item",
        price: childPriceById.get(row.child_product_id as string) ?? 0,
      });
      continue;
    }
    const parentId = row.parent_product_id as string;
    const list = rollupParts.get(parentId) ?? [];
    list.push({
      qty: Number(row.qty) || 1,
      unitPrice: childPriceById.get(row.child_product_id as string) ?? 0,
    });
    rollupParts.set(parentId, list);
  }
  /** Effective unit price for the product picker (listed or Comes-with rollup). */
  const productQuotePrices: Record<string, number> = {};
  for (const p of products) {
    productQuotePrices[p.id] = effectiveProductUnitPrice(
      Number(p.rental_price) || 0,
      accessoryRollupUnitPrice(rollupParts.get(p.id) ?? []),
    );
  }

  const attachments = attachmentsRes.error
    ? []
    : ((attachmentsRes.data ?? []) as AvOpportunityAttachment[]);
  const renders = rendersRes.error
    ? []
    : ((rendersRes.data ?? []) as AvOpportunityRender[]);

  const pathsToSign = [
    ...attachments.map((a) => a.storage_path),
    ...renders
      .map((r) => r.storage_path)
      .filter((p): p is string => Boolean(p)),
  ];
  const signedByPath = new Map<string, string>();
  if (pathsToSign.length > 0) {
    const { data: signed } = await supabase.storage
      .from(AV_OPP_MEDIA_BUCKET)
      .createSignedUrls(pathsToSign, SIGNED_URL_TTL_SEC);
    for (const row of signed ?? []) {
      if (row.path && row.signedUrl) signedByPath.set(row.path, row.signedUrl);
    }
  }

  // HoneyBook services catalog (migration 180/188). Tolerant: no table just means no catalog picker yet.
  const [catalogRes, customCatRes] = await Promise.all([
    supabase
      .from("service_catalog_items")
      .select("id, name, description, category, unit_price")
      .eq("active", true)
      .order("category")
      .order("name")
      .limit(2000),
    supabase.from("service_categories").select("name").order("sort_order").order("name"),
  ]);
  const catalogItems = catalogRes.error
    ? []
    : (catalogRes.data ?? []).map((c) => ({
        id: c.id as string,
        name: String(c.name),
        description: String(c.description ?? ""),
        category: String(c.category ?? "Other"),
        unitPrice: Number(c.unit_price) || 0,
      }));
  const catalogCategories = mergeCategories(
    customCatRes.error ? [] : (customCatRes.data ?? []).map((c) => String(c.name)),
    catalogItems.map((c) => c.category),
  );

  let acceptedSignatures: Awaited<
    ReturnType<typeof loadAcceptedSignaturesForOpportunity>
  > = [];
  try {
    acceptedSignatures = await loadAcceptedSignaturesForOpportunity(id);
  } catch {
    acceptedSignatures = [];
  }

  const linkedProjectId = await loadEstimateProjectLink(supabase, id);
  const linkableProjects = await loadLinkableProjects(supabase, linkedProjectId);

  return (
    <QuoteEditorClient
      catalogItems={catalogItems}
      catalogCategories={catalogCategories}
      canEditCatalog={canManageHoneyBookCrm(profile.role)}
      opportunity={{
        ...(opportunity as AvOpportunity),
        billing_type: await loadBillingType(supabase, "av_opportunities", id),
        honeybook_project_id: linkedProjectId,
      }}
      projects={linkableProjects}
      groups={(groupsRes.data ?? []) as AvOpportunityGroup[]}
      lines={lines}
      holds={holds}
      customers={(customersRes.data ?? []) as Pick<AvCustomer, "id" | "name">[]}
      venues={(venuesRes.data ?? []) as Pick<AvJobVenue, "id" | "name">[]}
      rates={(ratesRes.data ?? []) as AvRateDefinition[]}
      products={products}
      productQuotePrices={productQuotePrices}
      optionalAccessories={optionalAccessories}
      services={(servicesRes.data ?? []) as AvService[]}
      finance={finance}
      costs={costs}
      suppliers={suppliers}
      crewCount={crewRes.count ?? 0}
      roomPhotos={attachments.map((a) => ({
        ...a,
        url: signedByPath.get(a.storage_path) ?? null,
      }))}
      planMarkers={
        markersRes.error
          ? []
          : ((markersRes.data ?? []) as AvOpportunityPlanMarker[])
      }
      renders={renders.map((r) => ({
        ...r,
        url: r.storage_path
          ? (signedByPath.get(r.storage_path) ?? null)
          : null,
      }))}
      venuePlanError={
        attachmentsRes.error?.message ||
        markersRes.error?.message ||
        rendersRes.error?.message ||
        null
      }
      geminiConfigured={isGeminiConfigured()}
      discussionNotes={
        notesRes.error
          ? []
          : ((notesRes.data ?? []).map((row) => {
              const author = row.profiles as
                | { full_name: string | null }
                | { full_name: string | null }[]
                | null;
              const a = Array.isArray(author) ? author[0] : author;
              return {
                id: row.id as string,
                opportunity_id: row.opportunity_id as string,
                body: row.body as string,
                author_id: (row.author_id as string | null) ?? null,
                created_at: row.created_at as string,
                author_name: a?.full_name ?? null,
              } satisfies AvOpportunityNote;
            }) as AvOpportunityNote[])
      }
      changeOrders={changeOrders}
      changeOrderLinesByCoId={changeOrderLinesByCoId}
      acceptedSignatures={acceptedSignatures}
    />
  );
}
