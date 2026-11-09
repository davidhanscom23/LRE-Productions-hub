import { QuotingDetailClient } from "@/components/quoting/quoting-detail-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type {
  Quote,
  QuoteDiscountApproval,
  QuoteLineItem,
  QuotePricingNote,
} from "@/lib/types/quoting";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function QuoteDetailPage({ params }: Props) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const { id } = await params;
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  const { data: quoteRow, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Quoting needs a database update</p>
        <p className="mt-2">
          Run migration <code>122_quoting.sql</code> in Supabase, then refresh.
          ({error.message})
        </p>
      </div>
    );
  }
  if (!quoteRow) notFound();
  if (quoteRow.created_by !== profile.id && !isAdmin) {
    redirect("/quoting");
  }

  const { data: lineRows } = await supabase
    .from("quote_line_items")
    .select("*")
    .eq("quote_id", id)
    .order("sort_order", { ascending: true });

  const lines: QuoteLineItem[] = (
    (lineRows ?? []) as Record<string, unknown>[]
  ).map((r) => ({
    id: String(r.id),
    quote_id: String(r.quote_id),
    label: String(r.label ?? ""),
    quantity: Number(r.quantity) || 1,
    list_unit_price: Number(r.list_unit_price) || 0,
    quote_unit_price: Number(r.quote_unit_price) || 0,
    sort_order: Number(r.sort_order) || 0,
  }));

  const quote: Quote = {
    id: String(quoteRow.id),
    created_by: String(quoteRow.created_by),
    client_name: String(quoteRow.client_name ?? ""),
    event_name: String(quoteRow.event_name ?? ""),
    event_date: (quoteRow.event_date as string) ?? null,
    department: String(quoteRow.department ?? "General"),
    status: (quoteRow.status as Quote["status"]) ?? "draft",
    notes: String(quoteRow.notes ?? ""),
    created_at: String(quoteRow.created_at ?? ""),
    updated_at: String(quoteRow.updated_at ?? ""),
    lines,
  };

  const { data: noteRows } = await supabase
    .from("quote_pricing_notes")
    .select("*")
    .in("department", [quote.department, "General"])
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  const notes: QuotePricingNote[] = (
    (noteRows ?? []) as Record<string, unknown>[]
  ).map((r) => ({
    id: String(r.id),
    department: String(r.department ?? "General"),
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    sort_order: Number(r.sort_order) || 0,
    updated_at: String(r.updated_at ?? ""),
  }));

  const { data: approvalRows } = await supabase
    .from("quote_discount_approvals")
    .select("*")
    .eq("quote_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const approvals: QuoteDiscountApproval[] = (
    (approvalRows ?? []) as Record<string, unknown>[]
  ).map((r) => ({
    id: String(r.id),
    quote_id: String(r.quote_id),
    requested_by: r.requested_by ? String(r.requested_by) : null,
    reason: String(r.reason ?? ""),
    list_total: Number(r.list_total) || 0,
    quote_total: Number(r.quote_total) || 0,
    total_decrease_pct: Number(r.total_decrease_pct) || 0,
    line_breaches: Array.isArray(r.line_breaches)
      ? (r.line_breaches as QuoteDiscountApproval["line_breaches"])
      : [],
    status: (r.status as QuoteDiscountApproval["status"]) ?? "pending",
    review_note: String(r.review_note ?? ""),
    created_at: String(r.created_at ?? ""),
    reviewed_at: (r.reviewed_at as string) ?? null,
  }));

  return (
    <QuotingDetailClient
      isAdmin={isAdmin}
      quote={quote}
      notes={notes}
      approvals={approvals}
    />
  );
}
