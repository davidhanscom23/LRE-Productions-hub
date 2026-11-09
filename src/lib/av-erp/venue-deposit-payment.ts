import "server-only";

import { refreshSettlementTotals } from "@/lib/av-erp/invoice-settlement";
import {
  venueDepositApplyAmount,
  venueDepositPaymentReference,
} from "@/lib/av-erp/venue-deposit-math";
import type { SupabaseClient } from "@supabase/supabase-js";

export {
  venueDepositApplyAmount,
  venueDepositPaymentReference,
} from "@/lib/av-erp/venue-deposit-math";

/**
 * If the Hub quote came from a venue Book Now with a paid deposit, copy that
 * deposit onto the new invoice as the first av_payments row (idempotent).
 */
export async function applyPaidVenueDepositToInvoice(
  supabase: SupabaseClient,
  input: {
    invoiceId: string;
    opportunityId: string;
    createdBy: string | null;
  },
): Promise<{ applied: boolean; amount: number; reason?: string }> {
  const { data: req } = await supabase
    .from("venue_portal_quote_requests")
    .select(
      "id, deposit_amount, deposit_status, deposit_paid_at, stripe_payment_intent_id",
    )
    .eq("opportunity_id", input.opportunityId)
    .maybeSingle();

  if (!req) {
    return { applied: false, amount: 0, reason: "no_linked_request" };
  }
  if (String(req.deposit_status) !== "paid") {
    return { applied: false, amount: 0, reason: "deposit_not_paid" };
  }

  const reference = venueDepositPaymentReference(String(req.id));
  const { data: existing } = await supabase
    .from("av_payments")
    .select("id")
    .eq("invoice_id", input.invoiceId)
    .eq("reference", reference)
    .maybeSingle();
  if (existing) {
    return { applied: false, amount: 0, reason: "already_applied" };
  }

  const { data: inv } = await supabase
    .from("av_invoices")
    .select("total, amount_paid, amount_credited")
    .eq("id", input.invoiceId)
    .maybeSingle();
  if (!inv) {
    return { applied: false, amount: 0, reason: "invoice_missing" };
  }

  const amount = venueDepositApplyAmount({
    depositAmount: Number(req.deposit_amount) || 0,
    invoiceTotal: Number(inv.total) || 0,
    amountPaid: Number(inv.amount_paid) || 0,
    amountCredited: Number(inv.amount_credited) || 0,
  });
  if (!(amount > 0)) {
    return { applied: false, amount: 0, reason: "nothing_to_apply" };
  }

  const paidAt = req.deposit_paid_at
    ? String(req.deposit_paid_at).slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const pi = String(req.stripe_payment_intent_id ?? "").trim();

  const { error } = await supabase.from("av_payments").insert({
    invoice_id: input.invoiceId,
    amount,
    received_at: paidAt,
    method: "stripe",
    reference,
    notes: pi
      ? `Venue Book Now deposit (Stripe ${pi})`
      : "Venue Book Now deposit paid online",
    created_by: input.createdBy,
  });
  if (error) {
    return { applied: false, amount: 0, reason: error.message };
  }

  await refreshSettlementTotals(supabase, input.invoiceId);
  return { applied: true, amount };
}
