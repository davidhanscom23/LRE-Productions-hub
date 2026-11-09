"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { sendEmail } from "@/lib/email/send";
import { insertNotifications } from "@/lib/notifications/notify";
import { createClient } from "@/lib/supabase/server";
import type { TimeOffType } from "@/lib/types/time-off";
import {
  TIME_OFF_TYPES,
  WEEKDAYS,
  timeOffTypeLabel,
} from "@/lib/types/time-off";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

const VALID_TYPES = new Set(TIME_OFF_TYPES.map((t) => t.value));
const VALID_DAYS = new Set(WEEKDAYS.map((d) => d.key));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function submitTimeOffAction(input: {
  startDate: string;
  endDate: string;
  type: string;
  note: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in to request time off." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const startDate = input.startDate?.trim();
  const endDate = input.endDate?.trim();
  if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
    return { error: "Pick a valid start and end date." };
  }
  if (endDate < startDate) {
    return { error: "End date can’t be before the start date." };
  }
  const type = (VALID_TYPES.has(input.type as TimeOffType)
    ? input.type
    : "unavailable") as TimeOffType;
  const note = (input.note ?? "").trim().slice(0, 500);

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("time_off_requests")
    .insert({
      user_id: profile.id,
      start_date: startDate,
      end_date: endDate,
      type,
      note,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Best-effort: notify admins in-app (SECURITY DEFINER fn) + email. The
  // request already succeeded, so never surface a failure here.
  try {
    await supabase.rpc("notify_admins_of_time_off", {
      p_request_id: inserted.id,
    });
    const { data: admins } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "admin");
    const emails = (admins ?? [])
      .map((a) => a.email as string)
      .filter(Boolean);
    const range =
      startDate === endDate ? startDate : `${startDate} to ${endDate}`;
    await sendEmail({
      to: emails,
      subject: `New time-off request — ${profile.full_name}`,
      text:
        `${profile.full_name} requested ${timeOffTypeLabel(type)} (${range}).` +
        (note ? `\n\nNote: ${note}` : "") +
        `\n\nReview it in the hub under Time Off.`,
    });
  } catch {
    // ignore — in-app/email notification is non-critical
  }

  revalidatePath("/time-off");
  return { error: null };
}

export async function cancelTimeOffAction(id: string): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  const requestId = id?.trim();
  if (!requestId) return { error: "Missing request." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("time_off_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("user_id", profile.id)
    .eq("status", "pending");
  if (error) return { error: error.message };

  revalidatePath("/time-off");
  return { error: null };
}

export async function reviewTimeOffAction(input: {
  id: string;
  decision: "approved" | "denied";
  reviewNote?: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role !== "admin") {
    return { error: "Only admins can approve or deny requests." };
  }
  const requestId = input.id?.trim();
  if (!requestId) return { error: "Missing request." };
  if (input.decision !== "approved" && input.decision !== "denied") {
    return { error: "Invalid decision." };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("time_off_requests")
    .update({
      status: input.decision,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      review_note: (input.reviewNote ?? "").trim().slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select("user_id, start_date, end_date, type")
    .single();
  if (error) return { error: error.message };

  // Notify the staffer of the outcome (admins can insert notifications).
  try {
    const word = input.decision === "approved" ? "approved" : "declined";
    const range =
      updated.start_date === updated.end_date
        ? updated.start_date
        : `${updated.start_date} – ${updated.end_date}`;
    await insertNotifications(supabase, [
      {
        userId: updated.user_id as string,
        kind: "time_off",
        title: `Time off ${word}`,
        body: `Your ${timeOffTypeLabel(updated.type as TimeOffType)} request (${range}) was ${word}.`,
        href: "/time-off",
      },
    ]);
    const { data: subject } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", updated.user_id)
      .maybeSingle();
    if (subject?.email) {
      await sendEmail({
        to: subject.email as string,
        subject: `Your time-off request was ${word}`,
        text:
          `Your ${timeOffTypeLabel(updated.type as TimeOffType)} request (${range}) was ${word}.` +
          ((input.reviewNote ?? "").trim()
            ? `\n\nNote from admin: ${input.reviewNote!.trim()}`
            : ""),
      });
    }
  } catch {
    // ignore — notification is non-critical
  }

  revalidatePath("/time-off");
  return { error: null };
}

export async function saveAvailabilityAction(input: {
  days: string[];
  note: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const days = Array.from(
    new Set((input.days ?? []).filter((d) => VALID_DAYS.has(d))),
  );
  const note = (input.note ?? "").trim().slice(0, 300);

  const supabase = await createClient();
  const { error } = await supabase.from("staff_availability").upsert(
    {
      user_id: profile.id,
      available_days: days,
      note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: error.message };

  revalidatePath("/time-off");
  revalidatePath("/calendar");
  return { error: null };
}
