"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { canManagePipelineCrm } from "@/lib/pipeline/access";
import { DAYS, parseWindowsText, type Weekly } from "@/lib/scheduling/slots";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type TypeInput = {
  id?: string;
  slug: string;
  title: string;
  description: string;
  durationMin: number;
  bufferMin: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  location: string;
  timezone: string;
  hoursText: Record<string, string>;
  active: boolean;
};

const int = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi;

export async function saveMeetingTypeAction(i: TypeInput): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile || !canManagePipelineCrm(profile.role)) return { error: "Only admins and Leads can edit scheduling." };
  const slug = i.slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(slug)) return { error: "The link name needs 2 to 49 letters, numbers or dashes." };
  if (!i.title.trim()) return { error: "Add a title." };
  if (!int(i.durationMin, 5, 480)) return { error: "Length must be 5 to 480 minutes." };
  if (!int(i.bufferMin, 0, 120)) return { error: "Buffer must be 0 to 120 minutes." };
  if (!int(i.minNoticeHours, 0, 720)) return { error: "Notice must be 0 to 720 hours." };
  if (!int(i.maxDaysAhead, 1, 365)) return { error: "Booking window must be 1 to 365 days." };
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: i.timezone });
  } catch {
    return { error: "That time zone isn't recognized (try America/New_York)." };
  }
  const weekly: Weekly = {};
  for (const d of DAYS) {
    const w = parseWindowsText(i.hoursText[d] ?? "");
    if (w === null) return { error: `Check the hours for ${d.toUpperCase()}. Use a format like 09:00-12:00, 13:00-17:00.` };
    if (w.length) weekly[d] = w;
  }
  const row = {
    slug,
    title: i.title.trim().slice(0, 120),
    description: i.description.trim().slice(0, 1000),
    duration_min: i.durationMin,
    buffer_min: i.bufferMin,
    min_notice_hours: i.minNoticeHours,
    max_days_ahead: i.maxDaysAhead,
    location: i.location.trim().slice(0, 300),
    timezone: i.timezone,
    weekly,
    active: i.active,
    updated_at: new Date().toISOString(),
  };
  const supabase = await createClient();
  const { error } = i.id
    ? await supabase.from("meeting_types").update(row).eq("id", i.id)
    : await supabase.from("meeting_types").insert({ ...row, host_id: profile.id, created_by: profile.id });
  if (error) return { error: error.code === "23505" ? "That link name is already used." : error.message };
  revalidatePath("/scheduling");
  return { error: null };
}

export async function cancelBookingAdminAction(id: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile || !canManagePipelineCrm(profile.role)) return { error: "Only admins and Leads can cancel bookings." };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Booking not found." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("meeting_bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/scheduling");
  return { error: null };
}
