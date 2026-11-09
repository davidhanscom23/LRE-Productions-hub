/**
 * Inquiry Forms - email content. PURE.
 *
 * Every email has a plain-text body (the Y? mailer sends text only) and an HTML body (hubs whose
 * mailer takes HTML). Every visitor value is HTML-escaped. Lead-facing emails never promise
 * availability: they confirm what was received and that the team will follow up.
 */
import type { Attribution, BrandProfile, Qualification, ScoreLabel } from "../types";
import { formatLongDate } from "../dates";
import { dateResultWords, locationResultWords } from "./lifecycle-core";
import { isCalendarDate } from "./schema-core";

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Subjects are one line, no control characters, capped. */
export function cleanSubject(subject: string): string {
  return subject.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}

/** The LeadGate "emoji tactic": lead-facing subjects start with the business's emoji prefix. */
export function withEmojiPrefix(subject: string, prefix: string | null | undefined): string {
  const s = cleanSubject(subject);
  const p = (prefix ?? "").replace(/\s+/g, " ").trim();
  if (!p || s.startsWith(p)) return s;
  return cleanSubject(`${p} ${s}`);
}

/** {{business_name}} and {{first_name}} (case-insensitive) in admin-written copy. */
export function fillMergeTags(text: string, values: { businessName: string; firstName: string | null }): string {
  return text
    .replace(/\{\{\s*business_name\s*\}\}/gi, values.businessName)
    .replace(/\{\{\s*first_name\s*\}\}/gi, values.firstName || "there");
}

export function firstNameOf(name: string | null | undefined): string | null {
  const first = (name ?? "").replace(/\s+/g, " ").trim().split(" ")[0] ?? "";
  return first ? first.slice(0, 60) : null;
}

/** Staff-facing qualification lines (miles shown here; never to visitors). */
export function qualificationLines(input: {
  qualification: Qualification;
  score: number | null;
  scoreLabel: ScoreLabel | null;
  budgetLabel: string | null;
}): string[] {
  const q = input.qualification;
  const lines: string[] = [];
  if (q.date) {
    const when = isCalendarDate(q.date.checkedFor) ? ` (${formatLongDate(q.date.checkedFor)})` : "";
    lines.push(`Date: ${dateResultWords(q.date.result)}${when}`);
  }
  if (q.altDateChosen) lines.push("They picked one of the nearby dates we suggested.");
  if (q.location) {
    const miles = typeof q.location.miles === "number" ? `, about ${Math.round(q.location.miles)} miles` : "";
    const where = q.location.query ? ` (${q.location.query})` : "";
    lines.push(`Location: ${locationResultWords(q.location.result)}${miles}${where}`);
  }
  if (input.budgetLabel) lines.push(`Budget: ${input.budgetLabel}`);
  if (input.scoreLabel) {
    lines.push(`Fit: ${input.scoreLabel}${typeof input.score === "number" ? ` (score ${input.score})` : ""}`);
  }
  return lines;
}

const ATTRIBUTION_LABELS: [keyof Attribution, string][] = [
  ["utm_source", "Source"],
  ["utm_medium", "Medium"],
  ["utm_campaign", "Campaign"],
  ["utm_term", "Keyword"],
  ["utm_content", "Ad content"],
  ["gclid", "Google Ads click"],
  ["gbraid", "Google Ads click (iOS)"],
  ["wbraid", "Google Ads click (web to app)"],
  ["fbclid", "Facebook click"],
  ["msclkid", "Microsoft Ads click"],
  ["page_url", "Page"],
  ["host_domain", "Website"],
  ["referrer", "Came from"],
  ["landing_url", "First visit"],
];

export function attributionLines(a: Attribution): string[] {
  const lines: string[] = [];
  for (const [key, label] of ATTRIBUTION_LABELS) {
    const v = a?.[key];
    if (typeof v === "string" && v.trim()) lines.push(`${label}: ${v.trim()}`);
  }
  return lines;
}

function htmlSection(title: string, lines: string[]): string {
  if (lines.length === 0) return "";
  const rows = lines
    .map((line) => {
      const at = line.indexOf(": ");
      if (at > 0) {
        return `<p style="margin:0 0 6px 0;"><strong>${escapeHtml(line.slice(0, at))}:</strong> ${escapeHtml(
          line.slice(at + 2),
        )}</p>`;
      }
      return `<p style="margin:0 0 6px 0;">${escapeHtml(line)}</p>`;
    })
    .join("");
  return `<h2 style="font-size:15px;margin:20px 0 8px 0;color:#111827;">${escapeHtml(title)}</h2>${rows}`;
}

function htmlShell(inner: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff;"><div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111827;">${inner}</div></body></html>`;
}

function textSection(title: string, lines: string[]): string[] {
  return lines.length ? ["", title, ...lines] : [];
}

/** New inquiry email to staff (settings.notify.recipients). */
export function buildStaffEmail(input: {
  formName: string;
  ending: "completed" | "waitlisted";
  headline: string;
  contact: { name: string | null; email: string | null; phone: string | null };
  qualification: string[];
  answers: string[];
  attribution: Attribution;
  /** "Nov 4, 2026, 3:05 PM ET" */
  submittedAt: string;
  /** Absolute link to the record in the hub. */
  hubLink: string;
}): EmailContent {
  const waitlist = input.ending === "waitlisted";
  const subject = cleanSubject(`${waitlist ? "Waitlist request" : "New website inquiry"}: ${input.headline}`);
  const contactLines = [
    input.contact.name ? `Name: ${input.contact.name}` : "",
    input.contact.email ? `Email: ${input.contact.email}` : "",
    input.contact.phone ? `Phone: ${input.contact.phone}` : "",
  ].filter(Boolean);
  const intro = waitlist
    ? `${input.headline}. They asked to join the waitlist because the date looked busy.`
    : `${input.headline}.`;
  const sourceLines = attributionLines(input.attribution);

  const text = [
    intro,
    "",
    `Form: ${input.formName}`,
    `Sent: ${input.submittedAt}`,
    ...textSection("Contact", contactLines),
    ...textSection("What we checked", input.qualification),
    ...textSection("Answers", input.answers),
    ...textSection("Where they came from", sourceLines),
    "",
    `Open it in the Hub: ${input.hubLink}`,
  ].join("\n");

  const html = htmlShell(
    [
      `<p style="margin:0 0 12px 0;font-size:17px;"><strong>${escapeHtml(intro)}</strong></p>`,
      `<p style="margin:0 0 4px 0;">Form: ${escapeHtml(input.formName)}</p>`,
      `<p style="margin:0 0 4px 0;">Sent: ${escapeHtml(input.submittedAt)}</p>`,
      htmlSection("Contact", contactLines),
      htmlSection("What we checked", input.qualification),
      htmlSection("Answers", input.answers),
      htmlSection("Where they came from", sourceLines),
      `<p style="margin:24px 0 0 0;"><a href="${escapeHtml(input.hubLink)}" style="color:#1d4ed8;font-weight:600;">Open it in the Hub</a></p>`,
    ].join(""),
  );

  return { subject, text, html };
}

/** Thank-you copy to the visitor (only when settings.confirmationEmail.enabled). */
export function buildConfirmationEmail(input: {
  brand: Pick<BrandProfile, "name" | "phone" | "siteUrl" | "legalLine">;
  name: string | null;
  subject: string;
  intro: string;
  emojiPrefix: string | null;
  answers: string[];
}): EmailContent {
  const firstName = firstNameOf(input.name);
  const tags = { businessName: input.brand.name, firstName };
  const subject = withEmojiPrefix(fillMergeTags(input.subject, tags), input.emojiPrefix);
  const intro = fillMergeTags(input.intro, tags).trim();
  const greeting = `Hi ${firstName ?? "there"},`;
  const changes = input.brand.phone
    ? `If anything needs a change, just reply to this email or call us at ${input.brand.phone}.`
    : "If anything needs a change, just reply to this email.";
  const footer = [input.brand.name, input.brand.siteUrl ?? "", input.brand.legalLine ?? ""].filter(Boolean);
  // The default intro already ends with "Here is a copy of what you sent us."
  const leadIn = /copy of what you sent/i.test(intro) ? [] : ["Here is a copy of what you sent us:", ""];

  const text = [
    greeting,
    "",
    ...(intro ? [intro, ""] : []),
    ...(input.answers.length ? [...leadIn, ...input.answers, ""] : []),
    changes,
    "",
    ...footer,
  ].join("\n");

  const html = htmlShell(
    [
      `<p style="margin:0 0 12px 0;">${escapeHtml(greeting)}</p>`,
      intro ? `<p style="margin:0 0 12px 0;">${escapeHtml(intro).replace(/\n/g, "<br>")}</p>` : "",
      htmlSection("What you sent us", input.answers),
      `<p style="margin:20px 0 12px 0;">${escapeHtml(changes)}</p>`,
      `<p style="margin:0;color:#374151;">${footer.map((line) => escapeHtml(line)).join("<br>")}</p>`,
    ].join(""),
  );

  return { subject, text, html };
}
