import { redirect } from "next/navigation";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import { TemplatesClient } from "@/components/av-erp/templates-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { loadShopDefaultSalesTaxRatePct } from "@/lib/av-erp/shop-tax";
import type { AvDocumentTemplate } from "@/lib/av-erp/types";
import { createClient } from "@/lib/supabase/server";
import { canAccessAv } from "@/lib/av-access";

export const metadata = { title: "Templates — LRE AV" };

export default async function AvTemplatesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessAv(profile)) redirect("/rentals");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("av_document_templates")
    .select(
      "id, name, kind, terms, is_default, is_active, created_at, updated_at",
    )
    .order("kind")
    .order("name");

  if (error) {
    return (
      <AvErpPage maxWidthClassName="max-w-3xl">
        <div className="max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Templates needs a database update</p>
          <p className="mt-2">
            Run migration <code>151_av_km_gaps.sql</code> in Supabase, then
            refresh. ({error.message})
          </p>
        </div>
      </AvErpPage>
    );
  }

  const defaultSalesTaxRatePct = await loadShopDefaultSalesTaxRatePct(supabase);

  return (
    <TemplatesClient
      templates={(data ?? []) as AvDocumentTemplate[]}
      defaultSalesTaxRatePct={defaultSalesTaxRatePct}
    />
  );
}