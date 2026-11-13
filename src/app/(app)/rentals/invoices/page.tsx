import { redirect } from "next/navigation";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import { InvoicesListClient } from "@/components/av-erp/invoices-list-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import type { AvInvoice } from "@/lib/av-erp/types";
import { createClient } from "@/lib/supabase/server";
import { canAccessAv } from "@/lib/av-access";

export const metadata = { title: "Invoices — LRE AV" };

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AvInvoicesPage({ searchParams }: Props) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessAv(profile)) redirect("/rentals");

  const { status: statusRaw } = await searchParams;
  const initialFilter =
    statusRaw === "open" ||
    statusRaw === "unpaid" ||
    statusRaw === "overdue"
      ? statusRaw
      : "all";

  const supabase = await createClient();
  const [invRes, oppsRes] = await Promise.all([
    supabase
      .from("av_invoices")
      .select(
        "id, reference, opportunity_id, customer_id, subject, status, issued_at, due_at, subtotal, total, amount_paid, amount_credited, notes, created_at, updated_at, av_customers ( name ), av_opportunities ( reference )",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("av_opportunities")
      .select("id, reference, subject, status")
      .in("status", ["quotation", "order"])
      .order("reference"),
  ]);

  if (invRes.error) {
    return (
      <AvErpPage maxWidthClassName="max-w-4xl">
        <div className="max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Invoices needs a database update</p>
          <p className="mt-2">
            Run migration <code>144_av_invoices.sql</code> in Supabase, then
            refresh. ({invRes.error.message})
          </p>
        </div>
      </AvErpPage>
    );
  }

  const invoices = (invRes.data ?? []).map((row) => {
    const cust = row.av_customers as
      | { name: string }
      | { name: string }[]
      | null;
    const opp = row.av_opportunities as
      | { reference: string }
      | { reference: string }[]
      | null;
    const c = Array.isArray(cust) ? cust[0] : cust;
    const o = Array.isArray(opp) ? opp[0] : opp;
    return {
      id: row.id as string,
      reference: row.reference as string,
      opportunity_id: (row.opportunity_id as string | null) ?? null,
      customer_id: (row.customer_id as string | null) ?? null,
      subject: row.subject as string,
      status: row.status as AvInvoice["status"],
      issued_at: (row.issued_at as string | null) ?? null,
      due_at: (row.due_at as string | null) ?? null,
      subtotal: Number(row.subtotal) || 0,
      total: Number(row.total) || 0,
      amount_paid: Number(row.amount_paid) || 0,
      amount_credited: Number(row.amount_credited) || 0,
      notes: (row.notes as string) || "",
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      customer_name: c?.name ?? null,
      opportunity_reference: o?.reference ?? null,
    };
  });

  return (
    <InvoicesListClient
      invoices={invoices}
      billableOpportunities={(oppsRes.data ?? []).map((o) => ({
        id: o.id as string,
        reference: o.reference as string,
        subject: (o.subject as string) || "Untitled",
        status: o.status as string,
      }))}
      initialFilter={initialFilter}
    />
  );
}
