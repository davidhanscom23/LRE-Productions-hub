import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import {
  RequestsInbox,
  type RequestRow,
} from "@/components/venue-portal-admin/requests-inbox";

export const metadata = { title: "Venue quote requests" };

export default async function VenueQuoteRequestsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venue_portal_quote_requests")
    .select("*, venue_portals(name)")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return (
      <p className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
        Run migration <code>134_venue_quote_portals.sql</code> in Supabase, then refresh. ({error.message})
      </p>
    );
  }

  const rows: RequestRow[] = (data ?? []).map((r) => {
    const portal = r.venue_portals as { name?: string } | { name?: string }[] | null;
    const venue = Array.isArray(portal) ? portal[0]?.name : portal?.name;
    const totals = (r.totals ?? {}) as { total?: number };
    return {
      id: r.id as string,
      venue: venue ?? "Venue",
      createdAt: r.created_at as string,
      kind: r.submit_kind as string,
      role: r.requester_role as string,
      contact: `${r.contact_first} ${r.contact_last}`.trim(),
      contactEmail: r.contact_email as string,
      contactPhone: r.contact_phone as string,
      client: `${r.client_first} ${r.client_last}`.trim(),
      clientEmail: r.client_email as string,
      eventType: r.event_type as string,
      guests: (r.guest_count as number | null) ?? null,
      days: (r.event_days ?? []) as {
        date?: string;
        startTime?: string;
        endTime?: string;
        start?: string;
        end?: string;
      }[],
      notes: r.notes as string,
      total: Number(totals.total ?? 0),
      status: r.status as string,
      depositAmount: Number(r.deposit_amount ?? 0),
      depositStatus: (r.deposit_status as string) || "none",
      opportunityId:
        ((r as { opportunity_id?: string | null }).opportunity_id as
          | string
          | null
          | undefined) ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/venue-quotes" className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)]">
        <ArrowLeft className="h-4 w-4" /> Venue Quotes
      </Link>
      <h1 className="text-2xl font-semibold">Quote requests</h1>
      <RequestsInbox rows={rows} />
    </div>
  );
}
