import type { gmail_v1 } from "googleapis";

import {
  buildMessageKey,
  parseAddresses,
  stripQuotedReply,
  type HeaderMap,
} from "@/lib/honeybook/gmail/rules";

export type ParsedMessage = {
  gmailId: string;
  threadId: string;
  messageKey: string;
  mailbox: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  internalMs: number;
  direction: "inbound" | "outbound";
  /** Reply text only (quoted history removed), clipped for the AI step. */
  body: string;
  headers: HeaderMap;
};

const MAX_BODY_CHARS = 6000;

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

function collectParts(
  part: gmail_v1.Schema$MessagePart | undefined,
  plain: string[],
  html: string[],
): void {
  if (!part) return;
  const mime = (part.mimeType ?? "").toLowerCase();
  const data = part.body?.data;
  if (data && mime === "text/plain") plain.push(decodeBase64Url(data));
  else if (data && mime === "text/html") html.push(decodeBase64Url(data));
  for (const child of part.parts ?? []) collectParts(child, plain, html);
}

export function extractBodyText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  const plain: string[] = [];
  const html: string[] = [];
  collectParts(payload, plain, html);
  const raw = plain.length > 0 ? plain.join("\n") : htmlToText(html.join("\n"));
  return stripQuotedReply(raw).slice(0, MAX_BODY_CHARS);
}

function headerMap(payload: gmail_v1.Schema$MessagePart | undefined): HeaderMap {
  const map: HeaderMap = {};
  for (const h of payload?.headers ?? []) {
    if (h.name && h.value != null) map[h.name.toLowerCase()] = h.value;
  }
  return map;
}

/** Turn a Gmail API message (format=full) into the small shape the sync works with. */
export function parseGmailMessage(
  msg: gmail_v1.Schema$Message,
  mailbox: string,
): ParsedMessage | null {
  if (!msg.id || !msg.threadId) return null;
  const headers = headerMap(msg.payload ?? undefined);
  const fromList = parseAddresses(headers["from"]);
  const from = fromList[0] ?? "";
  if (!from) return null;

  const labels = msg.labelIds ?? [];
  const mailboxLower = mailbox.toLowerCase();
  const direction: "inbound" | "outbound" =
    labels.includes("SENT") || from === mailboxLower ? "outbound" : "inbound";

  const internalMs = Number(msg.internalDate ?? 0) || Date.now();

  return {
    gmailId: msg.id,
    threadId: msg.threadId,
    messageKey: buildMessageKey(headers["message-id"], mailboxLower, msg.id),
    mailbox: mailboxLower,
    from,
    to: parseAddresses(headers["to"]),
    cc: parseAddresses(headers["cc"]),
    subject: (headers["subject"] ?? "").trim().slice(0, 300),
    internalMs,
    direction,
    body: extractBodyText(msg.payload ?? undefined),
    headers,
  };
}
