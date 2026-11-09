"use server";

import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export type AvErpActionResult = { ok: true } | { ok: false; error: string };

function parseSkills(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function parseRate(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function createContractorAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const name = str(formData, "name");
  if (!name) return { ok: false, error: "Name is required." };

  const { error: insertError } = await supabase.from("av_contractors").insert({
    name,
    contact_name: str(formData, "contact_name"),
    email: str(formData, "email").toLowerCase(),
    phone: str(formData, "phone"),
    skills: parseSkills(str(formData, "skills")),
    day_rate: parseRate(str(formData, "day_rate")),
    hour_rate: parseRate(str(formData, "hour_rate")),
    notes: str(formData, "notes"),
    is_active: str(formData, "is_active") !== "off",
    created_by: profile.id,
  });
  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath("/rentals/contractors");
  revalidatePath("/rentals/crew");
  return { ok: true };
}

export async function updateContractorAction(
  formData: FormData,
): Promise<AvErpActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return { ok: false, error: "Name is required." };

  const { error: updateError } = await supabase
    .from("av_contractors")
    .update({
      name,
      contact_name: str(formData, "contact_name"),
      email: str(formData, "email").toLowerCase(),
      phone: str(formData, "phone"),
      skills: parseSkills(str(formData, "skills")),
      day_rate: parseRate(str(formData, "day_rate")),
      hour_rate: parseRate(str(formData, "hour_rate")),
      notes: str(formData, "notes"),
      is_active: str(formData, "is_active") === "on",
    })
    .eq("id", id);
  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/rentals/contractors");
  revalidatePath("/rentals/crew");
  return { ok: true };
}
