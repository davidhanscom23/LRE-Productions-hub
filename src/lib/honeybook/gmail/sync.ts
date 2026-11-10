import "server-only";

import { isAiConfigured } from "@/lib/kb";
import {
  classifyMessage,
  type Classification,
  type ProjectContext,
} from "@/lib/honeybook/gmail/classify";
import {
  getGmailForMailbox,
  isGmailServiceAccountConfigured,
  isGmailSyncEnabled,
} from "@/lib/honeybook/gmail/client";
import { findSimilarProjects } from "@/lib/honeybook/duplicates";
import { parseGmailMessage, type ParsedMessage } from "@/lib/honeybook/gmail/parse";
import {
  externalParticipants,
  isAutomatedMessage,
  isInternalAddress,
} from "@/lib/honeybook/gmail/rules";
import {
  dropRepeatedActions,
  identifyingParticipants,
  isInboxChaseAction,
  isMarketplaceRelay,
  isRestatedConflict,
  marketplaceName,
  notLeadSenderKey,
} from "@/lib/honeybook/gmail/trail-core";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createServiceClient>;

export type GmailSyncSummary = {
  ran: boolean;
  skippedReason: string | null;
  mailboxes: number;
  examined: number;
  inquiries: number;
  notes: number;
  ignored: number;
  errors: string[];
};

type Staff = { id: string; name: string; mailbox: string };

type MatchedProject = {
  id: string;
  name: string;
  stage: string;
  project_date: string | null;
  location: string;
  budget: number | string | null;
};

const CLOSED_STAGES = new Set(["completed", "lost", "archived"]);
const MAX_MESSAGES_PER_MAILBOX = 20;
const TIME_BUDGET_MS = 240_000;
const OVERLAP_MS = 15 * 60 * 1000;
const MIN_INQUIRY_CONFIDENCE = 0.7;
const STAFF_DOMAIN = "lreproductions.com";

function lookbackMs(): number {
  const raw = Number(process.env.HONEYBOOK_GMAIL_LOOKBACK_DAYS);
  const days = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 14) : 3;
  return days * 24 * 60 * 60 * 1000;
}

/** Staff mailboxes to read: active admins/Leads/staff on the LRE Workspace domain. */
async function loadMailboxes(db: Db): Promise<Staff[]> {
  const override = (process.env.HONEYBOOK_GMAIL_MAILBOXES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const { data } = await db
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .in("role", ["admin", "trainer", "staff"])
    .eq("is_active", true);

  const staff: Staff[] = [];
  for (const row of data ?? []) {
    const email = String(row.email ?? "").trim().toLowerCase();
    if (!email.endsWith(`@${STAFF_DOMAIN}`)) continue;
    if (override.length > 0 && !override.includes(email)) continue;
    staff.push({
      id: row.id as string,
      name: String(row.full_name ?? "").trim() || email,
      mailbox: email,
    });
  }
  return staff;
}

async function findProjectForMessage(
  db: Db,
  parsed: ParsedMessage,
  participants: string[],
): Promise<{ project: MatchedProject | null; clientId: string | null }> {
  const { data: mapped } = await db
    .from("honeybook_gmail_threads")
    .select("project_id")
    .eq("mailbox", parsed.mailbox)
    .eq("thread_id", parsed.threadId)
    .maybeSingle();

  const projectCols = "id, name, stage, project_date, location, budget";

  if (mapped?.project_id) {
    const { data: p } = await db
      .from("honeybook_projects")
      .select(projectCols)
      .eq("id", mapped.project_id)
      .maybeSingle();
    if (p) return { project: p as MatchedProject, clientId: null };
  }

  // Marketplace relay addresses (GigSalad etc.) are shared by many prospects, so they can
  // never identify a client. Those threads are matched by email thread only.
  const identifying = identifyingParticipants(participants);
  if (identifying.length === 0) return { project: null, clientId: null };

  const { data: clients } = await db
    .from("honeybook_clients")
    .select("id")
    .in("email", identifying);
  const clientIds = (clients ?? []).map((c) => c.id as string);
  if (clientIds.length === 0) return { project: null, clientId: null };

  const { data: projects } = await db
    .from("honeybook_projects")
    .select(`${projectCols}, client_id`)
    .in("client_id", clientIds)
    .order("updated_at", { ascending: false })
    .limit(10);

  const open = (projects ?? []).find(
    (p) => !CLOSED_STAGES.has(String(p.stage ?? "").trim().toLowerCase()),
  );
  return {
    project: open ? (open as unknown as MatchedProject) : null,
    // A known client with no open project: a new inquiry should reuse them.
    clientId: clientIds[0] ?? null,
  };
}

async function loadProjectContext(db: Db, project: MatchedProject): Promise<ProjectContext> {
  const { data: notes } = await db
    .from("honeybook_project_notes")
    .select("body")
    .eq("project_id", project.id)
    .order("occurred_at", { ascending: false })
    .limit(3);
  const openActions = await loadOpenActions(db, project.id);
  return {
    name: project.name,
    stage: project.stage,
    projectDate: project.project_date,
    location: project.location ?? "",
    recentNotes: (notes ?? []).map((n) => String(n.body ?? "").slice(0, 300)),
    openActions: openActions.slice(0, 8).map((a) => a.slice(0, 200)),
  };
}

/** Bodies of to-dos still open on a project (not yet marked done). */
async function loadOpenActions(db: Db, projectId: string): Promise<string[]> {
  const { data } = await db
    .from("honeybook_project_notes")
    .select("body")
    .eq("project_id", projectId)
    .eq("needs_action", true)
    .is("action_done_at", null)
    .order("occurred_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((n) => String(n.body ?? ""));
}

/** True when staff already said this thread or sender is "not a lead". */
async function isMarkedNotLead(db: Db, parsed: ParsedMessage): Promise<boolean> {
  const { data: thread } = await db
    .from("honeybook_gmail_not_leads")
    .select("id")
    .eq("kind", "thread")
    .eq("mailbox", parsed.mailbox)
    .eq("thread_id", parsed.threadId)
    .limit(1)
    .maybeSingle();
  if (thread) return true;
  const sender = notLeadSenderKey(parsed.from);
  if (!sender) return false;
  const { data } = await db
    .from("honeybook_gmail_not_leads")
    .select("id")
    .eq("kind", "sender")
    .eq("sender_email", sender)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/** Short descriptions of recent "not a lead" cards, shown to the classifier as examples. */
async function loadNotLeadExamples(db: Db): Promise<string[]> {
  const { data } = await db
    .from("honeybook_gmail_not_leads")
    .select("project_name, summary")
    .eq("kind", "thread")
    .neq("summary", "")
    .order("created_at", { ascending: false })
    .limit(6);
  return (data ?? []).map((r) =>
    String(r.summary ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200),
  );
}

async function recordLedger(
  db: Db,
  parsed: ParsedMessage,
  outcome: "inquiry" | "note" | "no_change" | "ignored" | "error",
  projectId: string | null,
) {
  await db.from("honeybook_gmail_messages").upsert(
    {
      message_key: parsed.messageKey,
      mailbox: parsed.mailbox,
      gmail_id: parsed.gmailId,
      thread_id: parsed.threadId,
      outcome,
      project_id: projectId,
      processed_at: new Date().toISOString(),
    },
    { onConflict: "message_key" },
  );
}

async function mapThread(db: Db, parsed: ParsedMessage, projectId: string) {
  await db.from("honeybook_gmail_threads").upsert(
    { mailbox: parsed.mailbox, thread_id: parsed.threadId, project_id: projectId },
    { onConflict: "mailbox,thread_id" },
  );
}

type NoteRow = {
  project_id: string;
  source: "gmail";
  category: "email" | "change" | "action";
  body: string;
  mailbox: string;
  gmail_thread_id: string;
  message_key: string | null;
  needs_action: boolean;
  occurred_at: string;
};

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Turn one classified email on an existing project into trail notes + safe field fills. */
async function applyTrailUpdate(
  db: Db,
  project: MatchedProject,
  c: Classification,
  parsed: ParsedMessage,
): Promise<number> {
  const when = new Date(parsed.internalMs).toISOString();
  const base = {
    project_id: project.id,
    source: "gmail" as const,
    mailbox: parsed.mailbox,
    gmail_thread_id: parsed.threadId,
    occurred_at: when,
  };
  const rows: NoteRow[] = [];
  const patch: Record<string, unknown> = {};

  if (c.note) {
    rows.push({
      ...base,
      category: "email",
      body: c.note,
      message_key: parsed.messageKey,
      needs_action: false,
    });
  }

  if (c.changes.length > 0) {
    rows.push({
      ...base,
      category: "change",
      body: `Updated in this email: ${c.changes.join("; ")}`,
      message_key: null,
      needs_action: false,
    });
  }

  // Fill blanks automatically; never overwrite. A conflicting value becomes an action.
  if (c.event.date) {
    if (!project.project_date) patch.project_date = c.event.date;
    else if (project.project_date !== c.event.date) {
      rows.push({
        ...base,
        category: "change",
        body: `Event date mentioned as ${c.event.date}, but the project says ${project.project_date}. Confirm and update the project.`,
        message_key: null,
        needs_action: true,
      });
    }
  }
  if (c.event.location) {
    if (!project.location?.trim()) patch.location = c.event.location;
    else if (!sameText(project.location, c.event.location)) {
      rows.push({
        ...base,
        category: "change",
        body: `Location mentioned as "${c.event.location}", but the project says "${project.location}". Confirm and update the project.`,
        message_key: null,
        needs_action: true,
      });
    }
  }
  if (c.event.budget != null) {
    const current = Number(project.budget) || 0;
    if (!current) patch.budget = c.event.budget;
    else if (current !== c.event.budget) {
      rows.push({
        ...base,
        category: "change",
        body: `Budget mentioned as $${c.event.budget.toLocaleString("en-US")}, but the project says $${current.toLocaleString("en-US")}. Confirm and update the project.`,
        message_key: null,
        needs_action: true,
      });
    }
  }

  const conflictAdded = rows.some((r) => r.needs_action);
  if (
    c.needsAction &&
    c.action &&
    !isInboxChaseAction(c.action) &&
    !(conflictAdded && isRestatedConflict(c.action))
  ) {
    rows.push({
      ...base,
      category: "action",
      body: c.action,
      message_key: null,
      needs_action: true,
    });
  }

  // Never stack a to-do that is already open on this card (or repeated in this batch).
  const fresh = rows.some((r) => r.needs_action)
    ? dropRepeatedActions(rows, await loadOpenActions(db, project.id))
    : rows;
  rows.length = 0;
  rows.push(...fresh);

  if (rows.length === 0 && Object.keys(patch).length === 0) return 0;

  if (rows.length > 0) {
    const { error } = await db.from("honeybook_project_notes").insert(rows);
    // The unique message_key means another mailbox already logged this exact email.
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
  }
  if (Object.keys(patch).length > 0) {
    await db.from("honeybook_projects").update(patch).eq("id", project.id);
  }
  return rows.length;
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .replace(/[._+-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

/** Create the client (if new), an Inquiry-stage project, assign the receiving staffer, and log the first note. */
async function createInquiryCard(
  db: Db,
  staff: Staff,
  parsed: ParsedMessage,
  c: Classification,
  knownClientId: string | null,
): Promise<string> {
  // A marketplace relay address belongs to the platform, not the prospect.
  const viaRelay = isMarketplaceRelay(parsed.from);
  const fromAddress =
    !isInternalAddress(parsed.from) && parsed.direction === "inbound" ? parsed.from : "";
  const prospectEmail = (
    viaRelay
      ? c.client.email && !isMarketplaceRelay(c.client.email)
        ? c.client.email
        : fromAddress
      : fromAddress || c.client.email
  ).toLowerCase();

  // Relay leads always get their own client so unrelated prospects never merge.
  let clientId = viaRelay ? null : knownClientId;
  if (!clientId && prospectEmail && !viaRelay) {
    const { data: existing } = await db
      .from("honeybook_clients")
      .select("id")
      .ilike("email", prospectEmail)
      .limit(1)
      .maybeSingle();
    clientId = existing?.id ?? null;
  }

  const clientName =
    c.client.name ||
    (viaRelay
      ? `New lead (${marketplaceName(parsed.from) ?? "marketplace"})`
      : prospectEmail
        ? nameFromEmail(prospectEmail)
        : "New inquiry");

  if (!clientId) {
    const { data, error } = await db
      .from("honeybook_clients")
      .insert({
        full_name: clientName,
        email: prospectEmail,
        phone: c.client.phone,
        address: "",
        source_event: "gmail",
        raw: { source: "gmail", mailbox: parsed.mailbox },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    clientId = data.id as string;
  }

  const typeLabel = c.event.type || "Event";
  const { data: project, error: pErr } = await db
    .from("honeybook_projects")
    .insert({
      client_id: clientId,
      name: `${typeLabel} – ${clientName}`.slice(0, 200),
      stage: "Inquiry",
      project_type: c.event.type,
      project_date: c.event.date,
      budget: c.event.budget,
      location: c.event.location,
      details: c.note,
      source_event: "gmail",
      raw: { source: "gmail", mailbox: parsed.mailbox, thread_id: parsed.threadId },
    })
    .select("id")
    .single();
  if (pErr) throw new Error(pErr.message);
  const projectId = project.id as string;

  await db
    .from("honeybook_project_assignees")
    .insert({ project_id: projectId, profile_id: staff.id, role: "lead" });

  const base = {
    project_id: projectId,
    source: "gmail" as const,
    mailbox: parsed.mailbox,
    gmail_thread_id: parsed.threadId,
    occurred_at: new Date(parsed.internalMs).toISOString(),
  };
  const rows: NoteRow[] = [
    {
      ...base,
      category: "email",
      body: `New inquiry came in by email to ${staff.name}. ${c.note}`.trim(),
      message_key: parsed.messageKey,
      needs_action: false,
    },
    {
      ...base,
      category: "action",
      body: c.action || "Reply to this inquiry and send details.",
      message_key: null,
      needs_action: true,
    },
  ];
  await db.from("honeybook_project_notes").insert(rows);
  await mapThread(db, parsed, projectId);
  await flagPossibleDuplicate(db, {
    projectId,
    name: `${typeLabel} – ${clientName}`.slice(0, 200),
    clientId,
    date: c.event.date,
  });
  return projectId;
}

/**
 * A new email card may be the same event as one the Hub already has (a second thread from the
 * same client). Never merge automatically: drop a to-do on the new card pointing at the likely
 * twin so a person can review it with "Merge with…". Best-effort; never blocks the sync.
 */
async function flagPossibleDuplicate(
  db: Db,
  card: { projectId: string; name: string; clientId: string | null; date: string | null },
): Promise<void> {
  try {
    const filters = [card.clientId ? `client_id.eq.${card.clientId}` : null, card.date ? `project_date.eq.${card.date}` : null].filter(
      (f): f is string => Boolean(f),
    );
    if (filters.length === 0) return;
    const { data } = await db
      .from("honeybook_projects")
      .select("id, name, client_id, project_date, stage, merged_into")
      .or(filters.join(","))
      .neq("id", card.projectId)
      .limit(50);
    const hits = findSimilarProjects(
      {
        id: card.projectId,
        name: card.name,
        client_id: card.clientId,
        project_date: card.date,
      },
      (data ?? []).map((p) => ({
        id: String(p.id),
        name: String(p.name ?? ""),
        client_id: (p.client_id as string | null) ?? null,
        project_date: (p.project_date as string | null) ?? null,
        stage: String(p.stage ?? ""),
        merged_into: (p.merged_into as string | null) ?? null,
      })),
    );
    if (hits.length === 0) return;
    const twin = (data ?? []).find((p) => String(p.id) === hits[0].id);
    await db.from("honeybook_project_notes").insert({
      project_id: card.projectId,
      source: "system",
      category: "action",
      body: `Possible duplicate of "${String(twin?.name ?? "another card")}". If it is the same event, open one of the two cards and use Merge with… to combine them.`,
      needs_action: true,
      occurred_at: new Date().toISOString(),
    });
  } catch {
    // Duplicate hints are a nicety; the inquiry card is already saved.
  }
}

type Counters = Pick<GmailSyncSummary, "examined" | "inquiries" | "notes" | "ignored">;

async function processMessage(
  db: Db,
  staff: Staff,
  parsed: ParsedMessage,
  counters: Counters,
): Promise<void> {
  const { data: seen } = await db
    .from("honeybook_gmail_messages")
    .select("message_key")
    .eq("message_key", parsed.messageKey)
    .maybeSingle();
  if (seen) return;

  counters.examined += 1;

  if (isAutomatedMessage(parsed.headers, parsed.from)) {
    await recordLedger(db, parsed, "ignored", null);
    counters.ignored += 1;
    return;
  }

  const participants = externalParticipants({
    from: parsed.from,
    to: parsed.to,
    cc: parsed.cc,
  });
  const { project, clientId } = await findProjectForMessage(db, parsed, participants);

  // Staff-to-staff mail is only read when it sits on an already-linked project thread.
  if (!project && participants.length === 0) {
    await recordLedger(db, parsed, "ignored", null);
    counters.ignored += 1;
    return;
  }

  if (project) {
    const context = await loadProjectContext(db, project);
    const { result, error } = await classifyMessage({
      message: parsed,
      staffName: staff.name,
      project: context,
    });
    if (!result) {
      await recordLedger(db, parsed, "error", project.id);
      throw new Error(error ?? "Classification failed.");
    }
    const written = await applyTrailUpdate(db, project, result, parsed);
    await mapThread(db, parsed, project.id);
    await recordLedger(db, parsed, written > 0 ? "note" : "no_change", project.id);
    counters.notes += written;
    return;
  }

  // No project yet: only inbound mail from outside can start a new inquiry card.
  if (parsed.direction !== "inbound") {
    await recordLedger(db, parsed, "ignored", null);
    counters.ignored += 1;
    return;
  }

  if (await isMarkedNotLead(db, parsed)) {
    await recordLedger(db, parsed, "ignored", null);
    counters.ignored += 1;
    return;
  }

  const { result, error } = await classifyMessage({
    message: parsed,
    staffName: staff.name,
    project: null,
    notLeadExamples: await loadNotLeadExamples(db),
  });
  if (!result) {
    await recordLedger(db, parsed, "error", null);
    throw new Error(error ?? "Classification failed.");
  }
  if (!result.isEventInquiry || result.confidence < MIN_INQUIRY_CONFIDENCE) {
    // Not an inquiry: keep only the ledger row, never the content.
    await recordLedger(db, parsed, "ignored", null);
    counters.ignored += 1;
    return;
  }

  const projectId = await createInquiryCard(db, staff, parsed, result, clientId);
  await recordLedger(db, parsed, "inquiry", projectId);
  counters.inquiries += 1;
}

async function syncMailbox(
  db: Db,
  staff: Staff,
  deadline: number,
  counters: Counters,
): Promise<void> {
  const { data: state } = await db
    .from("honeybook_gmail_sync_state")
    .select("last_internal_ms")
    .eq("mailbox", staff.mailbox)
    .maybeSingle();

  const previous = Number(state?.last_internal_ms ?? 0);
  const sinceMs = previous > 0 ? previous - OVERLAP_MS : Date.now() - lookbackMs();
  const gmail = getGmailForMailbox(staff.mailbox);

  const list = await gmail.users.messages.list({
    userId: "me",
    q: `after:${Math.floor(sinceMs / 1000)} -in:spam -in:trash -in:drafts -in:chats -category:promotions -category:social -category:forums`,
    maxResults: 100,
  });
  // Gmail returns newest first; work oldest first so the watermark only moves forward.
  const ids = (list.data.messages ?? []).map((m) => m.id).filter((x): x is string => Boolean(x));
  ids.reverse();

  let newestDone = previous;
  let processed = 0;
  let truncated = false;

  for (const id of ids) {
    if (processed >= MAX_MESSAGES_PER_MAILBOX || Date.now() > deadline) {
      truncated = true;
      break;
    }
    const full = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    const parsed = parseGmailMessage(full.data, staff.mailbox);
    if (parsed) {
      await processMessage(db, staff, parsed, counters);
      newestDone = Math.max(newestDone, parsed.internalMs);
    }
    processed += 1;
  }

  const nextMark = truncated ? newestDone : Math.max(newestDone, Date.now() - OVERLAP_MS);
  await db.from("honeybook_gmail_sync_state").upsert(
    {
      mailbox: staff.mailbox,
      last_internal_ms: nextMark,
      last_run_at: new Date().toISOString(),
      last_error: "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "mailbox" },
  );
}

async function recordMailboxError(db: Db, mailbox: string, message: string) {
  await db.from("honeybook_gmail_sync_state").upsert(
    {
      mailbox,
      last_run_at: new Date().toISOString(),
      last_error: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "mailbox" },
  );
}

function emptySummary(skippedReason: string | null): GmailSyncSummary {
  return {
    ran: false,
    skippedReason,
    mailboxes: 0,
    examined: 0,
    inquiries: 0,
    notes: 0,
    ignored: 0,
    errors: [],
  };
}

/** Read new mail in every staff mailbox, create inquiry cards, and extend each project's trail. */
export async function runHoneyBookGmailSync(): Promise<GmailSyncSummary> {
  if (!isGmailSyncEnabled()) {
    return emptySummary("HONEYBOOK_GMAIL_ENABLED is not set to true.");
  }
  if (!isServiceRoleConfigured()) {
    return emptySummary("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  if (!isGmailServiceAccountConfigured()) {
    return emptySummary("Google service account is not configured.");
  }
  if (!isAiConfigured()) {
    return emptySummary("OPENAI_API_KEY is not configured.");
  }

  const db = createServiceClient();
  const staff = await loadMailboxes(db);
  const summary = emptySummary(null);
  summary.ran = true;
  summary.mailboxes = staff.length;

  const counters: Counters = { examined: 0, inquiries: 0, notes: 0, ignored: 0 };
  const deadline = Date.now() + TIME_BUDGET_MS;

  for (const person of staff) {
    if (Date.now() > deadline) break;
    try {
      await syncMailbox(db, person, deadline, counters);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Mailbox sync failed.";
      summary.errors.push(`${person.mailbox}: ${message}`);
      await recordMailboxError(db, person.mailbox, message);
    }
  }

  summary.examined = counters.examined;
  summary.inquiries = counters.inquiries;
  summary.notes = counters.notes;
  summary.ignored = counters.ignored;
  return summary;
}
