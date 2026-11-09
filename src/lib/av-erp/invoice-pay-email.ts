import "server-only";

import { COMPANY } from "@/lib/company";
import { sendEmailDetailed, type SendEmailResult } from "@/lib/email/send";
import { siteOrigin } from "@/lib/stripe/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InvoicePayEmailResult =
  | { ok: true; to: string; path: string; skipped?: boolean }
  | { ok: false; error: string; skipped?: boolean; path?: string };

/** Resolve customer email for an invoice (via customer_id). */
export async function loadInvoiceCustomerEmail(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<{
  reference: string;
  subject: string;
  customerName: string;
  email: string;
} | null> {
  const { data: inv } = await supabase
    .from("av_invoices")
    .select("reference, subject, customer_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv?.customer_id) return null;

  const { data: customer } = await supabase
    .from("av_customers")
    .select("name, email")
    .eq("id", inv.customer_id)
    .maybeSingle();
  const email = String(customer?.email ?? "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) return null;

  return {
    reference: String(inv.reference ?? ""),
    subject: String(inv.subject ?? ""),
    customerName: String(customer?.name ?? "").trim(),
    email,
  };
}

/** Email the public /invoice/{token} pay link via Resend. */
export async function emailInvoicePayLink(input: {
  to: string;
  customerName?: string;
  reference: string;
  subject?: string;
  path: string;
}): Promise<SendEmailResult & { path: string }> {
  const origin = siteOrigin();
  const link = `${origin}${input.path.startsWith("/") ? input.path : `/${input.path}`}`;
  const label = input.reference || "your invoice";
  const mailSubject =
    `Invoice ${label}` + (input.subject ? ` — ${input.subject}` : "");

  const sent = await sendEmailDetailed({
    to: input.to,
    subject: mailSubject,
    text: [
      `Hi${input.customerName ? ` ${input.customerName}` : ""},`,
      "",
      `Your invoice from ${COMPANY.displayName} is ready to pay:`,
      link,
      "",
      "Open the link to review the balance and pay securely online.",
      "",
      `— ${COMPANY.displayName}`,
    ].join("\n"),
    html: `<p>Hi${input.customerName ? ` ${input.customerName}` : ""},</p>
<p>Your invoice from ${COMPANY.displayName} is ready to pay.</p>
<p><a href="${link}">Pay invoice ${label}</a></p>
<p>Open the link to review the balance and pay securely online.</p>
<p>— ${COMPANY.displayName}</p>`,
  });

  return { ...sent, path: input.path };
}
