"use server";

import { COMPANY } from "@/lib/company";
import { loadPublicProjectInvoice } from "@/lib/project-invoices/server";
import { getStripe, siteOrigin } from "@/lib/stripe/server";

/** Start Stripe Checkout for the next amount due. The token in the URL is the key. */
export async function startProjectInvoiceCheckout(token: string): Promise<{ error: string | null; url?: string }> {
  const invoice = await loadPublicProjectInvoice(token);
  if (!invoice) return { error: "This invoice link isn't valid." };
  if (!invoice.payEnabled) return { error: "Online payment isn't turned on for this invoice. Please contact us." };
  if (!invoice.payable) return { error: "Nothing is due on this invoice." };
  const stripe = getStripe();
  if (!stripe) return { error: "Online payment isn't available right now. Please contact us to pay." };

  const origin = siteOrigin();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: invoice.clientEmail.includes("@") ? invoice.clientEmail : undefined,
      client_reference_id: invoice.id,
      metadata: { hb_invoice_id: invoice.id, hb_invoice_number: invoice.number },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(invoice.payable.amount * 100),
            product_data: {
              name: `${COMPANY.displayName} invoice ${invoice.number}`,
              description: `${invoice.projectName || "Event"} — ${invoice.payable.label}`,
            },
          },
        },
      ],
      success_url: `${origin}/pay/${token}?paid=1`,
      cancel_url: `${origin}/pay/${token}?canceled=1`,
    });
    if (!session.url) return { error: "Could not start checkout." };
    return { error: null, url: session.url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not start checkout." };
  }
}
