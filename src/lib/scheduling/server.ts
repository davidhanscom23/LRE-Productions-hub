import "server-only";

import { randomBytes } from "node:crypto";
import { buildIcs } from "@/lib/calendar/ics";
import { sendEmailDetailed } from "@/lib/email/send";
import { getPublicBaseUrl } from "@/lib/av-portals/emails";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { addDays, generateSlots, isDateStr, sanitizeWeekly, zonedToUtcMs, type Weekly } from "./slots";

export type PublicMeetingType = {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationMin: number;
  bufferMin: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  location: string;
  timezone: string;
  weekly: Weekly;
  hostId: string;
};

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}$/;
export const CANCEL_TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export async function loadMeetingType(slug: string): Promise<PublicMeetingType | null> {
  if (!SLUG_RE.test(slug) || !isServiceRoleConfigured()) return null;
  const { data } = await createServiceClient()
    .from("meeting_types")
    .select("id, slug, title, description, duration_min, buffer_min, min_notice_hours, max_days_ahead, location, timezone, weekly, host_id")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    slug: data.slug as string,
    title: data.title as string,
    description: (data.description as string) ?? "",
    durationMin: data.duration_min as number,
    bufferMin: data.buffer_min as number,
    minNoticeHours: data.min_notice_hours as number,
    maxDaysAhead: data.max_days_ahead as number,
    location: (data.location as string) ?? "",
    timezone: data.timezone as string,
    weekly: sanitizeWeekly(data.weekly),
    hostId: data.host_id as string,
  };
}

/** Open start times (UTC ISO) for one day, minus anything the host already has booked. */
export async function openSlotsFor(t: PublicMeetingType, date: string, nowMs = Date.now()): Promise<string[]> {
  if (!isDateStr(date)) return [];
  const from = new Date(zonedToUtcMs(addDays(date, -1), "00:00", t.timezone)).toISOString();
  const to = new Date(zonedToUtcMs(addDays(date, 2), "00:00", t.timezone)).toISOString();
  const { data } = await createServiceClient()
    .from("meeting_bookings")
    .select("start_at, end_at")
    .eq("host_id", t.hostId)
    .eq("status", "booked")
    .gte("end_at", from)
    .lte("start_at", to);
  const busy = (data ?? []).map((b) => ({ startMs: Date.parse(b.start_at as string), endMs: Date.parse(b.end_at as string) }));
  return generateSlots({
    date,
    weekly: t.weekly,
    tz: t.timezone,
    durationMin: t.durationMin,
    bufferMin: t.bufferMin,
    minNoticeHours: t.minNoticeHours,
    maxDaysAhead: t.maxDaysAhead,
    nowMs,
    busy,
  });
}

export const newCancelToken = () => randomBytes(18).toString("base64url");
export const cancelUrl = (token: string) => `${getPublicBaseUrl()}/book/cancel/${token}`;

export function whenText(startIso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(startIso));
}

export async function sendBookingEmails(opts: {
  type: PublicMeetingType;
  hostName: string;
  hostEmail: string | null;
  booking: { id: string; startIso: string; endIso: string; name: string; email: string; phone: string; notes: string; cancelToken: string };
}) {
  const { type, booking: b } = opts;
  const when = whenText(b.startIso, type.timezone);
  const ics = buildIcs(
    [{ uid: `${b.id}@lreproductions.com`, title: `${type.title} with LRE Productions`, start: b.startIso, end: b.endIso, allDay: false, location: type.location, description: type.description }],
    "LRE Productions meeting",
  );
  const clientText = `Hi ${b.name.split(/\s+/)[0] || "there"},\n\nYou are booked: ${type.title}\n${when}\n${type.location}\n\nNeed to change it? Cancel here and pick a new time: ${cancelUrl(b.cancelToken)}\n\nWe look forward to talking with you.\nLRE Productions`;
  await sendEmailDetailed({
    to: b.email,
    subject: `Confirmed: ${type.title}, ${when}`,
    text: clientText,
    replyTo: opts.hostEmail,
    attachments: [{ filename: "meeting.ics", content: Buffer.from(ics), contentType: "text/calendar" }],
  });
  if (opts.hostEmail) {
    await sendEmailDetailed({
      to: opts.hostEmail,
      subject: `New booking: ${b.name}, ${when}`,
      text: `${b.name} booked "${type.title}".\n${when}\nEmail: ${b.email}\nPhone: ${b.phone || "(none)"}\nNotes: ${b.notes || "(none)"}`,
      replyTo: b.email,
      attachments: [{ filename: "meeting.ics", content: Buffer.from(ics), contentType: "text/calendar" }],
    });
  }
}
