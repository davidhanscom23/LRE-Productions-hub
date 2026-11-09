"use server";

import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";
import type { AvProductKind, AvServiceKind } from "@/lib/av-erp/types";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string, fallback = 0) {
  const n = Number(str(formData, key) || String(fallback));
  return Number.isFinite(n) ? n : fallback;
}

export type AvErpActionResult = { ok: true } | { ok: false; error: string };

const PRODUCT_KINDS: AvProductKind[] = [
  "rental",
  "package",
  "sale",
  "consumable",
];
const SERVICE_KINDS: AvServiceKind[] = ["crew", "transport", "fee"];

function revalidateCatalog() {
  revalidatePath("/rentals/catalog");
}

export async function createProductGroupAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  const name = str(formData, "name");
  if (!name) return { ok: false, error: "Section name is required." };
  const { error: insertError } = await supabase
    .from("av_product_groups")
    .insert({ name, sort_order: num(formData, "sort_order") });
  if (insertError) return { ok: false, error: insertError.message };
  revalidateCatalog();
  return { ok: true };
}

export async function createProductAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const name = str(formData, "name");
  if (!name) return { ok: false, error: "Product name is required." };
  const kindRaw = str(formData, "kind") || "rental";
  const kind = PRODUCT_KINDS.includes(kindRaw as AvProductKind)
    ? (kindRaw as AvProductKind)
    : "rental";
  const groupId = str(formData, "group_id") || null;

  const { error: insertError } = await supabase.from("av_products").insert({
    name,
    code: str(formData, "code"),
    description: str(formData, "description"),
    kind,
    group_id: groupId,
    rental_price: Math.max(0, num(formData, "rental_price")),
    qty_owned: Math.max(0, num(formData, "qty_owned")),
    buffer_pct: Math.min(100, Math.max(0, num(formData, "buffer_pct"))),
    turnaround_hours: Math.max(0, Math.floor(num(formData, "turnaround_hours"))),
    replacement_charge: str(formData, "replacement_charge")
      ? Math.max(0, num(formData, "replacement_charge"))
      : null,
  });
  if (insertError) return { ok: false, error: insertError.message };
  revalidateCatalog();
  return { ok: true };
}

export async function updateProductAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return { ok: false, error: "Product name is required." };
  const kindRaw = str(formData, "kind") || "rental";
  const kind = PRODUCT_KINDS.includes(kindRaw as AvProductKind)
    ? (kindRaw as AvProductKind)
    : "rental";

  const { error: updateError } = await supabase
    .from("av_products")
    .update({
      name,
      code: str(formData, "code"),
      description: str(formData, "description"),
      kind,
      group_id: str(formData, "group_id") || null,
      rental_price: Math.max(0, num(formData, "rental_price")),
      qty_owned: Math.max(0, num(formData, "qty_owned")),
      buffer_pct: Math.min(100, Math.max(0, num(formData, "buffer_pct"))),
      turnaround_hours: Math.max(
        0,
        Math.floor(num(formData, "turnaround_hours")),
      ),
      replacement_charge: str(formData, "replacement_charge")
        ? Math.max(0, num(formData, "replacement_charge"))
        : null,
      is_active: str(formData, "is_active") === "on",
    })
    .eq("id", id);
  if (updateError) return { ok: false, error: updateError.message };
  revalidateCatalog();
  return { ok: true };
}

export async function createServiceAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const name = str(formData, "name");
  if (!name) return { ok: false, error: "Service name is required." };
  const kindRaw = str(formData, "kind") || "fee";
  const kind = SERVICE_KINDS.includes(kindRaw as AvServiceKind)
    ? (kindRaw as AvServiceKind)
    : "fee";

  const { error: insertError } = await supabase.from("av_services").insert({
    name,
    code: str(formData, "code"),
    description: str(formData, "description"),
    kind,
    unit_price: Math.max(0, num(formData, "unit_price")),
  });
  if (insertError) return { ok: false, error: insertError.message };
  revalidateCatalog();
  return { ok: true };
}

export async function updateServiceAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return { ok: false, error: "Service name is required." };
  const kindRaw = str(formData, "kind") || "fee";
  const kind = SERVICE_KINDS.includes(kindRaw as AvServiceKind)
    ? (kindRaw as AvServiceKind)
    : "fee";

  const { error: updateError } = await supabase
    .from("av_services")
    .update({
      name,
      code: str(formData, "code"),
      description: str(formData, "description"),
      kind,
      unit_price: Math.max(0, num(formData, "unit_price")),
      is_active: str(formData, "is_active") === "on",
    })
    .eq("id", id);
  if (updateError) return { ok: false, error: updateError.message };
  revalidateCatalog();
  return { ok: true };
}

export async function deleteServiceAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Missing service." };
  // Quote and invoice lines keep their own name and price; the FK to the
  // catalog row is "on delete set null", so history is not affected.
  const { error: delError } = await supabase
    .from("av_services")
    .delete()
    .eq("id", id);
  if (delError) return { ok: false, error: delError.message };
  revalidateCatalog();
  return { ok: true };
}

export async function upsertProductAccessoryAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const parentId = str(formData, "parent_product_id");
  const childId = str(formData, "child_product_id");
  if (!parentId || !childId) {
    return { ok: false, error: "Pick a parent and a comes-with item." };
  }
  if (parentId === childId) {
    return { ok: false, error: "A product cannot come with itself." };
  }
  const qty = Math.max(0.01, num(formData, "qty", 1));
  const isOptional = str(formData, "is_optional") === "on";
  const existingId = str(formData, "id");

  // is_optional needs migration 189; fall back quietly until it is applied.
  const missingOptionalColumn = (msg: string) => /is_optional/i.test(msg);

  if (existingId) {
    let { error: updateError } = await supabase
      .from("av_product_accessories")
      .update({ qty, is_optional: isOptional, child_product_id: childId })
      .eq("id", existingId)
      .eq("parent_product_id", parentId);
    if (updateError && missingOptionalColumn(updateError.message)) {
      if (isOptional) {
        return {
          ok: false,
          error: "Run migration 189 first to use optional items.",
        };
      }
      ({ error: updateError } = await supabase
        .from("av_product_accessories")
        .update({ qty, child_product_id: childId })
        .eq("id", existingId)
        .eq("parent_product_id", parentId));
    }
    if (updateError) return { ok: false, error: updateError.message };
  } else {
    const row = {
      parent_product_id: parentId,
      child_product_id: childId,
      qty,
    };
    let { error: insertError } = await supabase
      .from("av_product_accessories")
      .upsert(
        { ...row, is_optional: isOptional },
        { onConflict: "parent_product_id,child_product_id" },
      );
    if (insertError && missingOptionalColumn(insertError.message)) {
      if (isOptional) {
        return {
          ok: false,
          error: "Run migration 189 first to use optional items.",
        };
      }
      ({ error: insertError } = await supabase
        .from("av_product_accessories")
        .upsert(row, { onConflict: "parent_product_id,child_product_id" }));
    }
    if (insertError) return { ok: false, error: insertError.message };
  }

  revalidateCatalog();
  return { ok: true };
}

export async function removeProductAccessoryAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Missing accessory." };
  const { error: delError } = await supabase
    .from("av_product_accessories")
    .delete()
    .eq("id", id);
  if (delError) return { ok: false, error: delError.message };
  revalidateCatalog();
  return { ok: true };
}

export async function duplicateProductAction(
  productId: string,
): Promise<AvErpActionResult & { id?: string }> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!productId) return { ok: false, error: "Missing product." };

  const { data: source, error: loadError } = await supabase
    .from("av_products")
    .select(
      "name, code, description, kind, group_id, rental_price, sale_price, replacement_charge, buffer_pct, turnaround_hours, weight_lbs, photo_path",
    )
    .eq("id", productId)
    .maybeSingle();
  if (loadError || !source) {
    return { ok: false, error: loadError?.message ?? "Product not found." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("av_products")
    .insert({
      name: `Copy of ${source.name}`,
      code: source.code ? `${source.code}-copy` : "",
      description: source.description,
      kind: source.kind,
      group_id: source.group_id,
      rental_price: source.rental_price,
      sale_price: source.sale_price,
      replacement_charge: source.replacement_charge,
      qty_owned: 0,
      buffer_pct: source.buffer_pct,
      turnaround_hours: source.turnaround_hours,
      weight_lbs: source.weight_lbs,
      photo_path: source.photo_path,
      is_active: true,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return { ok: false, error: insertError?.message ?? "Could not duplicate." };
  }

  const { data: accessories } = await supabase
    .from("av_product_accessories")
    .select("*")
    .eq("parent_product_id", productId);

  if (accessories && accessories.length > 0) {
    const { error: accError } = await supabase
      .from("av_product_accessories")
      .insert(
        accessories.map((a) => ({
          parent_product_id: inserted.id as string,
          child_product_id: a.child_product_id,
          qty: a.qty,
          is_required: a.is_required,
          ...(a.is_optional ? { is_optional: true } : {}),
        })),
      );
    if (accError) return { ok: false, error: accError.message };
  }

  revalidateCatalog();
  return { ok: true, id: inserted.id as string };
}

export async function duplicateServiceAction(
  serviceId: string,
): Promise<AvErpActionResult & { id?: string }> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!serviceId) return { ok: false, error: "Missing service." };

  const { data: source, error: loadError } = await supabase
    .from("av_services")
    .select("name, code, description, kind, unit_price")
    .eq("id", serviceId)
    .maybeSingle();
  if (loadError || !source) {
    return { ok: false, error: loadError?.message ?? "Service not found." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("av_services")
    .insert({
      name: `Copy of ${source.name}`,
      code: source.code ? `${source.code}-copy` : "",
      description: source.description,
      kind: source.kind,
      unit_price: source.unit_price,
      is_active: true,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return { ok: false, error: insertError?.message ?? "Could not duplicate." };
  }

  revalidateCatalog();
  return { ok: true, id: inserted.id as string };
}
