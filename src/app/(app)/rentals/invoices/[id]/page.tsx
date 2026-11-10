import { notFound, redirect } from "next/navigation";
import { InvoiceDetailClient } from "@/components/av-erp/invoice-detail-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import type {
  AvInvoice,
  AvInvoiceCredit,
  AvInvoiceLine,
  AvPayment,
} from "@/lib/av-erp/types";
import { createClient } from "@/lib/supabase/server";
import { canAccessVidentAv } from "@/lib/vident-av-access";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata() {
  return { title: "Invoice — LRE AV" };
}

export default async function AvInvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessVidentAv(profile)) redirect("/rentals");

  const supabase = await createClient();
  let { data: invoice, error } = await supabase
    .from("av_invoices")
    .select(
      "id, reference, opportunity_id, customer_id, subject, status, issued_at, due_at, subtotal, tax_rate_pct, tax_amount, total, amount_paid, amount_credited, notes, pay_token, pay_enabled, created_at, updated_at, av_customers ( name ), av_opportunities ( reference )",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    const fallback = await supabase
      .from("av_invoices")
      .select(
        "id, reference, opportunity_id, customer_id, subject, status, issued_at, due_at, subtotal, total, amount_paid, amount_credited, notes, created_at, updated_at, av_customers ( name ), av_opportunities ( reference )",
      )
      .eq("id", id)
      .maybeSingle();
    invoice = fallback.data
      ? {
          ...fallback.data,
          tax_rate_pct: 0,
          tax_amount: 0,
          pay_token: "",
          pay_enabled: false,
        }
      : null;
    error = fallback.error;
  }

  if (error || !invoice) notFound();

  const [linesRes, paysRes, creditsRes] = await Promise.all([
    supabase
      .from("av_invoice_lines")
      .select("id, invoice_id, description, qty, unit_price, sort_order")
      .eq("invoice_id", id)
      .order("sort_order"),
    supabase
      .from("av_payments")
      .select(
        "id, invoice_id, amount, received_at, method, reference, notes, created_at",
      )
      .eq("invoice_id", id)
      .order("received_at", { ascending: false }),
    supabase
      .from("av_invoice_credits")
      .select(
        "id, invoice_id, reference, amount, issued_at, reason, notes, created_at",
      )
      .eq("invoice_id", id)
      .order("issued_at", { ascending: false }),
  ]);

  const cust = invoice.av_customers as
    | { name: string }
    | { name: string }[]
    | null;
  const opp = invoice.av_opportunities as
    | { reference: string }
    | { reference: string }[]
    | null;
  const c = Array.isArray(cust) ? cust[0] : cust;
  const o = Array.isArray(opp) ? opp[0] : opp;

  const inv: AvInvoice = {
    id: invoice.id as string,
    reference: invoice.reference as string,
    opportunity_id: (invoice.opportunity_id as string | null) ?? null,
    customer_id: (invoice.customer_id as string | null) ?? null,
    subject: invoice.subject as string,
    status: invoice.status as AvInvoice["status"],
    issued_at: (invoice.issued_at as string | null) ?? null,
    due_at: (invoice.due_at as string | null) ?? null,
    subtotal: Number(invoice.subtotal) || 0,
    tax_rate_pct: Number((invoice as { tax_rate_pct?: number }).tax_rate_pct) || 0,
    tax_amount: Number((invoice as { tax_amount?: number }).tax_amount) || 0,
    total: Number(invoice.total) || 0,
    amount_paid: Number(invoice.amount_paid) || 0,
    amount_credited: Number(invoice.amount_credited) || 0,
    notes: (invoice.notes as string) || "",
    pay_token: String(
      (invoice as { pay_token?: string }).pay_token ?? "",
    ),
    pay_enabled: Boolean(
      (invoice as { pay_enabled?: boolean }).pay_enabled,
    ),
    created_at: invoice.created_at as string,
    updated_at: invoice.updated_at as string,
  };

  return (
    <InvoiceDetailClient
      invoice={inv}
      lines={(linesRes.data ?? []) as AvInvoiceLine[]}
      payments={(paysRes.data ?? []) as AvPayment[]}
      credits={(creditsRes.data ?? []) as AvInvoiceCredit[]}
      customerName={c?.name ?? null}
      opportunityReference={o?.reference ?? null}
    />
  );
}
