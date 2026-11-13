import { redirect } from "next/navigation";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import { SerialsClient } from "@/components/av-erp/serials-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canAccessAv } from "@/lib/av-access";

export const metadata = { title: "Serials — LRE AV" };

export default async function AvSerialsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessAv(profile)) redirect("/rentals");

  const supabase = await createClient();
  const [unitsRes, productsRes] = await Promise.all([
    supabase
      .from("av_product_units")
      .select(
        "id, product_id, serial, barcode, status, notes, created_at, updated_at, av_products ( name, code )",
      )
      .order("serial"),
    supabase
      .from("av_products")
      .select("id, name, code")
      .eq("is_active", true)
      .neq("kind", "package")
      .order("name")
      .limit(500),
  ]);

  if (unitsRes.error) {
    return (
      <AvErpPage maxWidthClassName="max-w-3xl">
        <div className="max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Serials needs a database update</p>
          <p className="mt-2">
            Run migration <code>151_av_km_gaps.sql</code> in Supabase, then
            refresh. ({unitsRes.error.message})
          </p>
        </div>
      </AvErpPage>
    );
  }

  const units = (unitsRes.data ?? []).map((row) => {
    const product = row.av_products as
      | { name: string; code: string }
      | { name: string; code: string }[]
      | null;
    const p = Array.isArray(product) ? product[0] : product;
    return {
      id: row.id as string,
      product_id: row.product_id as string,
      serial: row.serial as string,
      barcode: (row.barcode as string) || "",
      status: row.status as "in" | "out" | "retired",
      notes: (row.notes as string) || "",
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      product_name: p?.name ?? "—",
      product_code: p?.code ?? "",
    };
  });

  return (
    <SerialsClient
      units={units}
      products={(productsRes.data ?? []).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        code: (p.code as string) || "",
      }))}
    />
  );
}