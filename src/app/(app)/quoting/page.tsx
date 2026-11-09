import { QuotingListClient } from "@/components/quoting/quoting-list-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type {
  Quote,
  QuoteDiscountApproval,
  QuotePricingNote,
} from "@/lib/types/quoting";
import { redirect } from "next/navigation";

export default async function QuotingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  const { data: noteRows, error: notesError } = await supabase
    .from("quote_pricing_notes")
    .select("*")
    .order("department", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (notesError) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Quoting needs a database update</p>
        <p className="mt-2">
          Run migration <code>122_quoting.sql</code> in Supabase, then refresh.
          ({notesError.message})
        </p>
      </div>
    );
  }

  const updaterIds = Array.from(
    new Set(
      ((noteRows ?? []) as Record<string, unknown>[])
        .map((r) => (r.updated_by ? String(r.updated_by) : ""))
        .filter(Boolean),
    ),
  );
  const { data: notePeople } = updaterIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", updaterIds)
    : { data: [] as { id: string; full_name: string }[] };
  const noteNameById = new Map(
    (notePeople ?? []).map((p) => [p.id as string, p.full_name as string]),
  );

  const notes: QuotePricingNote[] = (
    (noteRows ?? []) as Record<string, unknown>[]
  ).map((r) => ({
    id: String(r.id),
    department: String(r.department ?? "General"),
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    sort_order: Number(r.sort_order) || 0,
    updated_at: String(r.updated_at ?? ""),
    updated_by_name: r.updated_by
      ? noteNameById.get(String(r.updated_by))
      : undefined,
  }));

  let quoteQuery = supabase
    .from("quotes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (!isAdmin) {
    quoteQuery = quoteQuery.eq("created_by", profile.id);
  }
  const { data: quoteRows } = await quoteQuery;

  const creatorIds = Array.from(
    new Set(
      ((quoteRows ?? []) as Record<string, unknown>[]).map((r) =>
        String(r.created_by),
      ),
    ),
  );
  const { data: creators } = creatorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", creatorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const creatorNameById = new Map(
    (creators ?? []).map((p) => [p.id as string, p.full_name as string]),
  );

  const quotes: Quote[] = ((quoteRows ?? []) as Record<string, unknown>[]).map(
    (r) => ({
      id: String(r.id),
      created_by: String(r.created_by),
      client_name: String(r.client_name ?? ""),
      event_name: String(r.event_name ?? ""),
      event_date: (r.event_date as string) ?? null,
      department: String(r.department ?? "General"),
      status: (r.status as Quote["status"]) ?? "draft",
      notes: String(r.notes ?? ""),
      created_at: String(r.created_at ?? ""),
      updated_at: String(r.updated_at ?? ""),
      creator_name: creatorNameById.get(String(r.created_by)),
    }),
  );

  let pendingApprovals: QuoteDiscountApproval[] = [];
  if (isAdmin) {
    const { data: approvalRows } = await supabase
      .from("quote_discount_approvals")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    const requesterIds = Array.from(
      new Set(
        ((approvalRows ?? []) as Record<string, unknown>[])
          .map((r) => (r.requested_by ? String(r.requested_by) : ""))
          .filter(Boolean),
      ),
    );
    const { data: requesters } = requesterIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", requesterIds)
      : { data: [] as { id: string; full_name: string }[] };
    const reqNameById = new Map(
      (requesters ?? []).map((p) => [p.id as string, p.full_name as string]),
    );
    pendingApprovals = ((approvalRows ?? []) as Record<string, unknown>[]).map(
      (r) => ({
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
        status: "pending",
        review_note: String(r.review_note ?? ""),
        created_at: String(r.created_at ?? ""),
        reviewed_at: (r.reviewed_at as string) ?? null,
        requester_name: r.requested_by
          ? reqNameById.get(String(r.requested_by))
          : undefined,
      }),
    );
  }

  return (
    <QuotingListClient
      isAdmin={isAdmin}
      notes={notes}
      quotes={quotes}
      pendingApprovals={pendingApprovals}
    />
  );
}
