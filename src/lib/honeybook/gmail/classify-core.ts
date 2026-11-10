import type { ParsedMessage } from "@/lib/honeybook/gmail/parse";
import { isMarketplaceRelay } from "@/lib/honeybook/gmail/trail-core";

export type Classification = {
  isEventInquiry: boolean;
  confidence: number;
  client: { name: string; email: string; phone: string };
  event: {
    type: string;
    /** YYYY-MM-DD or null */
    date: string | null;
    location: string;
    guestCount: number | null;
    budget: number | null;
  };
  /** One to three plain sentences for the project trail. Empty = nothing worth logging. */
  note: string;
  /** Things that were changed, added, or decided in this message, one short line each. */
  changes: string[];
  needsAction: boolean;
  /** What someone on the team should do next (only when needsAction). */
  action: string;
};

export type ProjectContext = {
  name: string;
  stage: string;
  projectDate: string | null;
  location: string;
  recentNotes: string[];
  /** To-dos already open on the project, so the model does not repeat them. */
  openActions: string[];
};

export const SYSTEM = [
  "You read ONE email from a staff mailbox at LRE Productions, an event-production company",
  "(audiovisual, corporate events, weddings & social events, golf events).",
  "Your job is to keep a clear trail so a teammate can pick up the project later.",
  "Be factual and brief. Never invent details that are not in the email.",
  "Ignore marketing, vendor sales pitches, and anything that is not about a client event.",
  "Dates must be YYYY-MM-DD. If a date has no year, assume the next occurrence after the email date.",
  "Return ONLY valid minified JSON, no markdown fences.",
].join(" ");

const SHAPE =
  '{"is_event_inquiry":false,"confidence":0,"client":{"name":"","email":"","phone":""},' +
  '"event":{"type":"","date":null,"location":"","guest_count":null,"budget":null},' +
  '"note":"","changes":[],"needs_action":false,"action":""}';

function cleanDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^\d{4}-\d{2}-\d{2}$/);
  return m ? v.trim() : null;
}

function cleanNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Parse the model's JSON defensively. Returns null when it is not usable. */
export function parseClassification(raw: string): Classification | null {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;

  const client = (obj.client ?? {}) as Record<string, unknown>;
  const event = (obj.event ?? {}) as Record<string, unknown>;
  const confidenceRaw = Number(obj.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : 0;
  const needsAction = obj.needs_action === true;

  return {
    isEventInquiry: obj.is_event_inquiry === true,
    confidence,
    client: {
      name: str(client.name, 200),
      email: str(client.email, 200).toLowerCase(),
      phone: str(client.phone, 60),
    },
    event: {
      type: str(event.type, 80),
      date: cleanDate(event.date),
      location: str(event.location, 300),
      guestCount: cleanNumber(event.guest_count),
      budget: cleanNumber(event.budget),
    },
    note: str(obj.note, 900),
    changes: Array.isArray(obj.changes)
      ? obj.changes
          .map((c) => str(c, 240))
          .filter(Boolean)
          .slice(0, 6)
      : [],
    needsAction,
    action: needsAction ? str(obj.action, 300) : "",
  };
}

export function buildPrompt(args: {
  message: ParsedMessage;
  staffName: string;
  project: ProjectContext | null;
  /** Short descriptions of past emails staff marked "not a lead", newest first. */
  notLeadExamples?: string[];
}): string {
  const { message, staffName, project, notLeadExamples = [] } = args;
  const lines: string[] = [
    `Mailbox owner (LRE staff): ${staffName}`,
    `Direction: ${message.direction === "outbound" ? "sent BY the staff member" : "received BY the staff member"}`,
    `Email date: ${new Date(message.internalMs).toISOString().slice(0, 10)}`,
    `From: ${message.from}`,
    `To: ${message.to.join(", ")}`,
    message.cc.length ? `Cc: ${message.cc.join(", ")}` : "",
    `Subject: ${message.subject}`,
    "",
  ];

  if (project) {
    lines.push(
      "This email is part of an EXISTING project:",
      `Project: ${project.name} | Stage: ${project.stage || "unknown"} | Event date: ${project.projectDate ?? "not set"} | Location: ${project.location || "not set"}`,
    );
    if (project.recentNotes.length > 0) {
      lines.push("Recent trail notes (newest first):");
      for (const n of project.recentNotes) lines.push(`- ${n}`);
    }
    if (project.openActions.length > 0) {
      lines.push("To-dos ALREADY open on this project (never repeat or rephrase these):");
      for (const a of project.openActions) lines.push(`- ${a}`);
    }
    lines.push(
      "",
      "Write `note` ONLY if this email adds something a teammate would need: a question, an answer, a decision,",
      "a quote or price, a date/location/guest-count/scope change, a request, a promise, or a next step.",
      "Leave `note` empty for pleasantries, scheduling chatter with no outcome, and thank-yous.",
      "Put each concrete change or addition in `changes`. Set needs_action only when someone on the team",
      "must do something (reply, send a quote, confirm, book, follow up) and say exactly what in `action`.",
      "Set is_event_inquiry false (this is not a new inquiry).",
      "Never create a to-do that only says to check an inbox, a platform, or for a reply; only real work.",
      "Do not add a to-do that restates a date, location, or budget difference already shown in the project line above.",
    );
  } else {
    lines.push(
      "This email is NOT yet linked to any project. Decide whether it is a NEW inquiry about an event",
      "(someone asking about hiring LRE for audiovisual, corporate, wedding/social, or golf event services).",
      "Set is_event_inquiry true only for a real prospective client. Newsletters, vendors, job seekers,",
      "and existing-client billing are false. Fill client (the PROSPECT, not the staff member) and event",
      "details only from the email. `note` is a 1-3 sentence summary of what they are asking for.",
      "Set needs_action true with a clear `action` (usually: reply to the inquiry and send details).",
      "A real inquiry is someone who wants to HIRE LRE, or buy services, for THEIR OWN event.",
      "These are NOT inquiries (is_event_inquiry false): vendors, exhibitors, sponsors, or performers asking to",
      "take part in or sell to LRE's events; partnership, referral, or collaboration requests; anyone",
      "describing what THEY offer (for example 'we would be a good fit for your events'); equipment or rental",
      "companies selling to LRE; job seekers; and press or podcast requests.",
      "When unsure whether the sender wants to hire LRE, set is_event_inquiry false or confidence below 0.5.",
    );
    if (notLeadExamples.length > 0) {
      lines.push("Staff previously marked emails like these as NOT leads:");
      for (const ex of notLeadExamples) lines.push(`- ${ex}`);
    }
  }

  if (isMarketplaceRelay(message.from)) {
    lines.push(
      "",
      "NOTE: this came through a lead marketplace (such as GigSalad or The Knot). The From name and address belong",
      "to the marketplace, NOT the client. Take the client's real name, email, and phone from the message text",
      "(leave them empty if the message does not give them). Do not call the client by the marketplace name.",
    );
  }

  lines.push("", "Email text:", message.body || "(no text)", "", `Return JSON shaped exactly like: ${SHAPE}`);
  return lines.filter((l) => l !== "").join("\n");
}
