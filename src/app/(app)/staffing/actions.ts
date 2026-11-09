"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { sendEmail } from "@/lib/email/send";
import { insertNotifications } from "@/lib/notifications/notify";
import { canAccessStaffing } from "@/lib/staffing/access";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function revalidateStaffingPaths() {
  revalidatePath("/staffing");
  revalidatePath("/time-off");
  revalidatePath("/calendar");
}

/**
 * Admin or Lead: mark a staffer unavailable for one day (approved Hub time off).
 * Supersedes Staffing’s default-available rule for that date.
 */
export async function markStaffUnavailableAction(input: {
  userId: string;
  dateKey: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (!canAccessStaffing(profile.role)) {
    return { error: "Only admins and Leads can mark staff unavailable." };
  }

  const userId = input.userId?.trim();
  const dateKey = input.dateKey?.trim();
  if (!userId) return { error: "Missing staff member." };
  if (!ISO_DATE.test(dateKey)) return { error: "Pick a valid date." };

  const supabase = await createClient();

  const { data: subject, error: subjectError } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active, role")
    .eq("id", userId)
    .maybeSingle();
  if (subjectError) return { error: subjectError.message };
  if (!subject) return { error: "Staff member not found." };
  if (!subject.is_active) return { error: "That staff member is inactive." };
  if (subject.role === "guest") {
    return { error: "Guests aren’t on the staffing board." };
  }

  // Already covered by approved Hub time off for this day — nothing to do.
  const { data: existing, error: existingError } = await supabase
    .from("time_off_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "approved")
    .lte("start_date", dateKey)
    .gte("end_date", dateKey)
    .limit(1);
  if (existingError) return { error: existingError.message };
  if ((existing ?? []).length > 0) {
    revalidateStaffingPaths();
    return { error: null };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("time_off_requests").insert({
    user_id: userId,
    start_date: dateKey,
    end_date: dateKey,
    type: "unavailable",
    note: "Marked unavailable from Staffing",
    status: "approved",
    reviewed_by: profile.id,
    reviewed_at: now,
    review_note: "Marked unavailable from Staffing",
    updated_at: now,
  });
  if (error) {
    if (/row-level security|policy/i.test(error.message)) {
      return {
        error:
          "Couldn’t save — run migration 069_admin_mark_time_off.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }

  try {
    await insertNotifications(supabase, [
      {
        userId,
        kind: "time_off",
        title: "Marked unavailable",
        body: `You were marked unavailable on ${dateKey} (Staffing).`,
        href: "/time-off",
      },
    ]);
    if (subject.email) {
      await sendEmail({
        to: subject.email as string,
        subject: "You were marked unavailable",
        text: `You were marked unavailable on ${dateKey} in the Hub Staffing board.\n\nSee Time Off in the hub for details.`,
      });
    }
  } catch {
    // Notification is non-critical.
  }

  revalidateStaffingPaths();
  return { error: null };
}

/**
 * Admin or Lead: clear a single-day Hub unavailable mark created for Staffing.
 * Does not remove calendar-feed Scheduled Day Off rows (edit those in the source calendar).
 */
export async function clearStaffUnavailableAction(input: {
  requestId: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (!canAccessStaffing(profile.role)) {
    return { error: "Only admins and Leads can clear Hub unavailable marks." };
  }

  const requestId = input.requestId?.trim();
  if (!requestId) return { error: "Missing time-off row." };

  const supabase = await createClient();
  const { data: row, error: loadError } = await supabase
    .from("time_off_requests")
    .select("id, user_id, start_date, end_date, status, type")
    .eq("id", requestId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!row) return { error: "Time-off row not found." };
  if (row.status !== "approved") {
    return { error: "That time-off row isn’t approved." };
  }
  if (row.start_date !== row.end_date) {
    return {
      error:
        "That Hub time off spans multiple days — clear or edit it on Time Off.",
    };
  }

  const { error } = await supabase
    .from("time_off_requests")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
      review_note: "Cleared from Staffing",
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "approved");
  if (error) return { error: error.message };

  try {
    await insertNotifications(supabase, [
      {
        userId: row.user_id as string,
        kind: "time_off",
        title: "Unavailable cleared",
        body: `Your Hub unavailable mark for ${row.start_date} was cleared.`,
        href: "/time-off",
      },
    ]);
  } catch {
    // ignore
  }

  revalidateStaffingPaths();
  return { error: null };
}
