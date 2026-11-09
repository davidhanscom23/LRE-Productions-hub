/** Job margin helpers (revenue vs costs). */

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Revenue preference: non-void invoice totals, else quote customer total.
 */
export function resolveJobRevenue(input: {
  invoiceTotals: number[];
  quoteCustomerTotal: number;
}): { revenue: number; source: "invoices" | "quote" } {
  const fromInvoices = roundMoney(
    input.invoiceTotals.reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0),
  );
  if (fromInvoices > 0) {
    return { revenue: fromInvoices, source: "invoices" };
  }
  return {
    revenue: roundMoney(Math.max(0, input.quoteCustomerTotal)),
    source: "quote",
  };
}

export function jobMargin(input: {
  revenue: number;
  costs: number;
}): { margin: number; marginPct: number | null } {
  const revenue = roundMoney(Math.max(0, input.revenue));
  const costs = roundMoney(Math.max(0, input.costs));
  const margin = roundMoney(revenue - costs);
  if (revenue <= 0) return { margin, marginPct: null };
  return {
    margin,
    marginPct: roundMoney((margin / revenue) * 100),
  };
}

export const AV_JOB_COST_CATEGORIES = [
  "labor",
  "sub_hire",
  "transport",
  "consumable",
  "fee",
  "other",
] as const;

export type AvJobCostCategory = (typeof AV_JOB_COST_CATEGORIES)[number];

export const AV_JOB_COST_CATEGORY_LABELS: Record<AvJobCostCategory, string> = {
  labor: "Labor",
  sub_hire: "Sub-hire",
  transport: "Transport",
  consumable: "Consumable",
  fee: "Fee",
  other: "Other",
};

export const AV_BOOKING_STATUSES = [
  "offered",
  "confirmed",
  "declined",
  "cancelled",
] as const;

export type AvBookingStatus = (typeof AV_BOOKING_STATUSES)[number];

export const AV_BOOKING_STATUS_LABELS: Record<AvBookingStatus, string> = {
  offered: "Offered",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};
