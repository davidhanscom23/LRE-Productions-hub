import Link from "next/link";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export default async function BookDepositSuccessPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const { session_id: sessionId } = await searchParams;

  let paid = false;
  let amount: number | null = null;

  if (sessionId && isServiceRoleConfigured()) {
    const stripe = getStripe();
    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        paid =
          session.payment_status === "paid" ||
          session.status === "complete";
        if (typeof session.amount_total === "number") {
          amount = session.amount_total / 100;
        }
        const requestId = session.metadata?.venue_quote_request_id;
        if (paid && requestId) {
          const db = createServiceClient();
          await db
            .from("venue_portal_quote_requests")
            .update({
              deposit_status: "paid",
              stripe_payment_intent_id:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : session.payment_intent?.id ?? null,
              deposit_paid_at: new Date().toISOString(),
              status: "booked",
            })
            .eq("id", requestId)
            .neq("deposit_status", "paid");
        }
      } catch {
        // Fall through to generic thank-you.
      }
    }
  }

  const money =
    amount != null
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount)
      : null;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Vident Productions
      </p>
      <h1 className="mt-3 font-serif text-3xl text-slate-900">
        {paid ? "Deposit received" : "Thanks — we have your booking"}
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        {paid
          ? `Your${money ? ` ${money}` : ""} deposit is confirmed. Our team will follow up to lock in the event details.`
          : "If you completed payment, it may take a moment to show as paid. Our team will email you shortly."}
      </p>
      <Link
        href={`/quote/${slug}`}
        className="mt-8 inline-flex items-center justify-center self-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
      >
        Back to quote
      </Link>
    </main>
  );
}
