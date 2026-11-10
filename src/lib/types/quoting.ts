import type { Department } from "@/lib/types/database";

export const QUOTE_DEPARTMENT_OPTIONS = [
  "General",
  "Audiovisual",
] as const;

export type QuoteDepartment =
  | (typeof QUOTE_DEPARTMENT_OPTIONS)[number]
  | Department
  | string;

export type QuoteStatus = "draft" | "pending_approval" | "ready" | "denied";

export type QuotePricingNote = {
  id: string;
  department: string;
  title: string;
  body: string;
  sort_order: number;
  updated_at: string;
  updated_by_name?: string;
};

export type QuoteLineItem = {
  id: string;
  quote_id: string;
  label: string;
  quantity: number;
  list_unit_price: number;
  quote_unit_price: number;
  sort_order: number;
};

export type Quote = {
  id: string;
  created_by: string;
  client_name: string;
  event_name: string;
  event_date: string | null;
  department: string;
  status: QuoteStatus;
  notes: string;
  created_at: string;
  updated_at: string;
  creator_name?: string;
  lines?: QuoteLineItem[];
};

export type QuoteLineBreach = {
  label: string;
  quantity: number;
  list_unit_price: number;
  quote_unit_price: number;
  list_ext: number;
  quote_ext: number;
  decrease_pct: number;
};

export type QuoteDiscountApproval = {
  id: string;
  quote_id: string;
  requested_by: string | null;
  reason: string;
  list_total: number;
  quote_total: number;
  total_decrease_pct: number;
  line_breaches: QuoteLineBreach[];
  status: "pending" | "approved" | "denied";
  review_note: string;
  created_at: string;
  reviewed_at: string | null;
  requester_name?: string;
};

/** Decrease greater than this fraction requires admin approval. */
export const QUOTE_DISCOUNT_THRESHOLD = 0.2;

export function formatQuoteMoney(amount: number): string {
  return `$${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function lineExtended(unit: number, qty: number): number {
  return Math.round(unit * qty * 100) / 100;
}

export function decreasePct(list: number, quoted: number): number {
  if (!Number.isFinite(list) || list <= 0) return 0;
  const pct = (list - quoted) / list;
  return Math.round(pct * 10000) / 10000;
}

export function summarizeQuoteLines(lines: QuoteLineItem[]): {
  listTotal: number;
  quoteTotal: number;
  totalDecreasePct: number;
  lineBreaches: QuoteLineBreach[];
  needsApproval: boolean;
} {
  let listTotal = 0;
  let quoteTotal = 0;
  const lineBreaches: QuoteLineBreach[] = [];

  for (const line of lines) {
    const listExt = lineExtended(line.list_unit_price, line.quantity);
    const quoteExt = lineExtended(line.quote_unit_price, line.quantity);
    listTotal += listExt;
    quoteTotal += quoteExt;
    const pct = decreasePct(listExt, quoteExt);
    if (pct > QUOTE_DISCOUNT_THRESHOLD) {
      lineBreaches.push({
        label: line.label,
        quantity: line.quantity,
        list_unit_price: line.list_unit_price,
        quote_unit_price: line.quote_unit_price,
        list_ext: listExt,
        quote_ext: quoteExt,
        decrease_pct: pct,
      });
    }
  }

  listTotal = Math.round(listTotal * 100) / 100;
  quoteTotal = Math.round(quoteTotal * 100) / 100;
  const totalDecreasePct = decreasePct(listTotal, quoteTotal);
  const needsApproval =
    lineBreaches.length > 0 || totalDecreasePct > QUOTE_DISCOUNT_THRESHOLD;

  return { listTotal, quoteTotal, totalDecreasePct, lineBreaches, needsApproval };
}

export function quoteStatusLabel(status: QuoteStatus): string {
  switch (status) {
    case "pending_approval":
      return "Pending approval";
    case "ready":
      return "Ready";
    case "denied":
      return "Denied";
    default:
      return "Draft";
  }
}
