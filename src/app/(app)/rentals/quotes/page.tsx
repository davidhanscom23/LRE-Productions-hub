import { Suspense } from "react";
import { redirect } from "next/navigation";
import { QuotesListClient } from "@/components/av-erp/quotes-list-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import type { AvOpportunity } from "@/lib/av-erp/types";
import { createClient } from "@/lib/supabase/server";
import { canAccessVidentAv } from "@/lib/vident-av-access";

export const metadata = { title: "Estimates — Vident AV" };

export default async function AvQuotesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessVidentAv(profile)) redirect("/rentals");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("av_opportunities")
    .select(
      "id, reference, subject, status, customer_id, venue_id, rate_definition_id, gear_starts_at, gear_ends_at, charge_starts_at, charge_ends_at, bill_whole_event, surcharge_pct, discount_pct, venue_markup_pct, venue_markup_enabled, transport_notes, notes, is_template, source_opportunity_id, external_rms_id, created_at, updated_at",
    )
    .eq("is_template", false)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Estimates need a database update</p>
        <p className="mt-2">
          Run migration <code>140_av_erp_core.sql</code> in Supabase, then
          refresh. ({error.message})
        </p>
      </div>
    );
  }

  const opps = (data ?? []) as AvOpportunity[];
  const customerIds = [
    ...new Set(opps.map((o) => o.customer_id).filter(Boolean)),
  ] as string[];
  const venueIds = [
    ...new Set(opps.map((o) => o.venue_id).filter(Boolean)),
  ] as string[];
  const oppIds = opps.map((o) => o.id);

  const [{ data: customers }, { data: venues }, { data: holdRows }] =
    await Promise.all([
      customerIds.length
        ? supabase.from("av_customers").select("id, name").in("id", customerIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      venueIds.length
        ? supabase.from("av_job_venues").select("id, name").in("id", venueIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      oppIds.length
        ? supabase
            .from("av_holds")
            .select("opportunity_id")
            .in("opportunity_id", oppIds)
        : Promise.resolve({ data: [] as { opportunity_id: string }[] }),
    ]);

  const customerName = new Map(
    (customers ?? []).map((c) => [c.id as string, c.name as string]),
  );
  const venueName = new Map(
    (venues ?? []).map((v) => [v.id as string, v.name as string]),
  );
  const holdCount = new Map<string, number>();
  for (const h of holdRows ?? []) {
    const id = h.opportunity_id as string;
    holdCount.set(id, (holdCount.get(id) ?? 0) + 1);
  }

  const rows = opps.map((o) => ({
    ...o,
    customer_name: o.customer_id
      ? (customerName.get(o.customer_id) ?? null)
      : null,
    venue_name: o.venue_id ? (venueName.get(o.venue_id) ?? null) : null,
    hold_count: holdCount.get(o.id) ?? 0,
  }));

  return (
    <Suspense fallback={null}>
      <QuotesListClient rows={rows} />
    </Suspense>
  );
}
