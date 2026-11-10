import "server-only";

/**
 * Best-effort transactional email via the Resend HTTP API.
 *
 * Email is OPTIONAL: if RESEND_API_KEY and EMAIL_FROM aren't set in the
 * environment, sends are skipped (skipped: true) so the app works without it.
 * To turn email on, add both env vars in Vercel (and .env.local for local dev):
 *   RESEND_API_KEY = your Resend API key
 *   EMAIL_FROM     = "LRE Productions <hello@lreproductions.com>"
 * Failures never throw — in-app notifications are the source of truth.
 * Callers that care about delivery should use sendEmailDetailed.
 */
type SendEmailAttachment = {
  filename: string;
  /** Raw bytes or base64 string (Resend accepts either via content). */
  content: Buffer | Uint8Array | string;
  contentType?: string;
};

type SendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  /** Optional HTML body; `text` is still sent as the plain-text alternative. */
  html?: string;
  /**
   * Optional Reply-To (Resend `reply_to`): where a reply goes instead of EMAIL_FROM. Blank or
   * missing = no Reply-To header, exactly as before.
   */
  replyTo?: string | string[] | null;
  attachments?: SendEmailAttachment[];
};

/** Trimmed, non-empty Reply-To addresses (empty when none were given). */
export function replyToList(replyTo: string | string[] | null | undefined): string[] {
  const list = Array.isArray(replyTo) ? replyTo : replyTo ? [replyTo] : [];
  return list
    .map((address) => (typeof address === "string" ? address.trim() : ""))
    .filter((address) => address.length > 0);
}

export type SendEmailResult = {
  ok: boolean;
  /** True when RESEND_API_KEY / EMAIL_FROM are missing, or no recipients. */
  skipped?: boolean;
  error?: string;
};

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim(),
  );
}

export async function sendEmailDetailed(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return {
      ok: false,
      skipped: true,
      error: "RESEND_API_KEY or EMAIL_FROM is not configured.",
    };
  }

  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((address) => address?.trim())
    .filter((address): address is string => Boolean(address));
  if (recipients.length === 0) {
    return { ok: false, skipped: true, error: "No recipients." };
  }
  const replyTo = replyToList(input.replyTo);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
        ...(replyTo.length ? { reply_to: replyTo.length === 1 ? replyTo[0] : replyTo } : {}),
        ...(input.attachments?.length
          ? {
              attachments: input.attachments.map((a) => ({
                filename: a.filename,
                content:
                  typeof a.content === "string"
                    ? a.content
                    : Buffer.from(a.content).toString("base64"),
                ...(a.contentType ? { contentType: a.contentType } : {}),
              })),
            }
          : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const error = `Resend ${res.status}: ${body.slice(0, 400) || res.statusText}`;
      console.error("[email]", error, { subject: input.subject, to: recipients });
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    const error =
      err instanceof Error ? err.message : "Resend request failed.";
    console.error("[email]", error, { subject: input.subject, to: recipients });
    return { ok: false, error };
  }
}

/** Convenience wrapper — true only when Resend accepted the message. */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const result = await sendEmailDetailed(input);
  return result.ok;
}
