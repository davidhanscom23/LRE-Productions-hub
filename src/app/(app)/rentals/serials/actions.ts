"use server";

import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export type AvErpActionResult = { ok: true } | { ok: false; error: string };

export async function createProductUnitAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const productId = str(formData, "product_id");
  const serial = str(formData, "serial");
  if (!productId || !serial) {
    return { ok: false, error: "Product and serial are required." };
  }

  const { error: insertError } = await supabase.from("av_product_units").insert({
    product_id: productId,
    serial,
    barcode: str(formData, "barcode") || serial,
    status: "in",
    notes: str(formData, "notes"),
  });
  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath("/rentals/serials");
  revalidatePath("/rentals/warehouse");
  revalidatePath("/rentals/stock");
  return { ok: true };
}

export async function updateProductUnitStatusAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!id || !["in", "out", "retired"].includes(status)) {
    return { ok: false, error: "Invalid unit status." };
  }

  const { error: updateError } = await supabase
    .from("av_product_units")
    .update({ status })
    .eq("id", id);
  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/rentals/serials");
  revalidatePath("/rentals/warehouse");
  return { ok: true };
}
