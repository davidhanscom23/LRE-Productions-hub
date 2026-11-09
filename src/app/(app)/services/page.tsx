import { ServicesClient, type ServiceRow } from "@/components/services/services-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canAccessHoneyBook, canManageHoneyBookCrm } from "@/lib/honeybook/access";
import { mergeCategories } from "@/lib/services-catalog/category-list";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ServicesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessHoneyBook(profile.role)) redirect("/");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_catalog_items")
    .select("id, name, description, category, unit_price, active")
    .order("category")
    .order("name")
    .limit(2000);
  const rows = (data ?? []).map((r) => ({ ...r, unit_price: Number(r.unit_price) })) as ServiceRow[];
  // Tolerant before migration 188: no table just means no custom categories yet.
  const { data: custom } = await supabase.from("service_categories").select("name").order("sort_order").order("name");
  const customNames = (custom ?? []).map((c) => String(c.name));
  const categories = mergeCategories(customNames, rows.map((r) => r.category));
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Services catalog</h1>
        <p className="text-sm text-[var(--muted)]">
          Saved services and prices to drop into proposals and invoices. Everyone can look things up; admins and Leads can edit.
        </p>
      </div>
      {error ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          The catalog needs migration 180_service_catalog.sql. {error.message}
        </p>
      ) : (
        <ServicesClient rows={rows} categories={categories} customCategories={customNames} canEdit={canManageHoneyBookCrm(profile.role)} />
      )}
    </div>
  );
}
