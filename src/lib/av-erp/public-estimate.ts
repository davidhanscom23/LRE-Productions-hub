import "server-only";

import { randomBytes } from "node:crypto";
import { loadBillingType } from "@/lib/av-erp/billing-type";
import { formatPartyAddress } from "@/lib/av-erp/documents/types";
import {
  buildCustomerEstimate,
  type CustomerEstimate,
  type CustomerEstimateParty,
} from "@/lib/av-erp/estimate-view";
import { resolveInvoiceTaxRatePct } from "@/lib/av-erp/invoicing";
import { loadShopDefaultSalesTaxRatePct } from "@/lib/av-erp/shop-tax";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  AV_OPPORTUNITY_STATUS_LABELS,
  type AvOpportunityStatus,
} from "@/lib/av-erp/types";

export const ESTIMATE_TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function newEstimateShareToken(): string {
  return randomBytes(18).toString("base64url");
}

type OppRow = {
  id: string;
  reference: string;
  subject: string;
  status?: AvOpportunityStatus;
  customer_id: string | null;
  venue_id: string | null;
  gear_starts_at: string | null;
  gear_ends_at: string | null;
  charge_starts_at: string | null;
  charge_ends_at: string | null;
  surcharge_pct: number;
  discount_pct: number;
  venue_markup_pct: number;
  venue_markup_enabled: boolean;
  transport_notes: string;
  notes: string;
  share_token: string | null;
  share_enabled: boolean;
  estimate_response: "accepted" | "declined" | null;
  estimate_responded_at: string | null;
  estimate_response_note: string;
  estimate_signer_name: string;
  contract_response: "accepted" | "declined" | null;
  contract_responded_at: string | null;
  contract_response_note: string;
  contract_signer_name: string;
};

const OPP_SELECT =
  "id, reference, subject, status, customer_id, venue_id, gear_starts_at, gear_ends_at, charge_starts_at, charge_ends_at, surcharge_pct, discount_pct, venue_markup_pct, venue_markup_enabled, transport_notes, notes, share_token, share_enabled, estimate_response, estimate_responded_at, estimate_response_note, estimate_signer_name, contract_response, contract_responded_at, contract_response_note, contract_signer_name";

const OPP_SELECT_MID =
  "id, reference, subject, status, customer_id, venue_id, gear_starts_at, gear_ends_at, charge_starts_at, charge_ends_at, surcharge_pct, discount_pct, venue_markup_pct, venue_markup_enabled, transport_notes, notes, share_token, share_enabled, estimate_response, estimate_responded_at, estimate_response_note";

const OPP_SELECT_FALLBACK =
  "id, reference, subject, status, customer_id, venue_id, gear_starts_at, gear_ends_at, charge_starts_at, charge_ends_at, surcharge_pct, discount_pct, venue_markup_pct, venue_markup_enabled, transport_notes, notes, share_token, share_enabled";

function emptyContractFields() {
  return {
    estimate_signer_name: "",
    contract_response: null as "accepted" | "declined" | null,
    contract_responded_at: null as string | null,
    contract_response_note: "",
    contract_signer_name: "",
  };
}

function mapParty(
  row: {
    name?: string | null;
    contact_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    region?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null,
): CustomerEstimateParty | null {
  if (!row?.name) return null;
  return {
    name: row.name,
    contactName: row.contact_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    addressLines: formatPartyAddress(row),
  };
}

export async function loadCustomerEstimateByOpportunityId(
  opportunityId: string,
): Promise<CustomerEstimate | null> {
  const supabase = createServiceClient();
  const { data: opp } = await supabase
    .from("av_opportunities")
    .select(OPP_SELECT)
    .eq("id", opportunityId)
    .maybeSingle();
  if (!opp) return null;
  return assembleEstimate(opp as OppRow, supabase);
}

export async function loadCustomerEstimateByToken(
  token: string,
): Promise<CustomerEstimate | null> {
  if (!ESTIMATE_TOKEN_RE.test(token)) return null;
  const supabase = createServiceClient();
  const firstTry = await supabase
    .from("av_opportunities")
    .select(OPP_SELECT)
    .eq("share_token", token)
    .eq("share_enabled", true)
    .maybeSingle();
  const error = firstTry.error;
  let opp = firstTry.data;
  if (error || !opp) {
    const mid = await supabase
      .from("av_opportunities")
      .select(OPP_SELECT_MID)
      .eq("share_token", token)
      .eq("share_enabled", true)
      .maybeSingle();
    if (mid.data) {
      opp = { ...mid.data, ...emptyContractFields() };
    } else {
      const fallback = await supabase
        .from("av_opportunities")
        .select(OPP_SELECT_FALLBACK)
        .eq("share_token", token)
        .eq("share_enabled", true)
        .maybeSingle();
      if (!fallback.data) return null;
      opp = {
        ...fallback.data,
        estimate_response: null,
        estimate_responded_at: null,
        estimate_response_note: "",
        ...emptyContractFields(),
      };
    }
  }
  return assembleEstimate(opp as OppRow, supabase);
}

async function assembleEstimate(
  opp: OppRow,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<CustomerEstimate> {
  const [groupsRes, linesRes, customerRes, venueRes, termsRes, shopTaxRate] =
    await Promise.all([
      supabase
        .from("av_opportunity_groups")
        .select("id, name, sort_order")
        .eq("opportunity_id", opp.id)
        .order("sort_order"),
      supabase
        .from("av_opportunity_lines")
        .select(
          "id, group_id, description, qty, unit_price, discount_pct, sort_order, product_id, service_id, text_kind",
        )
        .eq("opportunity_id", opp.id)
        .order("sort_order"),
      opp.customer_id
        ? supabase
            .from("av_customers")
            .select(
              "name, contact_name, email, phone, address_line1, address_line2, city, region, postal_code, country, tax_exempt",
            )
            .eq("id", opp.customer_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      opp.venue_id
        ? supabase
            .from("av_job_venues")
            .select(
              "name, contact_name, email, phone, address_line1, address_line2, city, region, postal_code, country",
            )
            .eq("id", opp.venue_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("av_document_templates")
        .select("terms")
        .eq("kind", "estimate")
        .eq("is_active", true)
        .eq("is_default", true)
        .limit(1)
        .maybeSingle(),
      loadShopDefaultSalesTaxRatePct(supabase),
    ]);

  let lines = linesRes.data ?? [];
  if (linesRes.error) {
    const fallbackLines = await supabase
      .from("av_opportunity_lines")
      .select(
        "id, group_id, description, qty, unit_price, discount_pct, sort_order",
      )
      .eq("opportunity_id", opp.id)
      .order("sort_order");
    lines = (fallbackLines.data ?? []).map((l) => ({
      ...l,
      product_id: null,
      service_id: null,
      text_kind: null,
    }));
  }

  const customer = mapParty(customerRes.data);
  const venue = mapParty(venueRes.data);
  const customerTaxExempt = Boolean(
    (customerRes.data as { tax_exempt?: boolean } | null)?.tax_exempt,
  );
  const taxRatePct = resolveInvoiceTaxRatePct({
    customerTaxExempt,
    shopDefaultRatePct: shopTaxRate,
  });

  const billingType = await loadBillingType(supabase, "av_opportunities", opp.id);
  const estimate = buildCustomerEstimate({
    billingType,
    reference: opp.reference,
    subject: opp.subject,
    customerName: customer?.name ?? null,
    venueName: venue?.name ?? null,
    customer,
    venue,
    chargeStartsAt: opp.charge_starts_at,
    chargeEndsAt: opp.charge_ends_at,
    gearStartsAt: opp.gear_starts_at,
    gearEndsAt: opp.gear_ends_at,
    notes: opp.notes ?? "",
    transportNotes: opp.transport_notes ?? "",
    surchargePct: Number(opp.surcharge_pct) || 0,
    discountPct: Number(opp.discount_pct) || 0,
    venueMarkupEnabled: !!opp.venue_markup_enabled,
    venueMarkupPct: Number(opp.venue_markup_pct) || 0,
    taxRatePct,
    statusLabel: opp.status
      ? AV_OPPORTUNITY_STATUS_LABELS[opp.status]
      : undefined,
    groups: (groupsRes.data ?? []).map((g) => ({
      id: g.id as string,
      name: g.name as string,
      sort_order: Number(g.sort_order) || 0,
    })),
    lines: lines.map((l) => ({
      id: l.id as string,
      group_id: (l.group_id as string | null) ?? null,
      description: (l.description as string) || "",
      qty: Number(l.qty) || 0,
      unit_price: Number(l.unit_price) || 0,
      discount_pct: Number(l.discount_pct) || 0,
      sort_order: Number(l.sort_order) || 0,
      product_id: (l.product_id as string | null) ?? null,
      service_id: (l.service_id as string | null) ?? null,
      text_kind: (l.text_kind as "rental" | "sale" | null) ?? null,
    })),
  });

  // Template table may be missing until migration 151 — ignore soft errors.
  const terms =
    !termsRes.error && termsRes.data
      ? String(termsRes.data.terms ?? "")
      : "";

  return {
    ...estimate,
    estimateResponse: opp.estimate_response ?? null,
    estimateRespondedAt: opp.estimate_responded_at ?? null,
    estimateResponseNote: opp.estimate_response_note ?? "",
    estimateSignerName: opp.estimate_signer_name ?? "",
    contractResponse: opp.contract_response ?? null,
    contractRespondedAt: opp.contract_responded_at ?? null,
    contractResponseNote: opp.contract_response_note ?? "",
    contractSignerName: opp.contract_signer_name ?? "",
    contactName: customer?.contactName || customer?.name || "",
    contactEmail: customer?.email || "",
    terms,
  };
}
