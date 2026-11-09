import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import {
  VenueQuotesList,
  type PortalListRow,
} from "@/components/venue-portal-admin/venue-quotes-list";

export const metadata = { title: "Venue Quotes" };

export default async function VenueQuotesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venue_portals")
    .select("id, slug, name, is_published, updated_at")
    .order("name");

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Venue Quotes needs a database update</p>
        <p className="mt-2">
          Run migration <code>134_venue_quote_portals.sql</code> in Supabase, then refresh. ({error.message})
        </p>
      </div>
    );
  }

  const { data: reqs } = await supabase
    .from("venue_portal_quote_requests")
    .select("portal_id, status");
  const counts = new Map<string, { total: number; fresh: number }>();
  for (const r of reqs ?? []) {
    const c = counts.get(r.portal_id as string) ?? { total: 0, fresh: 0 };
    c.total += 1;
    if (r.status === "new") c.fresh += 1;
    counts.set(r.portal_id as string, c);
  }

  const rows: PortalListRow[] = (data ?? []).map((p) => ({
    id: p.id as string,
    slug: p.slug as string,
    name: p.name as string,
    isPublished: !!p.is_published,
    total: counts.get(p.id as string)?.total ?? 0,
    fresh: counts.get(p.id as string)?.fresh ?? 0,
  }));

  return <VenueQuotesList rows={rows} />;
}
