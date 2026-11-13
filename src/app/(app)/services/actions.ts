"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { canManagePipelineCrm } from "@/lib/pipeline/access";
import { categoryOf, SERVICE_CATEGORIES } from "@/lib/services-catalog/categories";
import { cleanCategoryName } from "@/lib/services-catalog/category-list";
import { PIPELINE_SERVICES_SEED } from "@/lib/services-catalog/seed";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireEditor() {
  const profile = await getCurrentProfile();
  if (!profile || !canManagePipelineCrm(profile.role)) return null;
  return profile;
}

type Input = { id?: string; name: string; description: string; category: string; unitPrice: number; active: boolean };

function clean(i: Input) {
  const name = i.name.trim().slice(0, 200);
  const price = Math.round(Number(i.unitPrice) * 100) / 100;
  if (!name) return { error: "Give the service a name." } as const;
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return { error: "Enter a price of $0 or more." } as const;
  const category = cleanCategoryName(i.category) || "Other";
  return { row: { name, description: i.description.trim().slice(0, 1000), category, unit_price: price, active: i.active } } as const;
}

export async function saveServiceAction(input: Input): Promise<{ error: string | null }> {
  const profile = await requireEditor();
  if (!profile) return { error: "Only admins and Leads can edit the catalog." };
  const c = clean(input);
  if (!c.row) return { error: c.error ?? "Check the details and try again." };
  const supabase = await createClient();
  const q = input.id
    ? supabase.from("service_catalog_items").update({ ...c.row, updated_at: new Date().toISOString() }).eq("id", input.id)
    : supabase.from("service_catalog_items").insert({ ...c.row, created_by: profile.id });
  const { error } = await q;
  if (error) return { error: error.code === "23505" ? "A service with that name already exists." : error.message };
  revalidatePath("/services");
  return { error: null };
}

/** Add every Pipeline service that isn't already in the catalog. Safe to run twice. */
export async function importPipelineServicesAction(): Promise<{ error: string | null; added: number; skipped: number }> {
  const profile = await requireEditor();
  if (!profile) return { error: "Only admins and Leads can import.", added: 0, skipped: 0 };
  const supabase = await createClient();
  const { data: existing, error: readErr } = await supabase.from("service_catalog_items").select("name");
  if (readErr) return { error: readErr.message, added: 0, skipped: 0 };
  const have = new Set((existing ?? []).map((r) => String(r.name).trim().toLowerCase()));
  const fresh = PIPELINE_SERVICES_SEED.filter(([n]) => !have.has(n.trim().toLowerCase())).map(([name, price]) => ({
    name,
    category: categoryOf(name),
    unit_price: price,
    created_by: profile.id,
  }));
  if (fresh.length) {
    const { error } = await supabase.from("service_catalog_items").insert(fresh);
    if (error) return { error: error.message, added: 0, skipped: 0 };
  }
  revalidatePath("/services");
  return { error: null, added: fresh.length, skipped: PIPELINE_SERVICES_SEED.length - fresh.length };
}

const categoryMissing = "Categories need migration 188_service_categories_invoice_sections.sql.";

export async function addCategoryAction(name: string): Promise<{ error: string | null }> {
  const profile = await requireEditor();
  if (!profile) return { error: "Only admins and Leads can add categories." };
  const clean = cleanCategoryName(name);
  if (!clean) return { error: "Type a category name." };
  const supabase = await createClient();
  const { error } = await supabase.from("service_categories").insert({ name: clean });
  if (error) {
    if (error.code === "23505") return { error: "That category already exists." };
    return { error: error.code === "42P01" ? categoryMissing : error.message };
  }
  revalidatePath("/services");
  return { error: null };
}

/** Rename a category everywhere: the category list and every item that uses it. */
export async function renameCategoryAction(from: string, to: string): Promise<{ error: string | null }> {
  const profile = await requireEditor();
  if (!profile) return { error: "Only admins and Leads can rename categories." };
  const next = cleanCategoryName(to);
  if (!next) return { error: "Type a category name." };
  if ((SERVICE_CATEGORIES as readonly string[]).includes(from)) return { error: "The built-in categories can't be renamed." };
  const supabase = await createClient();
  const { error: e1 } = await supabase.from("service_categories").update({ name: next }).eq("name", from);
  if (e1) {
    if (e1.code === "23505") return { error: "A category with that name already exists." };
    return { error: e1.code === "42P01" ? categoryMissing : e1.message };
  }
  const { error: e2 } = await supabase.from("service_catalog_items").update({ category: next }).eq("category", from);
  if (e2) return { error: e2.message };
  revalidatePath("/services");
  return { error: null };
}

/** Delete a custom category, only when no item uses it. */
export async function deleteCategoryAction(name: string): Promise<{ error: string | null }> {
  const profile = await requireEditor();
  if (!profile) return { error: "Only admins and Leads can delete categories." };
  if ((SERVICE_CATEGORIES as readonly string[]).includes(name)) return { error: "The built-in categories can't be deleted." };
  const supabase = await createClient();
  const { count, error: ce } = await supabase
    .from("service_catalog_items")
    .select("id", { count: "exact", head: true })
    .eq("category", name);
  if (ce) return { error: ce.message };
  if ((count ?? 0) > 0) return { error: `${count} item(s) still use "${name}". Move them to another category first.` };
  const { error } = await supabase.from("service_categories").delete().eq("name", name);
  if (error) return { error: error.code === "42P01" ? categoryMissing : error.message };
  revalidatePath("/services");
  return { error: null };
}
