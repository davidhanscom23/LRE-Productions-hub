import {
  invoiceGrandTotal,
  invoiceLinesSubtotal,
  invoiceTaxAmount,
  roundMoney,
} from "@/lib/av-erp/invoicing";

export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "void";

export type LineInput = { description: string; qty: number; unit_price: number };

export function computeTotals(lines: LineInput[], taxRatePct: number) {
  const subtotal = invoiceLinesSubtotal(lines);
  const tax = invoiceTaxAmount(subtotal, taxRatePct);
  return { subtotal, tax, total: invoiceGrandTotal(subtotal, tax) };
}

export type Installment = { label: string; amount: number; due_at: string | null };
export type InstallmentStatus = Installment & { paid: number; remaining: number; overdue: boolean };

/** Apply total paid to installments in order. `today` is YYYY-MM-DD. */
export function allocatePayments(installments: Installment[], amountPaid: number, today: string): InstallmentStatus[] {
  let left = roundMoney(Math.max(0, amountPaid));
  return installments.map((i) => {
    const paid = roundMoney(Math.min(i.amount, left));
    left = roundMoney(left - paid);
    const remaining = roundMoney(i.amount - paid);
    return { ...i, paid, remaining, overdue: remaining > 0 && !!i.due_at && i.due_at < today };
  });
}

export type PlanKind = "full" | "retainer_balance" | "thirds";

function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Build a payment schedule that adds up to the total to the cent.
 * - full: one payment
 * - retainer_balance: 50% when issued, the rest `balanceDaysBefore` days before the event (never before issue day)
 * - thirds: three equal payments, 30 days apart from issue
 */
export function buildPlan(opts: {
  kind: PlanKind;
  total: number;
  issuedAt: string;
  eventDate?: string | null;
  balanceDaysBefore?: number;
}): Installment[] {
  const total = roundMoney(opts.total);
  if (!(total > 0)) return [];
  const issued = opts.issuedAt;
  if (opts.kind === "full") {
    return [{ label: "Payment in full", amount: total, due_at: issued }];
  }
  if (opts.kind === "thirds") {
    const a = roundMoney(total / 3);
    const b = a;
    const c = roundMoney(total - a - b);
    return [
      { label: "Payment 1 of 3", amount: a, due_at: issued },
      { label: "Payment 2 of 3", amount: b, due_at: addDays(issued, 30) },
      { label: "Payment 3 of 3", amount: c, due_at: addDays(issued, 60) },
    ];
  }
  const first = roundMoney(total / 2);
  let balanceDue = opts.eventDate ? addDays(opts.eventDate, -(opts.balanceDaysBefore ?? 14)) : addDays(issued, 30);
  if (balanceDue < issued) balanceDue = issued;
  return [
    { label: "Retainer (50%)", amount: first, due_at: issued },
    { label: "Final balance", amount: roundMoney(total - first), due_at: balanceDue },
  ];
}

/** Next amount to collect online: the first installment with money left, else the whole balance. */
export function nextPayable(installments: InstallmentStatus[], outstanding: number): { label: string; amount: number } | null {
  if (!(outstanding > 0)) return null;
  const next = installments.find((i) => i.remaining > 0);
  return next ? { label: next.label, amount: next.remaining } : { label: "Balance", amount: roundMoney(outstanding) };
}

export function deriveStatus(opts: { current: InvoiceStatus; total: number; amountPaid: number }): InvoiceStatus {
  if (opts.current === "void") return "void";
  if (opts.current === "draft") return opts.amountPaid > 0 ? (opts.amountPaid >= opts.total ? "paid" : "partial") : "draft";
  if (opts.total > 0 && opts.amountPaid >= opts.total) return "paid";
  if (opts.amountPaid > 0) return "partial";
  return "sent";
}

export const PAY_TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
