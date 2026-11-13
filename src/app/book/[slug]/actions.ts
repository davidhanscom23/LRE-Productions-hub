"use server";

import { createServiceClient } from "@/lib/supabase/admin";
import { isDateStr } from "@/lib/scheduling/slots";
import {
  CANCEL_TOKEN_RE,
  loadMeetingType,
  newCancelToken,
  openSlotsFor,
  sendBookingEmails,
  whenText,
} from "@/lib/scheduling/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function getSlotsAction(input: { slug: string; date: string }): Promise<{ slots: string[] }> {
  const type = await loadMeetingType(input.slug);
  if (!type || !isDateStr(input.date)) return { slots: [] };
  return { slots: await openSlotsFor(type, input.date) };
}

export async function createBookingAction(input: {
  slug: string;
  startIso: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  website?: string; // honeypot
}): Promise<{ error: string | null; when?: string; cancelToken?: string }> {
  if (input.website) return { error: null, when: "", cancelToken: "" }; // bots get a fake success
  const name = input.name.trim().slice(0, 120);
  const email = input.email.trim().toLowerCase().slice(0, 200);
  const phone = input.phone.trim().slice(0, 40);
  const notes = input.notes.trim().slice(0, 1000);
  if (!name) return { error: "Please add your name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };

  const type = await loadMeetingType(input.slug);
  if (!type) return { error: "This booking page isn't available." };

  const start = new Date(input.startIso);
  if (Number.isNaN(start.getTime())) return { error: "Pick a time first." };
  const startIso = start.toISOString();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: type.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(start);
  // The time must be one we would actually offer right now.
  const open = await openSlotsFor(type, date);
  if (!open.includes(startIso)) return { error: "That time was just taken. Please pick another." };

  const db = createServiceClient();
  // Light abuse guard: at most 3 live bookings per email per meeting type.
  const { count } = await db
    .from("meeting_bookings")
    .select("id", { count: "exact", head: true })
    .eq("meeting_type_id", type.id)
    .eq("email", email)
    .eq("status", "booked")
    .gte("start_at", new Date().toISOString());
  if ((count ?? 0) >= 3) return { error: "You already have upcoming bookings. Please cancel one first, or email us." };

  const endIso = new Date(start.getTime() + type.durationMin * 60_000).toISOString();
  const cancelToken = newCancelToken();

  // Attach to the client's latest Pipeline project when the email matches one.
  let projectId: string | null = null;
  const { data: client } = await db.from("pipeline_clients").select("id").ilike("email", email).limit(1).maybeSingle();
  if (client) {
    const { data: proj } = await db
      .from("pipeline_projects")
      .select("id")
      .eq("client_id", client.id)
      .is("merged_into", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    projectId = (proj?.id as string | undefined) ?? null;
  }

  const { data: row, error } = await db
    .from("meeting_bookings")
    .insert({
      meeting_type_id: type.id,
      host_id: type.hostId,
      start_at: startIso,
      end_at: endIso,
      name,
      email,
      phone,
      notes,
      cancel_token: cancelToken,
      pipeline_project_id: projectId,
    })
    .select("id")
    .single();
  if (error || !row) {
    return { error: error?.code === "23505" ? "That time was just taken. Please pick another." : "We couldn't save your booking. Please try again." };
  }

  const { data: host } = await db.from("profiles").select("full_name, email").eq("id", type.hostId).maybeSingle();
  await sendBookingEmails({
    type,
    hostName: (host?.full_name as string) ?? "",
    hostEmail: (host?.email as string | null) ?? null,
    booking: { id: row.id as string, startIso, endIso, name, email, phone, notes, cancelToken },
  });
  if (projectId) {
    await db.from("pipeline_project_notes").insert({
      project_id: projectId,
      source: "system",
      category: "note",
      body: `${name} booked "${type.title}" for ${whenText(startIso, type.timezone)}.`,
    });
  }
  return { error: null, when: whenText(startIso, type.timezone), cancelToken };
}

export async function cancelBookingAction(token: string): Promise<{ error: string | null }> {
  if (!CANCEL_TOKEN_RE.test(token)) return { error: "This link isn't valid." };
  const db = createServiceClient();
  const { data: b } = await db
    .from("meeting_bookings")
    .select("id, status, start_at, name, email, host_id, meeting_type_id, pipeline_project_id")
    .eq("cancel_token", token)
    .maybeSingle();
  if (!b) return { error: "This link isn't valid." };
  if (b.status === "cancelled") return { error: null };
  const { error } = await db
    .from("meeting_bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", b.id);
  if (error) return { error: "We couldn't cancel that. Please email us." };
  const { data: host } = await db.from("profiles").select("email").eq("id", b.host_id).maybeSingle();
  const { sendEmailDetailed } = await import("@/lib/email/send");
  if (host?.email) {
    await sendEmailDetailed({
      to: host.email as string,
      subject: `Booking cancelled: ${b.name}`,
      text: `${b.name} (${b.email}) cancelled their meeting on ${new Date(b.start_at as string).toUTCString()}.`,
    });
  }
  if (b.pipeline_project_id) {
    await db.from("pipeline_project_notes").insert({
      project_id: b.pipeline_project_id,
      source: "system",
      category: "note",
      body: `${b.name} cancelled their meeting booking.`,
    });
  }
  return { error: null };
}
