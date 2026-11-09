"use server";

import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";
import { datetimeLocalEasternToIso } from "@/lib/av-erp/datetime";
import {
  AV_BOOKING_STATUSES,
  type AvBookingStatus,
} from "@/lib/av-erp/margin";
import { syncCrewBookingLaborCost } from "@/lib/av-erp/sync-crew-labor-cost";

export type BookingActionResult = { ok: true } | { ok: false; error: string };

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string) {
  const raw = str(formData, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function revalidateCrew(opportunityId?: string) {
  revalidatePath("/rentals/crew");
  revalidatePath("/rentals/costs");
  revalidatePath("/rentals");
  if (opportunityId) revalidatePath(`/rentals/quotes/${opportunityId}`);
}

export async function createBookingAction(
  formData: FormData,
): Promise<BookingActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const opportunityId = str(formData, "opportunity_id");
  const profileId = str(formData, "profile_id");
  const contractorId = str(formData, "contractor_id");
  if (!opportunityId) return { ok: false, error: "Pick an estimate." };
  if (Boolean(profileId) === Boolean(contractorId)) {
    return {
      ok: false,
      error: "Pick either a Hub person or an external contractor.",
    };
  }

  const startsAt = datetimeLocalEasternToIso(str(formData, "starts_at"));
  const endsAt = datetimeLocalEasternToIso(str(formData, "ends_at"));
  if (!startsAt || !endsAt) {
    return { ok: false, error: "Set start and end (Eastern)." };
  }
  if (new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
    return { ok: false, error: "End must be after start." };
  }

  const statusRaw = str(formData, "status") || "confirmed";
  const status = (AV_BOOKING_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as AvBookingStatus)
    : "confirmed";

  const dayRate = num(formData, "day_rate");
  const rollIntoCosts = formData.get("roll_into_costs") != null;

  const { data: inserted, error: insertError } = await supabase
    .from("av_contractor_bookings")
    .insert({
      opportunity_id: opportunityId,
      profile_id: profileId || null,
      contractor_id: contractorId || null,
      role_label: str(formData, "role_label"),
      starts_at: startsAt,
      ends_at: endsAt,
      day_rate: dayRate != null && dayRate >= 0 ? dayRate : null,
      status,
      notes: str(formData, "notes"),
      roll_into_costs: rollIntoCosts,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return { ok: false, error: insertError?.message ?? "Could not book crew." };
  }

  const sync = await syncCrewBookingLaborCost(supabase, inserted.id as string);
  if (!sync.ok) return sync;

  revalidateCrew(opportunityId);
  return { ok: true };
}

export async function updateBookingStatusAction(
  formData: FormData,
): Promise<BookingActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  const opportunityId = str(formData, "opportunity_id");
  const statusRaw = str(formData, "status");
  if (!id) return { ok: false, error: "Missing booking." };
  if (!(AV_BOOKING_STATUSES as readonly string[]).includes(statusRaw)) {
    return { ok: false, error: "Invalid status." };
  }

  const { error: updateError } = await supabase
    .from("av_contractor_bookings")
    .update({ status: statusRaw })
    .eq("id", id);
  if (updateError) return { ok: false, error: updateError.message };

  const sync = await syncCrewBookingLaborCost(supabase, id);
  if (!sync.ok) return sync;

  revalidateCrew(opportunityId || undefined);
  return { ok: true };
}

export async function deleteBookingAction(
  formData: FormData,
): Promise<BookingActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  const opportunityId = str(formData, "opportunity_id");
  if (!id) return { ok: false, error: "Missing booking." };

  // Linked labor cost rows cascade via booking_id FK.
  const { error: delError } = await supabase
    .from("av_contractor_bookings")
    .delete()
    .eq("id", id);
  if (delError) return { ok: false, error: delError.message };

  revalidateCrew(opportunityId || undefined);
  return { ok: true };
}
