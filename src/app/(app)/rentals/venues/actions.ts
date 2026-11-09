"use server";

import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export type AvErpActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function createJobVenueAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const name = str(formData, "name");
  if (!name) return { ok: false, error: "Name is required." };

  const { data, error: insertError } = await supabase
    .from("av_job_venues")
    .insert({
      name,
      contact_name: str(formData, "contact_name"),
      email: str(formData, "email").toLowerCase(),
      phone: str(formData, "phone"),
      address_line1: str(formData, "address_line1"),
      city: str(formData, "city"),
      region: str(formData, "region"),
      postal_code: str(formData, "postal_code"),
      access_notes: str(formData, "access_notes"),
      power_notes: str(formData, "power_notes"),
      parking_notes: str(formData, "parking_notes"),
      notes: str(formData, "notes"),
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath("/rentals/venues");
  revalidatePath("/rentals/quotes");
  return { ok: true, id: data.id };
}

export async function updateJobVenueAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return { ok: false, error: "Name is required." };

  const { error: updateError } = await supabase
    .from("av_job_venues")
    .update({
      name,
      contact_name: str(formData, "contact_name"),
      email: str(formData, "email").toLowerCase(),
      phone: str(formData, "phone"),
      address_line1: str(formData, "address_line1"),
      city: str(formData, "city"),
      region: str(formData, "region"),
      postal_code: str(formData, "postal_code"),
      access_notes: str(formData, "access_notes"),
      power_notes: str(formData, "power_notes"),
      parking_notes: str(formData, "parking_notes"),
      notes: str(formData, "notes"),
      is_retired: str(formData, "is_retired") === "on",
    })
    .eq("id", id);
  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/rentals/venues");
  return { ok: true };
}
