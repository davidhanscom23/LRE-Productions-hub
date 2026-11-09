/**
 * Customer-facing estimate projection for AV opportunities.
 * Never includes venue markup %, amount, or pre-markup unit prices.
 */

import {
  invoiceGrandTotal,
  invoiceTaxAmount,
} from "@/lib/av-erp/invoicing";
import {
  computeOpportunityPrices,
  customerUnitPrice,
  lineTotal,
} from "@/lib/av-erp/pricing";

export type EstimateLineInput = {
  id: string;
  group_id: string | null;
  description: string;
  qty: number;
  /** Staff real unit price (pre-markup). */
  unit_price: number;
  discount_pct: number;
  sort_order: number;
  /** Optional Current-RMS Type column: Rental / Sale / Service. */
  typeLabel?: string | null;
  product_id?: string | null;
  service_id?: string | null;
  text_kind?: "rental" | "sale" | null;
};

export type EstimateGroupInput = {
  id: string;
  name: string;
  sort_order: number;
};

export type CustomerEstimateLine = {
  id: string;
  groupId: string | null;
  groupName: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
  lineTotal: number;
  typeLabel: string;
};

export type CustomerEstimateParty = {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  addressLines: string[];
};

export type CustomerEstimate = {
  reference: string;
  subject: string;
  customerName: string | null;
  venueName: string | null;
  customer: CustomerEstimateParty | null;
  venue: CustomerEstimateParty | null;
  chargeStartsAt: string | null;
  chargeEndsAt: string | null;
  gearStartsAt: string | null;
  gearEndsAt: string | null;
  notes: string;
  transportNotes: string;
  lines: CustomerEstimateLine[];
  sections: { name: string; lines: CustomerEstimateLine[] }[];
  linesSubtotal: number;
  surchargeAmount: number;
  discountAmount: number;
  /** Sales tax % applied to customer total (shop default / exempt). */
  taxRatePct: number;
  taxAmount: number;
  /** Customer-facing grand total incl. tax (markup folded into prices; never labeled). */
  total: number;
  estimateResponse?: "accepted" | "declined" | null;
  estimateRespondedAt?: string | null;
  estimateResponseNote?: string;
  estimateSignerName?: string;
  contractResponse?: "accepted" | "declined" | null;
  contractRespondedAt?: string | null;
  contractResponseNote?: string;
  contractSignerName?: string;
  /** Prefill for customer e-sign form. */
  contactEmail?: string;
  contactName?: string;
  terms?: string;
  /** Opportunity status for Contract PDF labeling. */
  statusLabel?: string;
  billingType?: "direct" | "venue";
};

export function resolveLineTypeLabel(input: {
  typeLabel?: string | null;
  product_id?: string | null;
  service_id?: string | null;
  text_kind?: "rental" | "sale" | null;
}): string {
  const explicit = (input.typeLabel ?? "").trim();
  if (explicit) return explicit;
  if (input.service_id) return "Service";
  if (input.text_kind === "sale") return "Sale";
  if (input.text_kind === "rental") return "Rental";
  if (input.product_id) return "Rental";
  return "Rental";
}

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function buildCustomerEstimate(input: {
  reference: string;
  subject: string;
  customerName?: string | null;
  venueName?: string | null;
  customer?: CustomerEstimateParty | null;
  venue?: CustomerEstimateParty | null;
  chargeStartsAt?: string | null;
  chargeEndsAt?: string | null;
  gearStartsAt?: string | null;
  gearEndsAt?: string | null;
  notes?: string;
  transportNotes?: string;
  surchargePct?: number;
  discountPct?: number;
  venueMarkupEnabled?: boolean;
  venueMarkupPct?: number;
  /** venue = the venue pays us and bills the client; no surcharge row. */
  billingType?: "direct" | "venue";
  statusLabel?: string;
  terms?: string;
  /** Sales tax % (0 when exempt / unset). */
  taxRatePct?: number;
  groups: EstimateGroupInput[];
  lines: EstimateLineInput[];
}): CustomerEstimate {
  const billingType = input.billingType === "venue" ? "venue" : "direct";
  const surchargeIn = billingType === "venue" ? 0 : (input.surchargePct ?? 0);
  const markupOn = !!input.venueMarkupEnabled;
  const markupPct = input.venueMarkupPct ?? 0;

  const sortedGroups = [...input.groups].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
  );
  const groupName = new Map(sortedGroups.map((g) => [g.id, g.name]));

  const sortedLines = [...input.lines].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  const customerLines: CustomerEstimateLine[] = sortedLines.map((line) => {
    const unit = customerUnitPrice(line.unit_price, markupPct, markupOn);
    const disc = Math.min(100, Math.max(0, line.discount_pct));
    return {
      id: line.id,
      groupId: line.group_id,
      groupName: line.group_id ? (groupName.get(line.group_id) ?? null) : null,
      description: line.description,
      qty: line.qty,
      unitPrice: unit,
      discountPct: disc,
      lineTotal: lineTotal({
        qty: line.qty,
        unitPrice: unit,
        discountPct: disc,
      }),
      typeLabel: resolveLineTypeLabel(line),
    };
  });

  const prices = computeOpportunityPrices({
    lines: sortedLines.map((l) => ({
      qty: l.qty,
      unitPrice: l.unit_price,
      discountPct: l.discount_pct,
    })),
    surchargePct: surchargeIn,
    discountPct: input.discountPct ?? 0,
    venueMarkupEnabled: markupOn,
    venueMarkupPct: markupPct,
  });

  // Apply the same surcharge/discount % on marked-up line sums so the
  // customer surface never needs a markup row. Grand total uses the
  // authoritative helper (matches staff "Customer total").
  const customerLineSum = roundMoney(
    customerLines.reduce((s, l) => s + l.lineTotal, 0),
  );
  const surchargePct = Math.min(100, Math.max(0, surchargeIn));
  const discountPct = Math.min(100, Math.max(0, input.discountPct ?? 0));
  const surchargeAmount = roundMoney(customerLineSum * (surchargePct / 100));
  const afterSurcharge = roundMoney(customerLineSum + surchargeAmount);
  const discountAmount = roundMoney(afterSurcharge * (discountPct / 100));

  const sections: { name: string; lines: CustomerEstimateLine[] }[] = [];
  for (const g of sortedGroups) {
    const gl = customerLines.filter((l) => l.groupId === g.id);
    if (gl.length) sections.push({ name: g.name, lines: gl });
  }
  const ungrouped = customerLines.filter((l) => !l.groupId);
  if (ungrouped.length) {
    sections.push({ name: "Items", lines: ungrouped });
  }

  return {
    reference: input.reference,
    subject: input.subject,
    customerName: input.customerName ?? input.customer?.name ?? null,
    venueName: input.venueName ?? input.venue?.name ?? null,
    customer: input.customer ?? null,
    venue: input.venue ?? null,
    chargeStartsAt: input.chargeStartsAt ?? null,
    chargeEndsAt: input.chargeEndsAt ?? null,
    gearStartsAt: input.gearStartsAt ?? null,
    gearEndsAt: input.gearEndsAt ?? null,
    notes: input.notes ?? "",
    transportNotes: input.transportNotes ?? "",
    lines: customerLines,
    sections,
    linesSubtotal: customerLineSum,
    surchargeAmount,
    discountAmount,
    taxRatePct: Math.max(0, Math.min(100, Number(input.taxRatePct) || 0)),
    taxAmount: invoiceTaxAmount(
      prices.customerTotal,
      Math.max(0, Math.min(100, Number(input.taxRatePct) || 0)),
    ),
    total: invoiceGrandTotal(
      prices.customerTotal,
      invoiceTaxAmount(
        prices.customerTotal,
        Math.max(0, Math.min(100, Number(input.taxRatePct) || 0)),
      ),
    ),
    statusLabel: input.statusLabel,
    billingType,
    terms: input.terms ?? "",
  };
}
