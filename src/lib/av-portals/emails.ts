import type { PortalStatus } from "./items";
import type { CheckinKind } from "./cadence";

export type EmailKind = CheckinKind | "complete" | "manual";

export type EmailPortal = {
  token: string;
  show_seq: number;
  event_name: string;
  client_name: string;
  event_date: string;
  venue_name: string;
  note_to_client: string;
};

export function getPublicBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://hub.lreproductions.com";
  return raw.replace(/\/+$/, "");
}

export function portalUrl(token: string): string {
  return `${getPublicBaseUrl()}/portal/${token}`;
}

export function showFileNumber(portal: Pick<EmailPortal, "show_seq" | "event_date">): string {
  return `VP-${portal.event_date.slice(0, 4)}-${String(portal.show_seq).padStart(4, "0")}`;
}

export function formatEventDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00Z`));
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const LEAD: Record<CheckinKind, string> = {
  d30: "Your show is a month away, and a few details now make load-in smooth.",
  d14: "Two weeks to go. Here is what we still need from you.",
  d7: "One week out. These last details keep show day calm.",
  d3: "Three days to go. Please send what is left today if you can.",
};

export function buildEmail(args: {
  kind: EmailKind;
  portal: EmailPortal;
  status: PortalStatus;
  daysLeft: number;
}): { subject: string; text: string; html: string } {
  const { kind, portal, status, daysLeft } = args;
  const link = portalUrl(portal.token);
  const file = showFileNumber(portal);
  const when = formatEventDate(portal.event_date);
  const where = portal.venue_name ? ` at ${portal.venue_name}` : "";
  const greet = portal.client_name ? `Hi ${portal.client_name.split(" ")[0]},` : "Hello,";
  const done = status.allComplete;

  let subject: string;
  let lead: string;
  if (kind === "complete" || done) {
    subject = `You're all set for ${portal.event_name}`;
    lead = "We have everything we need. Thank you, and we cannot wait to bring your event to life.";
  } else if (kind === "d30") {
    subject = `Planning ${portal.event_name}: what we need from you`;
    lead = LEAD.d30;
  } else if (kind === "manual") {
    subject = `${portal.event_name}: your AV planning checklist`;
    lead = `Here is where your AV planning stands, ${daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} before the show` : "ahead of the show"}.`;
  } else {
    const n = Number(kind.slice(1));
    subject = `${n} days to go: ${portal.event_name}`;
    lead = LEAD[kind];
  }

  const showList = !(kind === "complete" || done);
  const rows = status.items.map((it, i) => ({
    n: String(i + 1).padStart(2, "0"),
    label: it.def.label,
    hint: it.def.hint,
    complete: it.complete,
  }));
  const note = portal.note_to_client.trim();

  const text = [
    greet,
    "",
    lead,
    "",
    `${portal.event_name}`,
    `${when}${where}`,
    `Show file ${file}`,
    "",
    ...(showList
      ? [
          `Checklist (${status.completeCount} of ${status.total} received):`,
          ...rows.map((r) => `${r.complete ? "[x]" : "[ ]"} ${r.n} ${r.label}: ${r.hint}`),
          "",
        ]
      : []),
    ...(note ? [note, ""] : []),
    showList ? `Open your event portal (no login needed): ${link}` : `Your portal, any time: ${link}`,
    "",
    "Warmly,",
    "The LRE Productions Audiovisual Team",
  ].join("\n");

  const rowHtml = rows
    .map(
      (r) => `<tr><td style="padding:12px 0;border-top:1px solid #e7e1d8;width:36px;font:12px monospace;color:${r.complete ? "#2f7d4f" : "#9a7340"}">${r.complete ? "&#10003;" : r.n}</td>
<td style="padding:12px 0;border-top:1px solid #e7e1d8"><div style="font:600 15px Arial,sans-serif;color:${r.complete ? "#8a8a8a" : "#111"};${r.complete ? "text-decoration:line-through" : ""}">${esc(r.label)}</div><div style="font:13px Arial,sans-serif;color:#6b6b6b">${esc(r.hint)}</div></td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f1ec">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff">
<tr><td style="background:#0d0d0d;padding:22px 28px;border-bottom:3px solid #9a7340"><span style="font:600 14px Arial,sans-serif;letter-spacing:.28em;color:#fff">LRE PRODUCTIONS</span><span style="float:right;font:11px monospace;letter-spacing:.14em;color:#c19960">SHOW FILE ${esc(file)}</span></td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 6px;font:12px Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#6b6b6b">${esc(when)}${esc(where)}</p>
<h1 style="margin:0 0 16px;font:600 24px Arial,sans-serif;color:#111">${esc(portal.event_name)}</h1>
<p style="margin:0 0 6px;font:16px/1.55 Arial,sans-serif;color:#222">${esc(greet)}</p>
<p style="margin:0 0 20px;font:16px/1.55 Arial,sans-serif;color:#222">${esc(lead)}</p>
${showList ? `<p style="margin:0 0 4px;font:700 11px Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#9a7340">Cue sheet · ${status.completeCount} of ${status.total} received</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">${rowHtml}</table>` : ""}
${note ? `<p style="margin:0 0 20px;font:15px/1.55 Arial,sans-serif;color:#333">${esc(note)}</p>` : ""}
<p style="margin:0 0 22px"><a href="${esc(link)}" style="display:inline-block;background:#0d0d0d;color:#fff;text-decoration:none;font:600 14px Arial,sans-serif;letter-spacing:.06em;padding:14px 26px;border-bottom:3px solid #9a7340">${showList ? "Open your event portal" : "View your event portal"}</a></p>
<p style="margin:0;font:13px/1.5 Arial,sans-serif;color:#6b6b6b">No login or password needed. You can also forward this email to anyone helping you plan.</p>
</td></tr></table>
<p style="font:12px Arial,sans-serif;color:#8a8a8a;margin:14px 0 0">LRE Productions · Ponte Vedra Beach, FL · lreproductions.com</p>
</td></tr></table></body></html>`;

  return { subject, text, html };
}
