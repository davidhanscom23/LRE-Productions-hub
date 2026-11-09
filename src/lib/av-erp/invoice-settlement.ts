import "server-only";

import {
  deriveInvoiceStatus,
  roundMoney,
  type AvInvoiceStatus,
} from "@/lib/av-erp/invoicing";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Recompute amount_paid / amount_credited / status from payment + credit rows. */
export async function refreshSettlementTotals(
  supabase: SupabaseClient,
  invoiceId: string,
  opts: { markSent?: boolean; forceStatus?: AvInvoiceStatus } = {},
): Promise<void> {
  const { data: inv } = await supabase
    .from("av_invoices")
    .select("status, total")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return;

  const [{ data: pays }, { data: credits }] = await Promise.all([
    supabase.from("av_payments").select("amount").eq("invoice_id", invoiceId),
    supabase
      .from("av_invoice_credits")
      .select("amount")
      .eq("invoice_id", invoiceId),
  ]);
  const amountPaid = roundMoney(
    (pays ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0),
  );
  const amountCredited = roundMoney(
    (credits ?? []).reduce((s, c) => s + (Number(c.amount) || 0), 0),
  );

  const status =
    opts.forceStatus ??
    deriveInvoiceStatus({
      current: inv.status as AvInvoiceStatus,
      total: Number(inv.total) || 0,
      amountPaid,
      amountCredited,
      markSent: opts.markSent,
    });

  await supabase
    .from("av_invoices")
    .update({
      amount_paid: amountPaid,
      amount_credited: amountCredited,
      status,
    })
    .eq("id", invoiceId);
}
