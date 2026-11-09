import { roundMoney } from "@/lib/av-erp/invoicing";

/** Escape a value for a QuickBooks query string literal. */
export function qbEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** QuickBooks DisplayName: max 500 chars, no colons. */
export function customerDisplayName(clientName: string | null, projectName: string): string {
  const base = (clientName ?? "").trim() || projectName.trim() || "Hub client";
  return base.replace(/:/g, " -").slice(0, 100);
}

export type InvoiceForQb = {
  number: string;
  title: string;
  issuedAt: string | null;
  dueAt: string | null;
  taxAmount: number;
  notes: string;
  lines: { description: string; qty: number; unit_price: number }[];
};

/** Body for POST /invoice. Tax goes in as its own line so totals match the Hub to the cent. */
export function buildQbInvoice(inv: InvoiceForQb, ids: { customerId: string; itemId: string }) {
  const lines: Record<string, unknown>[] = inv.lines.map((l) => ({
    DetailType: "SalesItemLineDetail",
    Amount: roundMoney(Math.max(0, l.qty) * l.unit_price),
    Description: l.description.slice(0, 4000),
    SalesItemLineDetail: { ItemRef: { value: ids.itemId }, Qty: l.qty, UnitPrice: l.unit_price },
  }));
  if (inv.taxAmount > 0) {
    lines.push({
      DetailType: "SalesItemLineDetail",
      Amount: roundMoney(inv.taxAmount),
      Description: "Sales tax",
      SalesItemLineDetail: { ItemRef: { value: ids.itemId }, Qty: 1, UnitPrice: roundMoney(inv.taxAmount) },
    });
  }
  return {
    DocNumber: inv.number.slice(0, 21),
    CustomerRef: { value: ids.customerId },
    TxnDate: inv.issuedAt ?? undefined,
    DueDate: inv.dueAt ?? undefined,
    PrivateNote: `Created from the Vident Hub (${inv.number}).`,
    CustomerMemo: inv.notes ? { value: inv.notes.slice(0, 1000) } : undefined,
    Line: lines,
  };
}

/** Body for POST /payment, applied to one QuickBooks invoice. */
export function buildQbPayment(p: { amount: number; receivedAt: string; reference: string | null; method: string }, ids: { customerId: string; qbInvoiceId: string }) {
  return {
    CustomerRef: { value: ids.customerId },
    TotalAmt: roundMoney(p.amount),
    TxnDate: p.receivedAt,
    PaymentRefNum: (p.reference ?? p.method).slice(0, 21),
    Line: [{ Amount: roundMoney(p.amount), LinkedTxn: [{ TxnId: ids.qbInvoiceId, TxnType: "Invoice" }] }],
  };
}
