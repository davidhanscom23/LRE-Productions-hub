import { SchedulingClient, type BookingRow, type TypeRow } from "@/components/scheduling/scheduling-client";
import { getPublicBaseUrl } from "@/lib/av-portals/emails";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canAccessHoneyBook, canManageHoneyBookCrm } from "@/lib/honeybook/access";
import { sanitizeWeekly } from "@/lib/scheduling/slots";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SchedulingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessHoneyBook(profile.role)) redirect("/");
  const supabase = await createClient();
  const { data: types, error } = await supabase
    .from("meeting_types")
    .select("id, slug, title, description, duration_min, buffer_min, min_notice_hours, max_days_ahead, location, timezone, weekly, active")
    .order("created_at");
  const { data: bookings } = await supabase
    .from("meeting_bookings")
    .select("id, start_at, name, email, phone, notes, honeybook_project_id, meeting_types:meeting_type_id ( title, timezone )")
    .eq("status", "booked")
    .gte("start_at", new Date().toISOString())
    .order("start_at")
    .limit(200);

  const typeRows = (types ?? []).map((t) => ({ ...t, weekly: sanitizeWeekly(t.weekly) })) as TypeRow[];
  const bookingRows: BookingRow[] = (bookings ?? []).map((b) => {
    const mt = (Array.isArray(b.meeting_types) ? b.meeting_types[0] : b.meeting_types) as { title?: string; timezone?: string } | null;
    return {
      id: b.id as string,
      start_at: b.start_at as string,
      name: b.name as string,
      email: b.email as string,
      phone: (b.phone as string) ?? "",
      notes: (b.notes as string) ?? "",
      type_title: mt?.title ?? "",
      timezone: mt?.timezone ?? "America/New_York",
      project_id: (b.honeybook_project_id as string | null) ?? null,
    };
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Scheduling</h1>
        <p className="text-sm text-[var(--muted)]">
          Give clients a link to book a call with you. Pick your hours, and they choose an open time. Everyone gets an email with a calendar invite.
        </p>
      </div>
      {error ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Scheduling needs migration 181_meeting_scheduler.sql. {error.message}
        </p>
      ) : canManageHoneyBookCrm(profile.role) ? (
        <SchedulingClient types={typeRows} bookings={bookingRows} baseUrl={getPublicBaseUrl()} />
      ) : (
        <p className="text-sm text-[var(--muted)]">Admins and Leads manage booking pages. Ask one of them for the booking link.</p>
      )}
    </div>
  );
}
