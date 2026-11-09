import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  sendSms,
  normalizePhone,
  isSmsConfigured,
  type SendResult,
} from "@/lib/sms/twilio";

type Supa = ReturnType<typeof createServiceClient>;

export type SmsMessage = {
  id: string;
  contactPhone: string;
  staffId: string | null;
  direction: "outbound" | "inbound";
  body: string;
  status: string | null;
  createdAt: string;
};

export type SmsConversation = {
  contactPhone: string;
  staffId: string | null;
  staffName: string | null;
  lastBody: string;
  lastAt: string;
  lastDirection: "outbound" | "inbound";
};

const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const START_WORDS = new Set(["START", "YES", "UNSTOP"]);

export { isSmsConfigured };

async function isOptedOut(supabase: Supa, phone: string): Promise<boolean> {
  const { data } = await supabase
    .from("sms_opt_outs")
    .select("phone")
    .eq("phone", phone)
    .maybeSingle();
  return Boolean(data);
}

/** Resolve a staff_id whose stored phone matches this E.164 number. */
async function staffIdForPhone(supabase: Supa, e164: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, phone")
    .not("phone", "is", null);
  for (const p of data ?? []) {
    if (normalizePhone(p.phone as string) === e164) return p.id as string;
  }
  return null;
}

async function recordMessage(
  supabase: Supa,
  row: {
    contactPhone: string;
    staffId: string | null;
    direction: "outbound" | "inbound";
    body: string;
    status: string | null;
    twilioSid: string | null;
    sentBy: string | null;
  },
): Promise<void> {
  await supabase.from("sms_messages").insert({
    contact_phone: row.contactPhone,
    staff_id: row.staffId,
    direction: row.direction,
    body: row.body,
    status: row.status,
    twilio_sid: row.twilioSid,
    sent_by: row.sentBy,
  });
}

/** Send to a raw phone number (or staff-resolved number) and record it. */
export async function sendToPhone(
  phone: string,
  body: string,
  sentBy: string,
  staffId?: string | null,
): Promise<SendResult> {
  const e164 = normalizePhone(phone);
  if (!e164) return { ok: false, error: "Invalid phone number." };
  const supabase = createServiceClient();

  if (await isOptedOut(supabase, e164)) {
    return { ok: false, error: "That number has opted out of texts (replied STOP)." };
  }

  const resolvedStaff = staffId ?? (await staffIdForPhone(supabase, e164));
  const result = await sendSms(e164, body);
  await recordMessage(supabase, {
    contactPhone: e164,
    staffId: resolvedStaff,
    direction: "outbound",
    body,
    status: result.ok ? result.status : "failed",
    twilioSid: result.ok ? result.sid : null,
    sentBy,
  });
  return result;
}

/** Send to a specific staff member by id (looks up their phone). */
export async function sendToStaff(
  staffId: string,
  body: string,
  sentBy: string,
): Promise<SendResult> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", staffId)
    .maybeSingle();
  const e164 = normalizePhone((data?.phone as string) ?? null);
  if (!e164) return { ok: false, error: "That staff member has no phone number on file." };
  return sendToPhone(e164, body, sentBy, staffId);
}

export type BulkOutcome = { total: number; sent: number; failed: number; skipped: number };

/** Send one message to many staff (optionally filtered to a department). */
export async function bulkSendToStaff(
  opts: { department?: string | null; staffIds?: string[]; body: string; sentBy: string },
): Promise<BulkOutcome> {
  const supabase = createServiceClient();
  let query = supabase
    .from("profiles")
    .select("id, phone, departments, is_active")
    .eq("is_active", true)
    .not("phone", "is", null);
  if (opts.staffIds && opts.staffIds.length) {
    query = query.in("id", opts.staffIds);
  }
  const { data } = await query;

  let recipients = data ?? [];
  if (opts.department) {
    recipients = recipients.filter((p) =>
      Array.isArray(p.departments) && (p.departments as string[]).includes(opts.department as string),
    );
  }

  const outcome: BulkOutcome = { total: recipients.length, sent: 0, failed: 0, skipped: 0 };
  for (const p of recipients) {
    const e164 = normalizePhone(p.phone as string);
    if (!e164) {
      outcome.skipped++;
      continue;
    }
    const r = await sendToPhone(e164, opts.body, opts.sentBy, p.id as string);
    if (r.ok) outcome.sent++;
    else outcome.failed++;
  }
  return outcome;
}

/** Record an inbound message from Twilio; handle STOP/START keywords. */
export async function recordInbound(
  fromPhone: string,
  body: string,
  twilioSid: string,
): Promise<void> {
  const e164 = normalizePhone(fromPhone);
  if (!e164) return;
  const supabase = createServiceClient();
  const word = body.trim().toUpperCase();

  if (STOP_WORDS.has(word)) {
    await supabase.from("sms_opt_outs").upsert({ phone: e164 }, { onConflict: "phone" });
  } else if (START_WORDS.has(word)) {
    await supabase.from("sms_opt_outs").delete().eq("phone", e164);
  }

  const staffId = await staffIdForPhone(supabase, e164);
  await recordMessage(supabase, {
    contactPhone: e164,
    staffId,
    direction: "inbound",
    body,
    status: "received",
    twilioSid,
    sentBy: null,
  });
}

/** All conversations (grouped by contact), most-recent first. */
export async function listConversations(): Promise<SmsConversation[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("sms_messages")
    .select("contact_phone, staff_id, direction, body, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  const byPhone = new Map<string, SmsConversation>();
  const staffIds = new Set<string>();
  for (const m of data ?? []) {
    const phone = m.contact_phone as string;
    if (!byPhone.has(phone)) {
      byPhone.set(phone, {
        contactPhone: phone,
        staffId: (m.staff_id as string) ?? null,
        staffName: null,
        lastBody: m.body as string,
        lastAt: m.created_at as string,
        lastDirection: m.direction as "outbound" | "inbound",
      });
    }
    if (m.staff_id) staffIds.add(m.staff_id as string);
  }

  if (staffIds.size) {
    const { data: staff } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(staffIds));
    const names = new Map((staff ?? []).map((s) => [s.id as string, s.full_name as string]));
    for (const conv of byPhone.values()) {
      if (conv.staffId) conv.staffName = names.get(conv.staffId) ?? null;
    }
  }

  return Array.from(byPhone.values());
}

/** Full message thread for one contact, oldest first. */
export async function getThread(phone: string): Promise<SmsMessage[]> {
  const e164 = normalizePhone(phone);
  if (!e164) return [];
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("sms_messages")
    .select("id, contact_phone, staff_id, direction, body, status, created_at")
    .eq("contact_phone", e164)
    .order("created_at", { ascending: true });
  return (data ?? []).map((m) => ({
    id: m.id as string,
    contactPhone: m.contact_phone as string,
    staffId: (m.staff_id as string) ?? null,
    direction: m.direction as "outbound" | "inbound",
    body: m.body as string,
    status: (m.status as string) ?? null,
    createdAt: m.created_at as string,
  }));
}

/** Update an outbound message's delivery status (from a Twilio status callback). */
export async function updateMessageStatus(
  twilioSid: string,
  status: string,
): Promise<void> {
  if (!twilioSid || !status) return;
  const supabase = createServiceClient();
  await supabase
    .from("sms_messages")
    .update({ status })
    .eq("twilio_sid", twilioSid);
}
