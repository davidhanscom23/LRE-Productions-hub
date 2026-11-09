import "server-only";

import { randomBytes } from "node:crypto";
import { invoiceOutstanding } from "@/lib/av-erp/invoicing";
import { createServiceClient } from "@/lib/supabase/admin";

export const INVOICE_PAY_TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function newInvoicePayToken(): string {
  return randomBytes(18).toString("base64url");
}

export type PublicInvoicePayView = {
  id: string;
  reference: string;
  subject: string;
  status: string;
  total: number;
  amountPaid: number;
  amountCredited: number;
  outstanding: number;
  customerName: string;
  customerEmail: string;
  payEnabled: boolean;
  lines: { description: string; qty: number; unitPrice: number; lineTotal: number }[];
};

export async function loadPublicInvoiceByPayToken(
  token: string,
): Promise<PublicInvoicePayView | null> {
  if (!INVOICE_PAY_TOKEN_RE.test(token)) return null;
  const supabase = createServiceClient();
  const { data: inv, error } = await supabase
    .from("av_invoices")
    .select(
      "id, reference, subject, status, total, amount_paid, amount_credited, pay_enabled, pay_token, customer_id",
    )
    .eq("pay_token", token)
    .eq("pay_enabled", true)
    .maybeSingle();
  if (error || !inv) return null;
  if (inv.status === "void" || inv.status === "draft") return null;

  let customerName = "";
  let customerEmail = "";
  if (inv.customer_id) {
    const { data: customer } = await supabase
      .from("av_customers")
      .select("name, email")
      .eq("id", inv.customer_id)
      .maybeSingle();
    customerName = customer?.name ?? "";
    customerEmail = customer?.email ?? "";
  }

  const { data: lines } = await supabase
    .from("av_invoice_lines")
    .select("description, qty, unit_price, sort_order")
    .eq("invoice_id", inv.id)
    .order("sort_order");

  const total = Number(inv.total) || 0;
  const amountPaid = Number(inv.amount_paid) || 0;
  const amountCredited = Number(inv.amount_credited) || 0;

  return {
    id: inv.id as string,
    reference: String(inv.reference ?? ""),
    subject: String(inv.subject ?? ""),
    status: String(inv.status ?? ""),
    total,
    amountPaid,
    amountCredited,
    outstanding: invoiceOutstanding(total, amountPaid, amountCredited),
    customerName,
    customerEmail,
    payEnabled: Boolean(inv.pay_enabled),
    lines: (lines ?? []).map((l) => {
      const qty = Number(l.qty) || 0;
      const unitPrice = Number(l.unit_price) || 0;
      return {
        description: String(l.description || ""),
        qty,
        unitPrice,
        lineTotal: Math.round((qty * unitPrice + Number.EPSILON) * 100) / 100,
      };
    }),
  };
}
