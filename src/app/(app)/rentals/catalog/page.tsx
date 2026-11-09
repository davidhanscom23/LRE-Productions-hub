import { redirect } from "next/navigation";
import { CatalogClient } from "@/components/av-erp/catalog-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import type {
  AvProduct,
  AvProductAccessory,
  AvProductGroup,
  AvService,
} from "@/lib/av-erp/types";
import { createClient } from "@/lib/supabase/server";
import { canAccessVidentAv } from "@/lib/vident-av-access";

export const metadata = { title: "Catalog — Vident AV" };

export default async function AvCatalogPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessVidentAv(profile)) redirect("/rentals");

  const supabase = await createClient();
  const [productsRes, servicesRes, groupsRes, accessoriesRes] =
    await Promise.all([
      supabase
        .from("av_products")
        .select(
          "id, group_id, name, code, description, kind, rental_price, sale_price, replacement_charge, qty_owned, buffer_pct, turnaround_hours, weight_lbs, photo_path, is_active, external_rms_id, last_used_event, last_used_at, last_user:profiles!last_used_by(full_name)",
        )
        .order("name"),
      supabase
        .from("av_services")
        .select(
          "id, name, code, description, kind, unit_price, is_active, external_rms_id",
        )
        .order("name"),
      supabase
        .from("av_product_groups")
        .select("id, name, sort_order, is_active")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("av_product_accessories")
        .select("*"),
    ]);

  const err =
    productsRes.error?.message ||
    servicesRes.error?.message ||
    groupsRes.error?.message ||
    accessoriesRes.error?.message;
  if (err) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">AV Catalog needs a database update</p>
        <p className="mt-2">
          Run migration <code>140_av_erp_core.sql</code> in Supabase, then
          refresh. ({err})
        </p>
      </div>
    );
  }

  return (
    <CatalogClient
      products={(productsRes.data ?? []).map((row) => {
        const { last_user, ...rest } = row as typeof row & {
          last_user?: { full_name?: string } | { full_name?: string }[] | null;
        };
        const user = Array.isArray(last_user) ? last_user[0] : last_user;
        return { ...rest, last_used_by_name: user?.full_name ?? null } as AvProduct;
      })}
      services={(servicesRes.data ?? []) as AvService[]}
      groups={(groupsRes.data ?? []) as AvProductGroup[]}
      accessories={(accessoriesRes.data ?? []) as AvProductAccessory[]}
    />
  );
}
