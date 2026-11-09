import { redirect } from "next/navigation";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import { SuppliersClient } from "@/components/av-erp/suppliers-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import type { AvSupplier } from "@/lib/av-erp/types";
import { createClient } from "@/lib/supabase/server";
import { canAccessVidentAv } from "@/lib/vident-av-access";

export const metadata = { title: "Suppliers — Vident AV" };

export default async function AvSuppliersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessVidentAv(profile)) redirect("/rentals");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("av_suppliers")
    .select(
      "id, name, contact_name, email, phone, notes, is_active, external_rms_id, created_at, updated_at",
    )
    .order("name");

  if (error) {
    return (
      <AvErpPage maxWidthClassName="max-w-3xl">
        <div className="max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Suppliers needs a database update</p>
          <p className="mt-2">
            Run migration <code>144_av_invoices.sql</code> in Supabase, then
            refresh. ({error.message})
          </p>
        </div>
      </AvErpPage>
    );
  }

  return <SuppliersClient suppliers={(data ?? []) as AvSupplier[]} />;
}
