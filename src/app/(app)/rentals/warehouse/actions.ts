"use server";

import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";
import {
  heldByKey,
  remainingToCheckOut,
  stillOutByKey,
  type GearMovementRow,
  type HoldQtyRow,
} from "@/lib/av-erp/warehouse";

export type WarehouseActionResult =
  | { ok: true }
  | { ok: false; error: string };

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string) {
  const n = Number(str(formData, key));
  return Number.isFinite(n) ? n : 0;
}

function revalidateWarehouse() {
  revalidatePath("/rentals/warehouse");
  revalidatePath("/rentals/stock");
  revalidatePath("/rentals");
}

/** Check gear out against a reserved hold. */
export async function checkGearOutAction(
  formData: FormData,
): Promise<WarehouseActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const opportunityId = str(formData, "opportunity_id");
  const productId = str(formData, "product_id");
  const qty = Math.max(0, num(formData, "qty"));
  const notes = str(formData, "notes");

  if (!opportunityId || !productId) {
    return { ok: false, error: "Pick an estimate and product." };
  }
  if (qty <= 0) return { ok: false, error: "Qty must be greater than zero." };

  const [holdsRes, movesRes] = await Promise.all([
    supabase
      .from("av_holds")
      .select("opportunity_id, product_id, qty")
      .eq("opportunity_id", opportunityId)
      .eq("product_id", productId),
    supabase
      .from("av_gear_movements")
      .select("opportunity_id, product_id, direction, qty")
      .eq("opportunity_id", opportunityId)
      .eq("product_id", productId),
  ]);
  if (holdsRes.error) return { ok: false, error: holdsRes.error.message };
  if (movesRes.error) return { ok: false, error: movesRes.error.message };

  const held =
    heldByKey((holdsRes.data ?? []) as HoldQtyRow[]).get(
      `${opportunityId}::${productId}`,
    ) ?? 0;
  const still =
    stillOutByKey((movesRes.data ?? []) as GearMovementRow[]).get(
      `${opportunityId}::${productId}`,
    ) ?? 0;
  const remaining = remainingToCheckOut(held, still);
  if (qty > remaining) {
    return {
      ok: false,
      error: `Only ${remaining} left to check out against holds (held ${held}, already out ${still}).`,
    };
  }

  const { error: insertError } = await supabase.from("av_gear_movements").insert({
    opportunity_id: opportunityId,
    product_id: productId,
    direction: "out",
    qty,
    notes,
    created_by: profile.id,
  });
  if (insertError) return { ok: false, error: insertError.message };

  // Promote quotation → order when gear leaves the building
  const { data: opp } = await supabase
    .from("av_opportunities")
    .select("status")
    .eq("id", opportunityId)
    .maybeSingle();
  if (opp?.status === "quotation" || opp?.status === "draft") {
    await supabase
      .from("av_opportunities")
      .update({ status: "order" })
      .eq("id", opportunityId);
  }

  revalidateWarehouse();
  revalidatePath(`/rentals/quotes/${opportunityId}`);
  return { ok: true };
}

/** Check gear back in from still-out. */
export async function checkGearBackAction(
  formData: FormData,
): Promise<WarehouseActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const opportunityId = str(formData, "opportunity_id");
  const productId = str(formData, "product_id");
  const qty = Math.max(0, num(formData, "qty"));
  const notes = str(formData, "notes");

  if (!opportunityId || !productId) {
    return { ok: false, error: "Pick an estimate and product." };
  }
  if (qty <= 0) return { ok: false, error: "Qty must be greater than zero." };

  const { data: moves, error: movesError } = await supabase
    .from("av_gear_movements")
    .select("opportunity_id, product_id, direction, qty")
    .eq("opportunity_id", opportunityId)
    .eq("product_id", productId);
  if (movesError) return { ok: false, error: movesError.message };

  const still =
    stillOutByKey((moves ?? []) as GearMovementRow[]).get(
      `${opportunityId}::${productId}`,
    ) ?? 0;
  if (qty > still) {
    return {
      ok: false,
      error: `Only ${still} still out for this quote/product.`,
    };
  }

  const { error: insertError } = await supabase.from("av_gear_movements").insert({
    opportunity_id: opportunityId,
    product_id: productId,
    direction: "back",
    qty,
    notes,
    created_by: profile.id,
  });
  if (insertError) return { ok: false, error: insertError.message };

  revalidateWarehouse();
  revalidatePath(`/rentals/quotes/${opportunityId}`);
  return { ok: true };
}
