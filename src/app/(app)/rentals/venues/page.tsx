import { redirect } from "next/navigation";
import { VenuesClient } from "@/components/av-erp/venues-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import type { AvJobVenue } from "@/lib/av-erp/types";
import { createClient } from "@/lib/supabase/server";
import { canAccessAv } from "@/lib/av-access";

export const metadata = { title: "Venues — LRE AV" };

export default async function AvVenuesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessAv(profile)) redirect("/rentals");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("av_job_venues")
    .select(
      "id, name, contact_name, email, phone, address_line1, address_line2, city, region, postal_code, country, access_notes, power_notes, parking_notes, notes, is_retired, external_rms_id, created_at, updated_at",
    )
    .order("name");

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">AV Venues needs a database update</p>
        <p className="mt-2">
          Run migration <code>140_av_erp_core.sql</code> in Supabase, then
          refresh. ({error.message})
        </p>
      </div>
    );
  }

  return <VenuesClient venues={(data ?? []) as AvJobVenue[]} />;
}
