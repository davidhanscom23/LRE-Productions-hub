import "server-only";
import crypto from "node:crypto";

/**
 * Minimal Twilio SMS client (no SDK dependency).
 * Env:
 *   TWILIO_ACCOUNT_SID   — starts with "AC…"
 *   TWILIO_AUTH_TOKEN    — the account auth token
 *   TWILIO_FROM_NUMBER   — your Twilio number in E.164, e.g. +19045551234
 */

const SID = () => process.env.TWILIO_ACCOUNT_SID ?? "";
const TOKEN = () => process.env.TWILIO_AUTH_TOKEN ?? "";
const FROM = () => process.env.TWILIO_FROM_NUMBER ?? "";

export function isSmsConfigured(): boolean {
  return Boolean(SID() && TOKEN() && FROM());
}

/** Best-effort E.164 normalization (US default). Returns null if unusable. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Pretty US display, e.g. "+19045551234" -> "(904) 555-1234". */
export function formatPhone(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export type SendResult =
  | { ok: true; sid: string; status: string }
  | { ok: false; error: string };

/** Send one SMS via Twilio's REST API. */
export async function sendSms(to: string, body: string): Promise<SendResult> {
  if (!isSmsConfigured()) return { ok: false, error: "Twilio is not configured." };
  const toE164 = normalizePhone(to);
  if (!toE164) return { ok: false, error: "Invalid phone number." };
  if (!body.trim()) return { ok: false, error: "Message is empty." };

  const url = `https://api.twilio.com/2010-04-01/Accounts/${SID()}/Messages.json`;
  const auth = Buffer.from(`${SID()}:${TOKEN()}`).toString("base64");
  const form = new URLSearchParams({ To: toE164, From: FROM(), Body: body });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = (await res.json()) as {
      sid?: string;
      status?: string;
      message?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.message || `Twilio error ${res.status}` };
    }
    return { ok: true, sid: data.sid ?? "", status: data.status ?? "queued" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed." };
  }
}

/**
 * Validate an inbound Twilio webhook signature (X-Twilio-Signature).
 * Twilio signs the full URL + the POST params (sorted by key, concatenated).
 * See https://www.twilio.com/docs/usage/security#validating-requests
 */
export function validateTwilioSignature(
  fullUrl: string,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  if (!signature || !TOKEN()) return false;
  const data =
    fullUrl +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  const expected = crypto
    .createHmac("sha1", TOKEN())
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
