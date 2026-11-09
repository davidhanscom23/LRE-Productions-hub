import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  crewBillableDays,
  crewLaborCostAmount,
  crewLaborCostDescription,
  easternYmdFromIso,
  shouldSyncCrewLaborCost,
} from "@/lib/av-erp/crew-cost-rollup";
import type { AvBookingStatus } from "@/lib/av-erp/types";

type BookingRow = {
  id: string;
  opportunity_id: string;
  profile_id: string;
  role_label: string;
  starts_at: string;
  ends_at: string;
  day_rate: number | null;
  status: string;
  roll_into_costs: boolean;
};

/** Upsert or remove the labor cost row linked to a crew booking. */
export async function syncCrewBookingLaborCost(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: booking, error } = await supabase
    .from("av_contractor_bookings")
    .select(
      "id, opportunity_id, profile_id, role_label, starts_at, ends_at, day_rate, status, roll_into_costs",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!booking) return { ok: false, error: "Booking not found." };

  const row = booking as BookingRow;
  const want = shouldSyncCrewLaborCost({
    status: row.status as AvBookingStatus,
    dayRate: row.day_rate == null ? null : Number(row.day_rate),
    rollIntoCosts: Boolean(row.roll_into_costs),
  });

  if (!want) {
    const { error: delError } = await supabase
      .from("av_job_costs")
      .delete()
      .eq("booking_id", bookingId);
    if (delError) return { ok: false, error: delError.message };
    return { ok: true };
  }

  const dayRate = Number(row.day_rate);
  const amount = crewLaborCostAmount(dayRate, row.starts_at, row.ends_at);
  if (amount == null || amount <= 0) {
    const { error: delError } = await supabase
      .from("av_job_costs")
      .delete()
      .eq("booking_id", bookingId);
    if (delError) return { ok: false, error: delError.message };
    return { ok: true };
  }

  const { data: person } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", row.profile_id)
    .maybeSingle();
  const personName =
    (person?.full_name as string | null)?.trim() ||
    (person?.email as string | null)?.trim() ||
    "Crew";

  const days = crewBillableDays(row.starts_at, row.ends_at);
  const description = crewLaborCostDescription({
    personName,
    roleLabel: row.role_label || "",
    days,
    dayRate,
  });
  const costDate =
    easternYmdFromIso(row.starts_at) ??
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

  const { data: existing } = await supabase
    .from("av_job_costs")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (existing?.id) {
    const { error: updError } = await supabase
      .from("av_job_costs")
      .update({
        amount,
        category: "labor",
        description,
        cost_date: costDate,
        opportunity_id: row.opportunity_id,
      })
      .eq("id", existing.id as string);
    if (updError) return { ok: false, error: updError.message };
    return { ok: true };
  }

  const { error: insError } = await supabase.from("av_job_costs").insert({
    opportunity_id: row.opportunity_id,
    booking_id: bookingId,
    amount,
    category: "labor",
    description,
    cost_date: costDate,
  });
  if (insError) return { ok: false, error: insError.message };
  return { ok: true };
}
