/**
 * Email templates + merge fields for "Email client" on a HoneyBook project card.
 * Pure (no server imports) so the composer UI, the server action and the
 * automations can all share it.
 */

export type EmailMergeContext = {
  firstName: string;
  projectName: string;
  eventDate: string; // already formatted, or ""
  location: string;
  senderName: string;
  projectLink: string; // client share link, or ""
};

export type ProjectEmailTemplate = {
  id: string;
  label: string;
  subject: string;
  body: string;
};

export const PROJECT_EMAIL_TEMPLATES: ProjectEmailTemplate[] = [
  {
    id: "blank",
    label: "Blank message",
    subject: "{{project_name}}",
    body: "Hi {{first_name}},\n\n\n\nThank you,\n{{sender_name}}\nLRE Productions",
  },
  {
    id: "inquiry_reply",
    label: "Reply to a new inquiry",
    subject: "Thank you for reaching out about {{project_name}}",
    body:
      "Hi {{first_name}},\n\nThank you so much for thinking of LRE Productions for {{project_name}}. We would love to help make it an unforgettable event.\n\nTo put together the best proposal for you, could you share a little more about what you have in mind (guest count, schedule, and any must-have moments)? If it is easier to talk it through, reply with a few times that work for a quick call.\n\nWarmly,\n{{sender_name}}\nLRE Productions",
  },
  {
    id: "proposal_followup",
    label: "Follow up on a proposal",
    subject: "Following up on your proposal for {{project_name}}",
    body:
      "Hi {{first_name}},\n\nI wanted to check in on the proposal we sent for {{project_name}}. Do you have any questions, or anything you would like us to adjust? We are happy to tailor it so it is perfect for you.\n\n{{sender_name}}\nLRE Productions",
  },
  {
    id: "contract_reminder",
    label: "Contract reminder",
    subject: "Your contract for {{project_name}}",
    body:
      "Hi {{first_name}},\n\nA quick note that your contract for {{project_name}} is ready for your signature. Once it is signed we can hold your date and begin planning the details.\n\nPlease let me know if you have any questions.\n\nThank you,\n{{sender_name}}\nLRE Productions",
  },
  {
    id: "portal_invite",
    label: "Send the client portal link",
    subject: "Your project page for {{project_name}}",
    body:
      "Hi {{first_name}},\n\nHere is your private project page for {{project_name}}. It is one place to sign your agreement, pay invoices, see your floor plan, share planning details, and book a call with us:\n\n{{project_link}}\n\nThank you,\n{{sender_name}}\nLRE Productions",
  },
  {
    id: "planning_details",
    label: "Planning details request",
    subject: "A few details for {{project_name}}",
    body:
      "Hi {{first_name}},\n\nWe are getting closer to {{project_name}}{{on_date}}. When you have a moment, please use this link to share your planning details and upload anything we need (floor plans, schedules, logos):\n\n{{project_link}}\n\nThank you,\n{{sender_name}}\nLRE Productions",
  },
  {
    id: "thank_you_review",
    label: "Thank you and review request",
    subject: "Thank you from LRE Productions",
    body:
      "Hi {{first_name}},\n\nThank you for letting us be part of {{project_name}}. It was a true pleasure, and we hope it was everything you imagined.\n\nIf you have a minute, a short review would mean the world to our team. We read every one.\n\nWith appreciation,\n{{sender_name}}\nLRE Productions",
  },
];

export function firstNameOf(full: string | null | undefined): string {
  const n = (full ?? "").trim().split(/\s+/)[0];
  return n || "there";
}

/** Replace {{tokens}}. Unknown tokens are left alone; empty values drop cleanly. */
export function applyMergeFields(text: string, ctx: EmailMergeContext): string {
  const map: Record<string, string> = {
    first_name: ctx.firstName,
    project_name: ctx.projectName,
    event_date: ctx.eventDate,
    on_date: ctx.eventDate ? ` on ${ctx.eventDate}` : "",
    location: ctx.location,
    sender_name: ctx.senderName,
    project_link: ctx.projectLink,
  };
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, key: string) =>
    key in map ? map[key] : m,
  );
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Plain text -> simple HTML (paragraphs, line breaks, clickable links). */
export function textToEmailHtml(text: string): string {
  const linked = (line: string) =>
    esc(line).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}">${u}</a>`);
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a">${text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.split("\n").map(linked).join("<br>")}</p>`)
    .join("")}</div>`;
}

export const MAX_EMAIL_BODY = 8000;
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Split "a@b.com, c@d.com" into valid, de-duplicated addresses; reports bad entries. */
export function parseRecipients(raw: string): { valid: string[]; invalid: string[] } {
  const parts = raw.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    if (!EMAIL_RE.test(p)) invalid.push(p);
    else if (!seen.has(p.toLowerCase())) {
      seen.add(p.toLowerCase());
      valid.push(p);
    }
  }
  return { valid, invalid };
}
