import { redirect } from "next/navigation";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import { ContractorsClient } from "@/components/av-erp/contractors-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import type { AvContractor } from "@/lib/av-erp/types";
import { createClient } from "@/lib/supabase/server";
import { canAccessAv } from "@/lib/av-access";

export const metadata = { title: "Contractors — LRE AV" };

export default async function AvContractorsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessAv(profile)) redirect("/rentals");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("av_contractors")
    .select(
      "id, name, contact_name, email, phone, skills, day_rate, hour_rate, notes, is_active, created_at, updated_at",
    )
    .order("name");

  if (error) {
    return (
      <AvErpPage maxWidthClassName="max-w-3xl">
        <div className="max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Contractors needs a database update</p>
          <p className="mt-2">
            Run migration <code>151_av_km_gaps.sql</code> in Supabase, then
            refresh. ({error.message})
          </p>
        </div>
      </AvErpPage>
    );
  }

  return (
    <ContractorsClient
      contractors={(data ?? []).map((row) => ({
        ...row,
        skills: Array.isArray(row.skills) ? (row.skills as string[]) : [],
        day_rate: row.day_rate == null ? null : Number(row.day_rate),
        hour_rate: row.hour_rate == null ? null : Number(row.hour_rate),
      })) as AvContractor[]}
    />
  );
}
