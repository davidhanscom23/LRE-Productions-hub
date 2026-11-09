"use server";

import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";
import { saveShopDefaultSalesTaxRatePct } from "@/lib/av-erp/shop-tax";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export type AvErpActionResult = { ok: true } | { ok: false; error: string };

export async function saveDefaultSalesTaxRateAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  const rate = Number(str(formData, "tax_rate_pct") || "0");
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return { ok: false, error: "Tax rate must be between 0 and 100." };
  }
  const saved = await saveShopDefaultSalesTaxRatePct(supabase, rate);
  if (!saved.ok) return saved;
  revalidatePath("/rentals/templates");
  revalidatePath("/rentals/invoices");
  return { ok: true };
}

const KINDS = new Set(["estimate", "invoice", "other"]);

export async function createDocumentTemplateAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const name = str(formData, "name");
  const kind = str(formData, "kind") || "estimate";
  if (!name) return { ok: false, error: "Name is required." };
  if (!KINDS.has(kind)) return { ok: false, error: "Invalid template kind." };

  const isDefault = str(formData, "is_default") === "on";
  if (isDefault) {
    await supabase
      .from("av_document_templates")
      .update({ is_default: false })
      .eq("kind", kind)
      .eq("is_default", true);
  }

  const { error: insertError } = await supabase
    .from("av_document_templates")
    .insert({
      name,
      kind,
      terms: str(formData, "terms"),
      is_default: isDefault,
      is_active: true,
      created_by: profile.id,
    });
  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath("/rentals/templates");
  return { ok: true };
}

export async function updateDocumentTemplateAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  const name = str(formData, "name");
  const kind = str(formData, "kind") || "estimate";
  if (!id || !name) return { ok: false, error: "Name is required." };
  if (!KINDS.has(kind)) return { ok: false, error: "Invalid template kind." };

  const isDefault = str(formData, "is_default") === "on";
  if (isDefault) {
    await supabase
      .from("av_document_templates")
      .update({ is_default: false })
      .eq("kind", kind)
      .eq("is_default", true)
      .neq("id", id);
  }

  const { error: updateError } = await supabase
    .from("av_document_templates")
    .update({
      name,
      kind,
      terms: str(formData, "terms"),
      is_default: isDefault,
      is_active: str(formData, "is_active") === "on",
    })
    .eq("id", id);
  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/rentals/templates");
  return { ok: true };
}
