import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { refreshSettlementTotals } from "@/lib/av-erp/invoice-settlement";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { refreshProjectInvoice } from "@/lib/project-invoices/server";

export const runtime = "nodejs";

async function applyInvoiceCheckoutPaid(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.av_invoice_id;
  if (!invoiceId) return false;

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const amount = (session.amount_total ?? 0) / 100;
  if (!(amount > 0)) return true;

  const db = createServiceClient();
  const reference = paymentIntent || session.id;
  const { data: existing } = await db
    .from("av_payments")
    .select("id")
    .eq("invoice_id", invoiceId)
    .eq("reference", reference)
    .maybeSingle();
  if (existing) return true;

  await db.from("av_payments").insert({
    invoice_id: invoiceId,
    amount,
    received_at: new Date().toISOString().slice(0, 10),
    method: "stripe",
    reference,
    notes: "Paid online via Stripe Checkout",
  });
  await refreshSettlementTotals(db, invoiceId, { markSent: true });
  return true;
}

/** Payment on a project invoice (the non-AV invoices sent from a HoneyBook project card). */
async function applyProjectInvoiceCheckoutPaid(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.hb_invoice_id;
  if (!invoiceId) return false;
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const amount = (session.amount_total ?? 0) / 100;
  if (!(amount > 0)) return true;

  const db = createServiceClient();
  const reference = paymentIntent || session.id;
  const { data: existing } = await db
    .from("project_invoice_payments")
    .select("id")
    .eq("invoice_id", invoiceId)
    .eq("reference", reference)
    .maybeSingle();
  if (existing) return true;

  // The unique index on (invoice_id, reference) for stripe payments makes a race harmless.
  await db.from("project_invoice_payments").insert({
    invoice_id: invoiceId,
    amount,
    received_at: new Date().toISOString().slice(0, 10),
    method: "stripe",
    reference,
    notes: "Paid online via Stripe Checkout",
  });
  await refreshProjectInvoice(db, invoiceId, { markSent: true });

  const { data: inv } = await db
    .from("project_invoices")
    .select("project_id, number")
    .eq("id", invoiceId)
    .maybeSingle();
  if (inv) {
    await db.from("honeybook_project_notes").insert({
      project_id: inv.project_id,
      source: "system",
      category: "status",
      body: `Invoice ${inv.number}: $${amount.toFixed(2)} paid online.`,
    });
  }
  return true;
}

async function applyVenueDepositPaid(session: Stripe.Checkout.Session) {
  const requestId =
    (session.metadata?.venue_quote_request_id as string | undefined) ||
    (typeof session.client_reference_id === "string"
      ? session.client_reference_id
      : null);
  if (!requestId) return false;
  // Prefer invoice metadata when both somehow present.
  if (session.metadata?.av_invoice_id) return false;

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const db = createServiceClient();
  await db
    .from("venue_portal_quote_requests")
    .update({
      deposit_status: "paid",
      stripe_payment_intent_id: paymentIntent,
      deposit_paid_at: new Date().toISOString(),
      status: "booked",
    })
    .eq("id", requestId)
    .in("deposit_status", ["pending", "none", "failed"]);
  return true;
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 503 },
    );
  }
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: "Service role missing." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const handledInvoice = await applyInvoiceCheckoutPaid(session);
    const handledProjectInvoice = handledInvoice
      ? false
      : await applyProjectInvoiceCheckoutPaid(session);
    if (!handledInvoice && !handledProjectInvoice) {
      await applyVenueDepositPaid(session);
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const requestId = session.metadata?.venue_quote_request_id;
    if (requestId && !session.metadata?.av_invoice_id) {
      const db = createServiceClient();
      await db
        .from("venue_portal_quote_requests")
        .update({ deposit_status: "canceled" })
        .eq("id", requestId)
        .eq("deposit_status", "pending");
    }
  }

  return NextResponse.json({ received: true });
}
