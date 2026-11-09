/** Pure helpers for AV Reports (no DB). */

import type { AvJobCostCategory } from "@/lib/av-erp/margin";
import { AV_JOB_COST_CATEGORIES, roundMoney } from "@/lib/av-erp/margin";

export type InvoiceAgingBucketId =
  | "current"
  | "d1_30"
  | "d31_60"
  | "d61_90"
  | "d90_plus";

export const INVOICE_AGING_BUCKET_LABELS: Record<InvoiceAgingBucketId, string> =
  {
    current: "Current / not due",
    d1_30: "1–30 days overdue",
    d31_60: "31–60 days overdue",
    d61_90: "61–90 days overdue",
    d90_plus: "90+ days overdue",
  };

export const INVOICE_AGING_BUCKET_ORDER: InvoiceAgingBucketId[] = [
  "current",
  "d1_30",
  "d31_60",
  "d61_90",
  "d90_plus",
];

/**
 * Bucket an open AR row by days past due (Eastern calendar days via caller’s nowMs).
 * No due date → current.
 */
export function invoiceAgingBucket(
  dueAt: string | null,
  nowMs: number,
): InvoiceAgingBucketId {
  if (!dueAt) return "current";
  const dueMs = new Date(dueAt).getTime();
  if (!Number.isFinite(dueMs)) return "current";
  const daysPast = Math.floor((nowMs - dueMs) / (24 * 60 * 60 * 1000));
  if (daysPast <= 0) return "current";
  if (daysPast <= 30) return "d1_30";
  if (daysPast <= 60) return "d31_60";
  if (daysPast <= 90) return "d61_90";
  return "d90_plus";
}

export type CostCategoryTotal = {
  category: AvJobCostCategory;
  total: number;
  count: number;
};

export function aggregateCostsByCategory(
  rows: { category: string; amount: number }[],
): CostCategoryTotal[] {
  const map = new Map<AvJobCostCategory, { total: number; count: number }>();
  for (const cat of AV_JOB_COST_CATEGORIES) {
    map.set(cat, { total: 0, count: 0 });
  }
  for (const row of rows) {
    const cat = (
      AV_JOB_COST_CATEGORIES.includes(row.category as AvJobCostCategory)
        ? row.category
        : "other"
    ) as AvJobCostCategory;
    const cur = map.get(cat) ?? { total: 0, count: 0 };
    cur.total = roundMoney(cur.total + (Number(row.amount) || 0));
    cur.count += 1;
    map.set(cat, cur);
  }
  return AV_JOB_COST_CATEGORIES.map((category) => {
    const cur = map.get(category)!;
    return { category, total: cur.total, count: cur.count };
  }).filter((r) => r.count > 0 || r.total > 0);
}

/** Low-stock: owned inventory with free qty at or below threshold (default 0 = out). */
export function isLowStock(
  row: { qtyOwned: number; qtyFree: number },
  threshold = 0,
): boolean {
  if (row.qtyOwned <= 0) return false;
  return row.qtyFree <= threshold;
}

/** Sale / consumable stock list (KM salesStock). */
export function filterSalesStock<T extends { kind: string }>(rows: T[]): T[] {
  return rows.filter((r) => r.kind === "sale" || r.kind === "consumable");
}

/** Active products never used on a quotation/order/closed line (KM neverBooked). */
export function neverBookedProducts<
  T extends { productId: string; isActive?: boolean },
>(products: T[], bookedProductIds: Iterable<string>): T[] {
  const booked = new Set(bookedProductIds);
  return products.filter((p) => {
    if (p.isActive === false) return false;
    return !booked.has(p.productId);
  });
}

export type PartialInvoiceJobInput = {
  opportunityId: string;
  reference: string;
  subject: string;
  quoteCustomerTotal: number;
  invoiceTotal: number;
  invoiceStatuses: string[];
};

/** Jobs with invoices that don’t cover the quote total, or any partial invoice. */
export function partiallyInvoicedJobs(
  rows: PartialInvoiceJobInput[],
): PartialInvoiceJobInput[] {
  return rows.filter((r) => {
    if (r.invoiceStatuses.includes("partial")) return true;
    if (r.invoiceTotal <= 0) return false;
    return roundMoney(r.invoiceTotal) + 0.005 < roundMoney(r.quoteCustomerTotal);
  });
}

export type CostDetailRow = {
  id: string;
  opportunityId: string;
  opportunityReference: string;
  category: string;
  amount: number;
  taxAmount: number;
  supplierName: string | null;
  description: string;
  costDate: string;
};

export function filterCostsByCategory(
  rows: CostDetailRow[],
  category: string,
): CostDetailRow[] {
  return rows.filter((r) => r.category === category);
}

/** Labor costs tied to a supplier = service sub contracts. */
export function filterSubContractCosts(rows: CostDetailRow[]): CostDetailRow[] {
  return rows.filter(
    (r) => r.category === "labor" && Boolean(r.supplierName?.trim()),
  );
}
