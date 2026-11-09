"use server";

import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numPct(formData: FormData, key: string) {
  const n = Number(str(formData, key) || "0");
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, n);
}

export type AvErpActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function createCustomerAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const name = str(formData, "name");
  if (!name) return { ok: false, error: "Name is required." };

  const { data, error: insertError } = await supabase
    .from("av_customers")
    .insert({
      name,
      contact_name: str(formData, "contact_name"),
      email: str(formData, "email").toLowerCase(),
      phone: str(formData, "phone"),
      address_line1: str(formData, "address_line1"),
      city: str(formData, "city"),
      region: str(formData, "region"),
      postal_code: str(formData, "postal_code"),
      notes: str(formData, "notes"),
      standing_discount_pct: numPct(formData, "standing_discount_pct"),
      tax_exempt: str(formData, "tax_exempt") === "on",
      is_quotable: str(formData, "is_quotable") !== "off",
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (insertError) {
    if (/tax_exempt|column/i.test(insertError.message)) {
      return {
        ok: false,
        error:
          "Customer tax exempt needs migration 153_av_tax_co_lines_signed.sql in Supabase.",
      };
    }
    return { ok: false, error: insertError.message };
  }

  revalidatePath("/rentals/customers");
  revalidatePath("/rentals/quotes");
  return { ok: true, id: data.id };
}

export async function updateCustomerAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return { ok: false, error: "Name is required." };

  const { error: updateError } = await supabase
    .from("av_customers")
    .update({
      name,
      contact_name: str(formData, "contact_name"),
      email: str(formData, "email").toLowerCase(),
      phone: str(formData, "phone"),
      address_line1: str(formData, "address_line1"),
      city: str(formData, "city"),
      region: str(formData, "region"),
      postal_code: str(formData, "postal_code"),
      notes: str(formData, "notes"),
      standing_discount_pct: numPct(formData, "standing_discount_pct"),
      tax_exempt: str(formData, "tax_exempt") === "on",
      is_quotable: str(formData, "is_quotable") === "on",
      is_retired: str(formData, "is_retired") === "on",
    })
    .eq("id", id);
  if (updateError) {
    if (/tax_exempt|column/i.test(updateError.message)) {
      return {
        ok: false,
        error:
          "Customer tax exempt needs migration 153_av_tax_co_lines_signed.sql in Supabase.",
      };
    }
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/rentals/customers");
  return { ok: true };
}
