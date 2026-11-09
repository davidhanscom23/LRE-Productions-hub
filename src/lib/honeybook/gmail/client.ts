import "server-only";

import { google, type gmail_v1 } from "googleapis";

/**
 * Gmail access for the HoneyBook inbox sync.
 *
 * Uses the same Google service account as Drive/Sheets (GOOGLE_SERVICE_ACCOUNT_EMAIL +
 * GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) with domain-wide delegation: a Workspace super admin
 * authorizes the service account's client ID for the READ-ONLY Gmail scope, and the Hub then
 * reads each staff mailbox by impersonating that address. Nothing is ever sent or changed in
 * Gmail.
 *
 * Off by default: set HONEYBOOK_GMAIL_ENABLED=true in Vercel once staff know about it.
 */
export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function isGmailSyncEnabled(): boolean {
  return process.env.HONEYBOOK_GMAIL_ENABLED?.trim().toLowerCase() === "true";
}

export function isGmailServiceAccountConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim(),
  );
}

/** Gmail client acting as one staff mailbox. */
export function getGmailForMailbox(mailbox: string): gmail_v1.Gmail {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? "";
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "")
    .replace(/\\n/g, "\n")
    .trim();
  if (!clientEmail || !privateKey) {
    throw new Error(
      "Google service account is not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY).",
    );
  }
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [GMAIL_READONLY_SCOPE],
    subject: mailbox,
  });
  return google.gmail({ version: "v1", auth });
}
