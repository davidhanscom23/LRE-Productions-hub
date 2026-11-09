"use server";

import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export type AvErpActionResult = { ok: true } | { ok: false; error: string };

export async function createSupplierAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const name = str(formData, "name");
  if (!name) return { ok: false, error: "Name is required." };

  const { error: insertError } = await supabase.from("av_suppliers").insert({
    name,
    contact_name: str(formData, "contact_name"),
    email: str(formData, "email").toLowerCase(),
    phone: str(formData, "phone"),
    notes: str(formData, "notes"),
    is_active: str(formData, "is_active") !== "off",
    created_by: profile.id,
  });
  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath("/rentals/suppliers");
  return { ok: true };
}

export async function updateSupplierAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return { ok: false, error: "Name is required." };

  const { error: updateError } = await supabase
    .from("av_suppliers")
    .update({
      name,
      contact_name: str(formData, "contact_name"),
      email: str(formData, "email").toLowerCase(),
      phone: str(formData, "phone"),
      notes: str(formData, "notes"),
      is_active: str(formData, "is_active") === "on",
    })
    .eq("id", id);
  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/rentals/suppliers");
  return { ok: true };
}
