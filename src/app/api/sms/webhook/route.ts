import { recordInbound } from "@/lib/sms/store";
import { validateTwilioSignature } from "@/lib/sms/twilio";

/**
 * Twilio inbound-SMS webhook. No Supabase session (bypassed in middleware);
 * authenticity is the X-Twilio-Signature, validated against the auth token.
 * Point your Twilio number's "A message comes in" webhook here (HTTP POST):
 *   https://hub.videntproductions.com/api/sms/webhook
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
  const url = `${proto}://${host}/api/sms/webhook`;
  const signature = req.headers.get("x-twilio-signature");

  if (!validateTwilioSignature(url, params, signature)) {
    return new Response("Invalid signature", { status: 403 });
  }

  const from = params.From || "";
  const body = params.Body || "";
  const sid = params.MessageSid || params.SmsSid || "";
  if (from) {
    await recordInbound(from, body, sid);
  }

  // Empty TwiML: accept the message without auto-replying.
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { "content-type": "text/xml" } },
  );
}
