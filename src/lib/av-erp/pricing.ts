/**
 * Opportunity pricing helpers (KM parity).
 * Venue markup is quote-level, hidden from customer-facing totals.
 */

export type LinePriceInput = {
  qty: number;
  unitPrice: number;
  discountPct?: number;
};

export type OpportunityPriceInput = {
  lines: LinePriceInput[];
  surchargePct?: number;
  discountPct?: number;
  venueMarkupPct?: number;
  venueMarkupEnabled?: boolean;
};

export type OpportunityPriceBreakdown = {
  /** Sum of line totals after line discounts, before quote surcharge/discount/markup. */
  linesSubtotal: number;
  surchargeAmount: number;
  discountAmount: number;
  /** Pre-markup total (staff “real” total). */
  realTotal: number;
  venueMarkupAmount: number;
  /** What the customer sees on estimate/invoice. */
  customerTotal: number;
};

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineTotal(line: LinePriceInput): number {
  const disc = Math.min(100, Math.max(0, line.discountPct ?? 0)) / 100;
  return roundMoney(line.qty * line.unitPrice * (1 - disc));
}

/** Customer-facing unit price when venue markup is on (cent-rounded). */
export function customerUnitPrice(
  realUnitPrice: number,
  venueMarkupPct: number,
  enabled: boolean,
): number {
  if (!enabled || venueMarkupPct <= 0) return roundMoney(realUnitPrice);
  return roundMoney(realUnitPrice * (1 + venueMarkupPct / 100));
}

export function computeOpportunityPrices(
  input: OpportunityPriceInput,
): OpportunityPriceBreakdown {
  const linesSubtotal = roundMoney(
    input.lines.reduce((sum, line) => sum + lineTotal(line), 0),
  );
  const surchargePct = Math.min(100, Math.max(0, input.surchargePct ?? 0));
  const discountPct = Math.min(100, Math.max(0, input.discountPct ?? 0));
  const surchargeAmount = roundMoney(linesSubtotal * (surchargePct / 100));
  const afterSurcharge = roundMoney(linesSubtotal + surchargeAmount);
  const discountAmount = roundMoney(afterSurcharge * (discountPct / 100));
  const realTotal = roundMoney(afterSurcharge - discountAmount);

  const markupOn =
    !!input.venueMarkupEnabled && (input.venueMarkupPct ?? 0) > 0;
  const venueMarkupPct = markupOn ? (input.venueMarkupPct ?? 0) : 0;
  const venueMarkupAmount = markupOn
    ? roundMoney(realTotal * (venueMarkupPct / 100))
    : 0;
  const customerTotal = roundMoney(realTotal + venueMarkupAmount);

  return {
    linesSubtotal,
    surchargeAmount,
    discountAmount,
    realTotal,
    venueMarkupAmount,
    customerTotal,
  };
}
