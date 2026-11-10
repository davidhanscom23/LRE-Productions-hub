import { redirect } from "next/navigation";
import { CustomersClient } from "@/components/av-erp/customers-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import type { AvCustomer } from "@/lib/av-erp/types";
import { createClient } from "@/lib/supabase/server";
import { canAccessVidentAv } from "@/lib/vident-av-access";

export const metadata = { title: "Customers — LRE AV" };

export default async function AvCustomersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessVidentAv(profile)) redirect("/rentals");

  const supabase = await createClient();
  let { data, error } = await supabase
    .from("av_customers")
    .select(
      "id, name, contact_name, email, phone, address_line1, address_line2, city, region, postal_code, country, standing_discount_pct, tax_exempt, notes, is_quotable, is_retired, external_rms_id, created_at, updated_at",
    )
    .order("name");

  if (error) {
    const fallback = await supabase
      .from("av_customers")
      .select(
        "id, name, contact_name, email, phone, address_line1, address_line2, city, region, postal_code, country, standing_discount_pct, notes, is_quotable, is_retired, external_rms_id, created_at, updated_at",
      )
      .order("name");
    if (fallback.error) {
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">AV Customers needs a database update</p>
          <p className="mt-2">
            Run migration <code>140_av_erp_core.sql</code> in Supabase, then
            refresh. ({fallback.error.message})
          </p>
        </div>
      );
    }
    data = (fallback.data ?? []).map((c) => ({ ...c, tax_exempt: false }));
    error = null;
  }

  return <CustomersClient customers={(data ?? []) as AvCustomer[]} />;
}
