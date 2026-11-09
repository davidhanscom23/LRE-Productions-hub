import Link from "next/link";
import { COMPANY } from "@/lib/company";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { refreshSettlementTotals } from "@/lib/av-erp/invoice-settlement";
import { getStripe } from "@/lib/stripe/server";
import { loadPublicInvoiceByPayToken } from "@/lib/av-erp/public-invoice";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export default async function InvoicePaySuccessPage({
  params,
  searchParams,
}: Props) {
  const { token } = await params;
  const { session_id: sessionId } = await searchParams;

  if (sessionId && isServiceRoleConfigured()) {
    const stripe = getStripe();
    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const invoiceId =
          (session.metadata?.av_invoice_id as string | undefined) ||
          (typeof session.client_reference_id === "string"
            ? session.client_reference_id
            : null);
        if (
          invoiceId &&
          (session.payment_status === "paid" ||
            session.status === "complete")
        ) {
          const db = createServiceClient();
          const paymentIntent =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null;
          const amount = (session.amount_total ?? 0) / 100;
          if (amount > 0) {
            const { data: existing } = await db
              .from("av_payments")
              .select("id")
              .eq("invoice_id", invoiceId)
              .eq("reference", paymentIntent || sessionId)
              .maybeSingle();
            if (!existing) {
              await db.from("av_payments").insert({
                invoice_id: invoiceId,
                amount,
                received_at: new Date().toISOString().slice(0, 10),
                method: "stripe",
                reference: paymentIntent || sessionId,
                notes: "Paid online via Stripe Checkout",
              });
              await refreshSettlementTotals(db, invoiceId, { markSent: true });
            }
          }
        }
      } catch {
        // Best-effort reconcile; webhook is the source of truth.
      }
    }
  }

  const invoice = await loadPublicInvoiceByPayToken(token);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Payment received</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {invoice
          ? `Thank you. Invoice ${invoice.reference} is updating.`
          : "Thank you. Your payment is processing."}
      </p>
      {invoice ? (
        <p className="mt-6">
          <Link
            href={`/invoice/${token}`}
            className="text-sm font-medium underline-offset-2 hover:underline"
          >
            View invoice
          </Link>
        </p>
      ) : null}
      <p className="mt-10 text-xs text-[var(--muted)]">{COMPANY.displayName}</p>
    </main>
  );
}