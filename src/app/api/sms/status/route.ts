import { updateMessageStatus } from "@/lib/sms/store";
import { validateTwilioSignature } from "@/lib/sms/twilio";

/**
 * Twilio message status callback. No Supabase session (bypassed in middleware);
 * authenticity is the X-Twilio-Signature. Twilio POSTs delivery updates
 * (queued → sent → delivered / failed / undelivered) for outbound messages.
 * Put this URL in your number's / Messaging Service's "status callback" field:
 *   https://hub.videntproductions.com/api/sms/status
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    params[k] = typeof v === "string" ? v : "";
  }

  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!token) {
    return new Response("Twilio is not configured.", { status: 503 });
  }

  const host = req.headers.get("host") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const url = `${proto}://${host}/api/sms/status`;
  const signature = req.headers.get("x-twilio-signature");

  if (!validateTwilioSignature(url, params, signature)) {
    return new Response("Invalid signature", { status: 403 });
  }

  const sid = params.MessageSid || params.SmsSid || "";
  const status = params.MessageStatus || params.SmsStatus || "";
  if (sid && status) {
    await updateMessageStatus(sid, status);
  }
  return new Response(null, { status: 204 });
}
