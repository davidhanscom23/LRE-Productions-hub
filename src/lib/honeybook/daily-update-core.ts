/**
 * Pure builders for the HoneyBook daily update: what each staff member sees about their own
 * projects, and the single combined email the admins get. No database or network access here.
 */

export type DigestProject = {
  id: string;
  name: string;
  clientName: string;
  stage: string;
  projectDate: string | null;
  location: string;
  role: "lead" | "support";
  /** "partnership" for venue/vendor deals (no event date, no client). Default event. */
  kind?: "event" | "partnership";
  /** Newest trail activity (note or project update), ISO timestamp. */
  lastActivityAt: string | null;
  lastNote: string;
  /** Open "needs action" notes written from email or by staff. */
  openActions: string[];
};

export type DigestTask = {
  title: string;
  dueDate: string | null;
  projectName: string;
};

export type StaffDigest = {
  staffId: string;
  name: string;
  email: string;
  projects: DigestProject[];
  tasks: DigestTask[];
};

/** A partnership nobody is assigned to that still has open to-dos (admin email only). */
export type UnassignedPartnership = {
  id: string;
  name: string;
  openActions: string[];
};

export type UnassignedInquiry = {
  id: string;
  name: string;
  clientName: string;
  createdAt: string;
};

const CLOSED = new Set(["completed", "lost", "archived", "not moving forward"]);

export function isClosedStage(stage: string): boolean {
  return CLOSED.has(stage.trim().toLowerCase());
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}

/** Whole days from `todayIso` to `dateIso` (negative = in the past). */
export function daysUntil(dateIso: string | null, todayIso: string): number | null {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}/.test(dateIso)) return null;
  return dayNumber(dateIso) - dayNumber(todayIso);
}

/** Whole days since an ISO timestamp, as of `todayIso` (date only). */
export function daysSince(timestamp: string | null, todayIso: string): number | null {
  if (!timestamp) return null;
  const day = timestamp.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return dayNumber(todayIso) - dayNumber(day);
}

/** Rule-based nudges from stage, event date, and how long the project has been quiet. */
export function suggestActions(p: DigestProject, todayIso: string): string[] {
  if (isClosedStage(p.stage)) return [];
  const stage = p.stage.trim().toLowerCase();
  const quiet = daysSince(p.lastActivityAt, todayIso);
  if (p.kind === "partnership") {
    // Partnerships have no event date and no client: only nudge when they go quiet.
    if (stage === "active partner") return [];
    if (quiet != null && quiet >= 14) {
      return [`Partnership has been quiet for ${quiet} days. Check in with the partner.`];
    }
    return [];
  }
  const until = daysUntil(p.projectDate, todayIso);
  const out: string[] = [];

  if (stage === "inquiry" || stage === "") {
    if (quiet == null) out.push("New inquiry with no reply logged yet. Reply to the client.");
    else if (quiet >= 1) {
      out.push(`Inquiry has been quiet for ${quiet} day${quiet === 1 ? "" : "s"}. Reply or follow up.`);
    }
  } else if (stage.includes("proposal")) {
    if (quiet != null && quiet >= 3) {
      out.push(`Proposal sent and quiet for ${quiet} days. Follow up.`);
    }
  } else if (stage.includes("contract")) {
    if (quiet != null && quiet >= 3) {
      out.push(`Contract out and quiet for ${quiet} days. Follow up on the signature.`);
    }
  }

  if (until != null) {
    const booked = ["booked", "in progress", "retainer paid", "paid in full"].includes(stage);
    if (until < 0) {
      out.push(`Event date passed ${-until} day${until === -1 ? "" : "s"} ago. Mark it completed or fix the date.`);
    } else if (until <= 14 && !booked) {
      out.push(`Event is ${until === 0 ? "today" : `in ${until} day${until === 1 ? "" : "s"}`} and the project is still "${p.stage || "Inquiry"}". Confirm where it stands.`);
    }
  }

  if (out.length === 0 && quiet != null && quiet >= 7) {
    out.push(`No activity logged in ${quiet} days. Check in on this one.`);
  }
  return out;
}

export function countNeedsAttention(d: StaffDigest, todayIso: string): number {
  let n = 0;
  for (const p of d.projects) {
    n += p.openActions.length + suggestActions(p, todayIso).length;
  }
  for (const t of d.tasks) {
    const due = daysUntil(t.dueDate, todayIso);
    if (due != null && due <= 0) n += 1;
  }
  return n;
}

export function hasAnythingToReport(d: StaffDigest): boolean {
  return d.projects.length > 0 || d.tasks.length > 0;
}

function prettyDate(iso: string | null): string {
  if (!iso) return "date TBD";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function sortProjects(projects: DigestProject[]): DigestProject[] {
  return [...projects].sort((a, b) => {
    const ad = a.projectDate ?? "9999-12-31";
    const bd = b.projectDate ?? "9999-12-31";
    return ad.localeCompare(bd);
  });
}

function projectLine(p: DigestProject): string {
  if (p.kind === "partnership") {
    return `[Partnership] ${p.name}: ${p.stage || "Prospect"}${p.location ? ` · ${p.location}` : ""}`;
  }
  const bits = [p.stage || "Inquiry", prettyDate(p.projectDate)];
  if (p.location) bits.push(p.location);
  return `${p.name} (${p.clientName || "no client"}): ${bits.join(" · ")}`;
}

/** "(Client): Stage, Date" for events; "[Partnership]: Stage" for partnerships. */
function htmlProjectMeta(p: DigestProject): string {
  if (p.kind === "partnership") return `[Partnership]: ${p.stage || "Prospect"}`;
  return `(${p.clientName || "no client"}): ${p.stage || "Inquiry"}, ${prettyDate(p.projectDate)}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type BuiltEmail = { subject: string; text: string; html: string };

function projectUrl(base: string, id: string): string {
  return `${base.replace(/\/$/, "")}/honeybook/projects/${id}`;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}

/** One person's own update: needs-action first, then upcoming events, then everything they own. */
export function buildStaffEmail(
  d: StaffDigest,
  todayIso: string,
  siteBase: string,
): BuiltEmail {
  const attention = countNeedsAttention(d, todayIso);
  const projects = sortProjects(d.projects);

  const textLines: string[] = [`Hi ${firstName(d.name)},`, ""];
  const html: string[] = [`<p>Hi ${esc(firstName(d.name))},</p>`];

  textLines.push(
    attention > 0
      ? `Here is your HoneyBook update. ${attention} thing${attention === 1 ? "" : "s"} need${attention === 1 ? "s" : ""} your attention.`
      : "Here is your HoneyBook update. Nothing needs action right now.",
    "",
  );
  html.push(
    `<p>${
      attention > 0
        ? `Here is your HoneyBook update. <strong>${attention} thing${attention === 1 ? "" : "s"} need${attention === 1 ? "s" : ""} your attention.</strong>`
        : "Here is your HoneyBook update. Nothing needs action right now."
    }</p>`,
  );

  const needs = projects.filter(
    (p) => p.openActions.length > 0 || suggestActions(p, todayIso).length > 0,
  );
  if (needs.length > 0) {
    textLines.push("NEEDS ACTION");
    html.push("<h3>Needs action</h3><ul>");
    for (const p of needs) {
      textLines.push(`• ${projectLine(p)}`);
      html.push(`<li><a href="${projectUrl(siteBase, p.id)}">${esc(p.name)}</a> ${esc(htmlProjectMeta(p))}<ul>`);
      for (const a of p.openActions) {
        textLines.push(`    - ${a}`);
        html.push(`<li>${esc(a)}</li>`);
      }
      for (const a of suggestActions(p, todayIso)) {
        textLines.push(`    - ${a}`);
        html.push(`<li>${esc(a)}</li>`);
      }
      textLines.push(`    ${projectUrl(siteBase, p.id)}`);
      html.push("</ul></li>");
    }
    textLines.push("");
    html.push("</ul>");
  }

  const dueTasks = d.tasks.filter((t) => {
    const due = daysUntil(t.dueDate, todayIso);
    return due != null && due <= 7;
  });
  if (dueTasks.length > 0) {
    textLines.push("TASKS DUE SOON");
    html.push("<h3>Tasks due soon</h3><ul>");
    for (const t of dueTasks) {
      const due = daysUntil(t.dueDate, todayIso);
      const label = due != null && due < 0 ? "overdue" : due === 0 ? "due today" : `due ${prettyDate(t.dueDate)}`;
      textLines.push(`• ${t.title}${t.projectName ? ` (${t.projectName})` : ""}: ${label}`);
      html.push(`<li>${esc(t.title)}${t.projectName ? ` (${esc(t.projectName)})` : ""}: ${esc(label)}</li>`);
    }
    textLines.push("");
    html.push("</ul>");
  }

  const upcoming = projects.filter((p) => {
    if (p.kind === "partnership") return false;
    const until = daysUntil(p.projectDate, todayIso);
    return until != null && until >= 0 && until <= 30;
  });
  if (upcoming.length > 0) {
    textLines.push("EVENTS IN THE NEXT 30 DAYS");
    html.push("<h3>Events in the next 30 days</h3><ul>");
    for (const p of upcoming) {
      textLines.push(`• ${projectLine(p)}`);
      html.push(`<li><a href="${projectUrl(siteBase, p.id)}">${esc(p.name)}</a>: ${esc(p.stage || "Inquiry")}, ${esc(prettyDate(p.projectDate))}${p.location ? `, ${esc(p.location)}` : ""}</li>`);
    }
    textLines.push("");
    html.push("</ul>");
  }

  if (projects.length > 0) {
    textLines.push("ALL YOUR PROJECTS");
    html.push("<h3>All your projects</h3><ul>");
    for (const p of projects) {
      const role = p.role === "lead" ? "lead" : "support";
      textLines.push(`• ${projectLine(p)} [${role}]`);
      if (p.lastNote) textLines.push(`    Latest: ${p.lastNote}`);
      html.push(`<li><a href="${projectUrl(siteBase, p.id)}">${esc(p.name)}</a> [${role}]${p.kind === "partnership" ? " [Partnership]" : ""}: ${esc(p.stage || "Inquiry")}${p.kind === "partnership" ? "" : ", " + esc(prettyDate(p.projectDate))}${p.lastNote ? `<br><em>Latest: ${esc(p.lastNote)}</em>` : ""}</li>`);
    }
    textLines.push("");
    html.push("</ul>");
  }

  textLines.push("Open the Projects tab in the Hub to add notes or update a stage.", "", "LRE Productions Hub");
  html.push('<p>Open the Projects tab in the Hub to add notes or update a stage.</p><p>LRE Productions Hub</p>');

  const subject =
    attention > 0
      ? `Your HoneyBook update: ${attention} need${attention === 1 ? "s" : ""} attention`
      : "Your HoneyBook update";
  return { subject, text: textLines.join("\n"), html: html.join("\n") };
}

/** The single admin email: everyone's projects in one place, instead of a copy of each staff email. */
export function buildAdminEmail(args: {
  digests: StaffDigest[];
  unassigned: UnassignedInquiry[];
  unassignedPartnerships?: UnassignedPartnership[];
  syncIssues: string[];
  todayIso: string;
  siteBase: string;
}): BuiltEmail {
  const { digests, unassigned, syncIssues, todayIso, siteBase } = args;
  const unassignedPartnerships = args.unassignedPartnerships ?? [];
  const active = digests.filter(hasAnythingToReport);
  const totalAttention = active.reduce((n, d) => n + countNeedsAttention(d, todayIso), 0);

  const text: string[] = [
    `HoneyBook team update for ${prettyDate(todayIso)}`,
    "",
    `${active.length} team member${active.length === 1 ? "" : "s"} with active projects. ${totalAttention} item${totalAttention === 1 ? "" : "s"} need attention.`,
    "",
  ];
  const html: string[] = [
    `<h2>HoneyBook team update: ${esc(prettyDate(todayIso))}</h2>`,
    `<p>${active.length} team member${active.length === 1 ? "" : "s"} with active projects. <strong>${totalAttention} item${totalAttention === 1 ? "" : "s"} need attention.</strong></p>`,
  ];

  if (unassigned.length > 0) {
    text.push("UNASSIGNED INQUIRIES (nobody owns these yet)");
    html.push("<h3>Unassigned inquiries (nobody owns these yet)</h3><ul>");
    for (const u of unassigned) {
      text.push(`• ${u.name} (${u.clientName || "no client"}), received ${prettyDate(u.createdAt)}: ${projectUrl(siteBase, u.id)}`);
      html.push(`<li><a href="${projectUrl(siteBase, u.id)}">${esc(u.name)}</a> (${esc(u.clientName || "no client")}), received ${esc(prettyDate(u.createdAt))}</li>`);
    }
    text.push("");
    html.push("</ul>");
  }

  if (unassignedPartnerships.length > 0) {
    text.push("PARTNERSHIPS WITH OPEN TO-DOS BUT NO ONE ASSIGNED");
    html.push("<h3>Partnerships with open to-dos but no one assigned</h3><ul>");
    for (const u of unassignedPartnerships) {
      text.push(`• ${u.name}: ${projectUrl(siteBase, u.id)}`);
      html.push(`<li><a href="${projectUrl(siteBase, u.id)}">${esc(u.name)}</a><ul>`);
      for (const a of u.openActions) {
        text.push(`    - ${a}`);
        html.push(`<li>${esc(a)}</li>`);
      }
      html.push("</ul></li>");
    }
    text.push("");
    html.push("</ul>");
  }

  for (const d of active) {
    const projects = sortProjects(d.projects);
    const n = countNeedsAttention(d, todayIso);
    text.push(`${d.name.toUpperCase()}: ${projects.length} project${projects.length === 1 ? "" : "s"}, ${n} need${n === 1 ? "s" : ""} attention`);
    html.push(`<h3>${esc(d.name)}: ${projects.length} project${projects.length === 1 ? "" : "s"}, ${n} need${n === 1 ? "s" : ""} attention</h3><ul>`);
    for (const p of projects) {
      const acts = [...p.openActions, ...suggestActions(p, todayIso)];
      text.push(`• ${projectLine(p)}`);
      for (const a of acts) text.push(`    - ${a}`);
      html.push(`<li><a href="${projectUrl(siteBase, p.id)}">${esc(p.name)}</a> ${esc(htmlProjectMeta(p))}${p.location ? `, ${esc(p.location)}` : ""}`);
      if (acts.length > 0) {
        html.push("<ul>");
        for (const a of acts) html.push(`<li>${esc(a)}</li>`);
        html.push("</ul>");
      }
      html.push("</li>");
    }
    const overdue = d.tasks.filter((t) => {
      const due = daysUntil(t.dueDate, todayIso);
      return due != null && due <= 0;
    });
    for (const t of overdue) {
      text.push(`    Task due/overdue: ${t.title}${t.projectName ? ` (${t.projectName})` : ""}`);
      html.push(`<li>Task due/overdue: ${esc(t.title)}${t.projectName ? ` (${esc(t.projectName)})` : ""}</li>`);
    }
    text.push("");
    html.push("</ul>");
  }

  if (syncIssues.length > 0) {
    text.push("EMAIL MONITORING ISSUES");
    html.push("<h3>Email monitoring issues</h3><ul>");
    for (const s of syncIssues) {
      text.push(`• ${s}`);
      html.push(`<li>${esc(s)}</li>`);
    }
    text.push("");
    html.push("</ul>");
  }

  text.push("LRE Productions Hub");
  html.push("<p>LRE Productions Hub</p>");

  return {
    subject: `HoneyBook team update: ${totalAttention} need${totalAttention === 1 ? "s" : ""} attention`,
    text: text.join("\n"),
    html: html.join("\n"),
  };
}
