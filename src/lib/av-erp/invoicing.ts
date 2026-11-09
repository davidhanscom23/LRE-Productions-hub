/** Invoice outstanding / status helpers (pure). */

export type AvInvoiceStatus = "draft" | "sent" | "partial" | "paid" | "void";

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Line amount; qty is clamped ≥ 0, unit price may be negative (discount lines). */
export function invoiceLineTotal(qty: number, unitPrice: number): number {
  return roundMoney(Math.max(0, qty) * unitPrice);
}

/** Sum of invoice lines → subtotal (before sales tax). */
export function invoiceLinesSubtotal(
  lines: ReadonlyArray<{ qty: number; unit_price: number }>,
): number {
  return roundMoney(
    lines.reduce(
      (sum, line) =>
        sum + invoiceLineTotal(Number(line.qty), Number(line.unit_price)),
      0,
    ),
  );
}

/** Sales tax dollars from subtotal × rate %. */
export function invoiceTaxAmount(subtotal: number, taxRatePct: number): number {
  const rate = Math.max(0, Math.min(100, Number(taxRatePct) || 0));
  return roundMoney(Math.max(0, subtotal) * (rate / 100));
}

/** Grand total = subtotal + sales tax. */
export function invoiceGrandTotal(subtotal: number, taxAmount: number): number {
  return roundMoney(Math.max(0, subtotal) + Math.max(0, taxAmount));
}

/**
 * Effective sales-tax % for a new/edited invoice.
 * Explicit rate wins; else 0 when tax-exempt; else shop default.
 */
export function resolveInvoiceTaxRatePct(input: {
  overrideRatePct?: number | null;
  customerTaxExempt?: boolean;
  shopDefaultRatePct?: number;
}): number {
  if (
    input.overrideRatePct != null &&
    Number.isFinite(Number(input.overrideRatePct))
  ) {
    return Math.max(0, Math.min(100, Number(input.overrideRatePct)));
  }
  if (input.customerTaxExempt) return 0;
  return Math.max(0, Math.min(100, Number(input.shopDefaultRatePct) || 0));
}

/** Balance still due after payments and credit notes. */
export function invoiceOutstanding(
  total: number,
  amountPaid: number,
  amountCredited = 0,
): number {
  return Math.max(
    0,
    roundMoney(total - amountPaid - amountCredited),
  );
}

/**
 * Derive status after payments/credits (does not change draft/void unless forced).
 * `markSent` flips draft → sent when there is no settled amount yet.
 * Settled = paid + credited; when settled covers total → paid.
 */
export function deriveInvoiceStatus(input: {
  current: AvInvoiceStatus;
  total: number;
  amountPaid: number;
  amountCredited?: number;
  markSent?: boolean;
}): AvInvoiceStatus {
  if (input.current === "void") return "void";
  const paid = roundMoney(Math.max(0, input.amountPaid));
  const credited = roundMoney(Math.max(0, input.amountCredited ?? 0));
  const settled = roundMoney(paid + credited);
  const total = roundMoney(Math.max(0, input.total));
  if (settled <= 0) {
    if (input.markSent && input.current === "draft") return "sent";
    return input.current === "draft" ? "draft" : "sent";
  }
  if (settled + 0.001 >= total) return "paid";
  return "partial";
}

export const AV_INVOICE_STATUS_LABELS: Record<AvInvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Partial",
  paid: "Paid",
  void: "Void",
};
