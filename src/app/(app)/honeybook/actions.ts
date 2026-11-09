"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import {
  canAccessHoneyBook,
  canAssignHoneyBookFreely,
  canEditHoneyBookProject,
  canManageHoneyBookCrm,
} from "@/lib/honeybook/access";
import { ingestHoneyBookPayload } from "@/lib/honeybook/ingest";
import { normalizeHoneyBookStage } from "@/lib/honeybook/pipeline-board";
import {
  newProjectShareToken,
} from "@/lib/honeybook/public-project";
import { notifyAdmins } from "@/lib/notifications/notify";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Result = { error: string | null; imported?: number };
type ShareResult = Result & { token?: string; path?: string };

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, error: "Sign in first." as const };
  if (profile.role !== "admin") {
    return { profile: null, error: "Admins only." as const };
  }
  return { profile, error: null as string | null };
}

async function requireHoneyBookAccess() {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, error: "Sign in first." as const };
  if (!canAccessHoneyBook(profile.role)) {
    return {
      profile: null,
      error: "Only admins, Leads, and staff can open HoneyBook." as const,
    };
  }
  return { profile, error: null as string | null };
}

async function requireHoneyBookManager() {
  const { profile, error } = await requireHoneyBookAccess();
  if (error || !profile) return { profile: null, error: error ?? "Sign in first." };
  if (!canManageHoneyBookCrm(profile.role)) {
    return {
      profile: null,
      error: "Only admins and Leads can do that.",
    };
  }
  return { profile, error: null as string | null };
}

async function requireHoneyBookAssigner() {
  const { profile, error } = await requireHoneyBookAccess();
  if (error || !profile) return { profile: null, error: error ?? "Sign in first." };
  if (!canAssignHoneyBookFreely(profile.role)) {
    return {
      profile: null,
      error: "Only admins can assign staff. Ask an admin, or request an add if you’re on the project.",
    };
  }
  return { profile, error: null as string | null };
}

async function loadAssigneeIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("honeybook_project_assignees")
    .select("profile_id")
    .eq("project_id", projectId);
  return (data ?? []).map((r) => r.profile_id as string);
}

async function assertCanEditProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: { id: string; role: string },
  projectId: string,
): Promise<string | null> {
  const ids = await loadAssigneeIds(supabase, projectId);
  if (!canEditHoneyBookProject(profile.role, ids, profile.id)) {
    return "You can only edit projects you’re assigned to.";
  }
  return null;
}

function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  const semis = (headerLine.match(/;/g) ?? []).length;
  if (tabs > commas && tabs >= semis) return "\t";
  if (semis > commas) return ";";
  return ",";
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);

  function splitRow(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }

  const headers = splitRow(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ");
}

/** Case/spacing-insensitive column lookup. */
function col(row: Record<string, string>, ...aliases: string[]): string {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) {
    map.set(normKey(k), v);
  }
  for (const a of aliases) {
    const v = map.get(normKey(a));
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

/**
 * HoneyBook "Client Info" is usually: "First Last email@x.com"
 * or several contacts joined with commas. Occasionally includes a phone.
 */
function parseClientInfo(raw: string): {
  fullName: string;
  email: string;
  phone: string;
} {
  const text = raw.trim();
  if (!text) return { fullName: "", email: "", phone: "" };

  const phoneMatch = text.match(
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  );
  const phone = phoneMatch?.[0]?.trim() ?? "";

  // Prefer the first segment that has an email.
  const segments = text.split(",").map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const m = seg.match(/^(.+?)\s+(\S+@\S+)$/);
    if (m) {
      return {
        fullName: m[1].replace(phone, "").trim(),
        email: m[2].trim().toLowerCase(),
        phone,
      };
    }
  }

  // Email only
  const emailOnly = text.match(/^(\S+@\S+)$/);
  if (emailOnly) {
    return { fullName: "", email: emailOnly[1].toLowerCase(), phone };
  }

  // Name only
  return {
    fullName: text.replace(phone, "").trim() || text,
    email: "",
    phone,
  };
}

function mapHoneyBookReportRow(row: Record<string, string>): Record<string, unknown> {
  const projectName = col(
    row,
    "Project Name",
    "project_name",
    "Project",
    "Name",
  );
  const bookedYn = col(row, "Booked (yes/no)", "Booked", "Is Booked");
  const stageFromReport = col(
    row,
    "Project Stage",
    "Stage",
    "Status",
    "project_stage",
  );
  const stage =
    normalizeHoneyBookStage(stageFromReport) ||
    (/^yes$/i.test(bookedYn)
      ? "Retainer Paid"
      : /^no$/i.test(bookedYn)
        ? "Lost"
        : "");

  const clientFromCols = {
    fullName: col(
      row,
      "Client Full Name",
      "Client Name",
      "Full Name",
      "client_full_name",
    ),
    email: col(row, "Client Email", "Email", "client_email"),
    phone: col(
      row,
      "Client Phone",
      "Phone",
      "client_phone",
      "Mobile",
      "Mobile Phone",
      "Cell",
      "Cell Phone",
    ),
  };
  const fromInfo = parseClientInfo(col(row, "Client Info", "Client"));
  const fullName = clientFromCols.fullName || fromInfo.fullName;
  const email = clientFromCols.email || fromInfo.email;
  const phone = clientFromCols.phone || fromInfo.phone;

  const budget = col(
    row,
    "Total Project Value",
    "Project Budget",
    "Budget",
    "project_budget",
  );
  const bookedAt = col(row, "Booked Date", "booked_at", "Booked At");
  const projectDate = col(
    row,
    "Project Date",
    "Event Date",
    "Date",
    "project_date",
  );
  const projectType = col(row, "Project Type", "Type", "project_type");
  const location = col(
    row,
    "Project Location",
    "Location",
    "project_location",
  );
  const leadSource = col(row, "Lead Source");
  const details = [leadSource ? `Lead source: ${leadSource}` : ""]
    .filter(Boolean)
    .join("\n");

  return {
    event: "project.upsert",
    project_name: projectName,
    project_stage: stage,
    project_type: projectType,
    project_date: projectDate,
    project_budget: budget,
    project_location: location,
    project_details: details,
    booked_at: bookedAt || undefined,
    client_full_name: fullName,
    client_email: email,
    client_phone: phone,
    project_external_id: col(
      row,
      "Project ID",
      "project_id",
      "project_external_id",
      "External ID",
    ),
    client_external_id: col(
      row,
      "Client ID",
      "client_id",
      "client_external_id",
    ),
  };
}

/**
 * One-time / catch-up import from a HoneyBook (or spreadsheet) CSV export.
 * Understands HoneyBook's Project report columns (Client Info, Booked yes/no,
 * Total Project Value, etc.) as well as simpler Hub-friendly headers.
 */
export async function importHoneyBookCsvAction(
  csvText: string,
): Promise<Result> {
  const { error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };
  if (!isServiceRoleConfigured()) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY is required for imports (same as webhooks).",
    };
  }

  const { headers, rows } = parseCsv(csvText);
  if (rows.length === 0) {
    return { error: "CSV needs a header row and at least one data row." };
  }

  let imported = 0;
  let ignored = 0;
  const errors: string[] = [];
  const ignoreReasons: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const payload = mapHoneyBookReportRow(rows[i]);
    if (!payload.project_name && !payload.client_full_name && !payload.client_email) {
      ignored += 1;
      if (ignoreReasons.length < 3) {
        ignoreReasons.push(`Row ${i + 2}: no project name or client.`);
      }
      continue;
    }

    const result = await ingestHoneyBookPayload(payload, {
      idempotencyKey: `csv:${i}:${payload.project_external_id || ""}:${payload.client_email || ""}:${payload.project_name || ""}`,
    });
    if (result.ok && result.status === "ok") imported += 1;
    else if (!result.ok) errors.push(`Row ${i + 2}: ${result.message}`);
    else {
      ignored += 1;
      if (ignoreReasons.length < 3) {
        ignoreReasons.push(`Row ${i + 2}: ${result.message}`);
      }
    }
  }

  revalidatePath("/honeybook");
  revalidatePath("/reports");

  if (imported === 0) {
    const headerHint = headers.length
      ? ` Headers found: ${headers.slice(0, 8).join(", ")}${headers.length > 8 ? "…" : ""}.`
      : "";
    if (errors.length > 0) {
      return { error: errors.slice(0, 3).join(" ") + headerHint, imported: 0 };
    }
    return {
      error:
        `Imported 0 of ${rows.length} row(s) (${ignored} skipped).` +
        (ignoreReasons.length ? ` ${ignoreReasons.join(" ")}` : "") +
        headerHint +
        " Tip: use HoneyBook’s Projects report CSV, or include a Project Name column.",
      imported: 0,
    };
  }

  return {
    error: errors.length
      ? `Imported ${imported}. Some rows failed: ${errors.slice(0, 2).join(" ")}`
      : null,
    imported,
  };
}

export async function createHoneyBookClientAction(input: {
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<Result & { id?: string }> {
  const { profile, error: authErr } = await requireHoneyBookManager();
  if (authErr || !profile) return { error: authErr ?? "Sign in first." };

  const fullName = input.fullName?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  const phone = input.phone?.trim() ?? "";
  const address = input.address?.trim() ?? "";
  if (!fullName && !email) {
    return { error: "Add a name or email." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("honeybook_clients")
    .insert({
      full_name: fullName,
      email,
      phone,
      address,
      source_event: "hub",
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      return { error: "A client with that email already exists." };
    }
    if (/row-level security|policy/i.test(error.message)) {
      return {
        error:
          "Couldn’t save — run migration 160_honeybook_hub_create.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }
  revalidatePath("/honeybook");
  return { error: null, id: data?.id as string | undefined };
}

export async function createHoneyBookProjectAction(input: {
  name: string;
  stage?: string;
  clientId?: string | null;
  projectType?: string;
  projectDate?: string | null;
  location?: string;
  details?: string;
  budget?: string | null;
}): Promise<Result & { id?: string }> {
  const { profile, error: authErr } = await requireHoneyBookManager();
  if (authErr || !profile) return { error: authErr ?? "Sign in first." };

  const name = input.name?.trim() ?? "";
  if (!name) return { error: "Project name is required." };
  const stage = (input.stage?.trim() || "Inquiry").slice(0, 120);
  const projectType = input.projectType?.trim() ?? "";
  const location = input.location?.trim() ?? "";
  const details = input.details?.trim() ?? "";
  const projectDate =
    input.projectDate && /^\d{4}-\d{2}-\d{2}$/.test(input.projectDate)
      ? input.projectDate
      : null;
  const budgetRaw = input.budget?.trim() ?? "";
  const budget =
    budgetRaw === "" ? null : Number.parseFloat(budgetRaw.replace(/[$,]/g, ""));
  if (budget != null && !Number.isFinite(budget)) {
    return { error: "Budget must be a number." };
  }
  const clientId = input.clientId?.trim() || null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("honeybook_projects")
    .insert({
      name,
      stage,
      client_id: clientId,
      project_type: projectType,
      project_date: projectDate,
      location,
      details,
      budget,
      source_event: "hub",
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (/row-level security|policy/i.test(error.message)) {
      return {
        error:
          "Couldn’t save — run migration 160_honeybook_hub_create.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }

  const projectId = data?.id as string | undefined;
  if (projectId) {
    await supabase.from("honeybook_project_stage_events").insert({
      project_id: projectId,
      from_stage: "",
      to_stage: stage,
      changed_by: profile.id,
    });
  }

  revalidatePath("/honeybook");
  revalidatePath("/reports");
  return { error: null, id: projectId };
}

export async function updateProjectStageAction(input: {
  id: string;
  stage: string;
}): Promise<Result> {
  const { profile, error: authErr } = await requireHoneyBookAccess();
  if (authErr || !profile) return { error: authErr ?? "Sign in first." };
  const stage = input.stage?.trim().slice(0, 120) ?? "";
  if (!input.id) return { error: "Missing project." };
  if (!stage) return { error: "Pick a stage." };

  const supabase = await createClient();
  const editErr = await assertCanEditProject(supabase, profile, input.id);
  if (editErr) return { error: editErr };

  const { data: existing, error: loadErr } = await supabase
    .from("honeybook_projects")
    .select("id, stage")
    .eq("id", input.id)
    .maybeSingle();
  if (loadErr) return { error: loadErr.message };
  if (!existing) return { error: "Project not found." };

  const fromStage = String(existing.stage ?? "");
  if (fromStage === stage) return { error: null };

  const { error } = await supabase
    .from("honeybook_projects")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) {
    if (/row-level security|policy/i.test(error.message)) {
      return {
        error:
          "Couldn’t save — run migration 159_honeybook_lead_access.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }

  const { error: histErr } = await supabase
    .from("honeybook_project_stage_events")
    .insert({
      project_id: input.id,
      from_stage: fromStage,
      to_stage: stage,
      changed_by: profile.id,
    });
  if (histErr && !/does not exist|schema cache/i.test(histErr.message)) {
    // Non-fatal if mig 160 not applied yet — stage still saved.
  }

  revalidatePath("/honeybook");
  revalidatePath("/reports");
  return { error: null };
}

export async function updateHoneyBookClientAction(input: {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<Result> {
  const { error: authErr } = await requireHoneyBookManager();
  if (authErr) return { error: authErr };
  if (!input.id) return { error: "Missing client." };

  const fullName = input.fullName?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  const phone = input.phone?.trim() ?? "";
  const address = input.address?.trim() ?? "";
  if (!fullName && !email) {
    return { error: "Add a name or email." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("honeybook_clients")
    .update({
      full_name: fullName,
      email,
      phone,
      address,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      return { error: "A client with that email already exists." };
    }
    if (/row-level security|policy/i.test(error.message)) {
      return {
        error:
          "Couldn’t save — run migration 161_honeybook_lead_edit_delete.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }
  revalidatePath("/honeybook");
  return { error: null };
}

export async function updateHoneyBookProjectAction(input: {
  id: string;
  name: string;
  stage?: string;
  clientId?: string | null;
  projectType?: string;
  projectDate?: string | null;
  location?: string;
  details?: string;
  budget?: string | null;
}): Promise<Result> {
  const { profile, error: authErr } = await requireHoneyBookAccess();
  if (authErr || !profile) return { error: authErr ?? "Sign in first." };
  if (!input.id) return { error: "Missing project." };

  const name = input.name?.trim() ?? "";
  if (!name) return { error: "Project name is required." };
  const stage = (input.stage?.trim() || "Inquiry").slice(0, 120);
  const projectType = input.projectType?.trim() ?? "";
  const location = input.location?.trim() ?? "";
  const details = input.details?.trim() ?? "";
  const projectDate =
    input.projectDate && /^\d{4}-\d{2}-\d{2}$/.test(input.projectDate)
      ? input.projectDate
      : null;
  const budgetRaw = input.budget?.trim() ?? "";
  const budget =
    budgetRaw === "" ? null : Number.parseFloat(budgetRaw.replace(/[$,]/g, ""));
  if (budget != null && !Number.isFinite(budget)) {
    return { error: "Budget must be a number." };
  }
  const clientId = input.clientId?.trim() || null;

  const supabase = await createClient();
  const editErr = await assertCanEditProject(supabase, profile, input.id);
  if (editErr) return { error: editErr };

  const { data: existing, error: loadErr } = await supabase
    .from("honeybook_projects")
    .select("id, stage")
    .eq("id", input.id)
    .maybeSingle();
  if (loadErr) return { error: loadErr.message };
  if (!existing) return { error: "Project not found." };

  const fromStage = String(existing.stage ?? "");
  const { error } = await supabase
    .from("honeybook_projects")
    .update({
      name,
      stage,
      client_id: clientId,
      project_type: projectType,
      project_date: projectDate,
      location,
      details,
      budget,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) {
    if (/row-level security|policy/i.test(error.message)) {
      return {
        error:
          "Couldn’t save — run migration 161_honeybook_lead_edit_delete.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }

  if (fromStage !== stage) {
    await supabase.from("honeybook_project_stage_events").insert({
      project_id: input.id,
      from_stage: fromStage,
      to_stage: stage,
      changed_by: profile.id,
    });
  }

  revalidatePath("/honeybook");
  revalidatePath("/reports");
  return { error: null };
}

export async function deleteHoneyBookProjectAction(input: {
  id: string;
}): Promise<Result> {
  const { error: authErr } = await requireHoneyBookManager();
  if (authErr) return { error: authErr };
  if (!input.id) return { error: "Missing project." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("honeybook_projects")
    .delete()
    .eq("id", input.id);
  if (error) {
    if (/row-level security|policy/i.test(error.message)) {
      return {
        error:
          "Couldn’t delete — run migration 161_honeybook_lead_edit_delete.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }
  revalidatePath("/honeybook");
  revalidatePath("/reports");
  return { error: null };
}

export async function deleteHoneyBookClientAction(input: {
  id: string;
}): Promise<Result> {
  const { error: authErr } = await requireHoneyBookManager();
  if (authErr) return { error: authErr };
  if (!input.id) return { error: "Missing client." };
  const supabase = await createClient();
  // Detach projects/payments first (FK is ON DELETE SET NULL, but clear
  // explicitly so the UI doesn't keep stale client names until refresh).
  await supabase
    .from("honeybook_projects")
    .update({ client_id: null, updated_at: new Date().toISOString() })
    .eq("client_id", input.id);
  await supabase
    .from("honeybook_payments")
    .update({ client_id: null, updated_at: new Date().toISOString() })
    .eq("client_id", input.id);
  const { error } = await supabase
    .from("honeybook_clients")
    .delete()
    .eq("id", input.id);
  if (error) {
    if (/row-level security|policy/i.test(error.message)) {
      return {
        error:
          "Couldn’t delete — run migration 161_honeybook_lead_edit_delete.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }
  revalidatePath("/honeybook");
  revalidatePath("/reports");
  return { error: null };
}

/** Enable (or reuse) the public CRM project share link. */
export async function enableProjectShareAction(input: {
  id: string;
}): Promise<ShareResult> {
  const { profile, error: authErr } = await requireHoneyBookAccess();
  if (authErr || !profile) return { error: authErr ?? "Sign in first." };
  if (!input.id) return { error: "Missing project." };

  const supabase = await createClient();
  const editErr = await assertCanEditProject(supabase, profile, input.id);
  if (editErr) return { error: editErr };

  const { data: existing, error: loadErr } = await supabase
    .from("honeybook_projects")
    .select("id, share_token")
    .eq("id", input.id)
    .maybeSingle();
  if (loadErr) {
    if (/share_token|column/i.test(loadErr.message)) {
      return {
        error:
          "Couldn’t share — run migration 162_honeybook_project_share.sql in Supabase, then try again.",
      };
    }
    return { error: loadErr.message };
  }
  if (!existing) return { error: "Project not found." };

  const token =
    (existing.share_token as string | null) || newProjectShareToken();

  const { error } = await supabase
    .from("honeybook_projects")
    .update({
      share_token: token,
      share_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) {
    if (/share_token|column|row-level security|policy/i.test(error.message)) {
      return {
        error:
          "Couldn’t share — run migration 162_honeybook_project_share.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/honeybook");
  revalidatePath(`/project/${token}`);
  return { error: null, token, path: `/project/${token}` };
}

export async function revokeProjectShareAction(input: {
  id: string;
}): Promise<Result> {
  const { profile, error: authErr } = await requireHoneyBookAccess();
  if (authErr || !profile) return { error: authErr ?? "Sign in first." };
  if (!input.id) return { error: "Missing project." };

  const supabase = await createClient();
  const editErr = await assertCanEditProject(supabase, profile, input.id);
  if (editErr) return { error: editErr };

  const { error } = await supabase
    .from("honeybook_projects")
    .update({
      share_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) {
    if (/share_enabled|column|row-level security|policy/i.test(error.message)) {
      return {
        error:
          "Couldn’t stop sharing — run migration 162_honeybook_project_share.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/honeybook");
  return { error: null };
}


/** Admin: replace the assignee set (one optional lead + support staff). */
export async function setProjectAssigneesAction(input: {
  projectId: string;
  /** @deprecated Prefer `assignees` with roles. */
  profileIds?: string[];
  assignees?: { profileId: string; role: "lead" | "support" }[];
}): Promise<Result> {
  const { profile, error: authErr } = await requireHoneyBookAssigner();
  if (authErr || !profile) return { error: authErr ?? "Sign in first." };
  const projectId = input.projectId?.trim() ?? "";
  if (!projectId) return { error: "Missing project." };

  let rows: { profile_id: string; role: "lead" | "support" }[] = [];
  if (input.assignees?.length) {
    const byId = new Map<string, "lead" | "support">();
    for (const a of input.assignees) {
      const id = a.profileId?.trim();
      if (!id) continue;
      const role = a.role === "lead" ? "lead" : "support";
      // Lead wins if duplicated.
      if (role === "lead" || !byId.has(id)) byId.set(id, role);
    }
    let leadCount = 0;
    for (const [profile_id, role] of byId) {
      if (role === "lead") {
        leadCount += 1;
        if (leadCount > 1) {
          return { error: "Pick only one project lead." };
        }
      }
      rows.push({ profile_id, role });
    }
  } else {
    const profileIds = Array.from(
      new Set((input.profileIds ?? []).map((id) => id.trim()).filter(Boolean)),
    );
    rows = profileIds.map((profile_id, i) => ({
      profile_id,
      role: i === 0 ? ("lead" as const) : ("support" as const),
    }));
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("honeybook_projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const { error: delErr } = await supabase
    .from("honeybook_project_assignees")
    .delete()
    .eq("project_id", projectId);
  if (delErr) {
    if (/does not exist|schema cache|honeybook_project_assignees/i.test(delErr.message)) {
      return {
        error:
          "Couldn’t assign — run migration 163_honeybook_project_assignees.sql (and 166 for lead/support) in Supabase, then try again.",
      };
    }
    return { error: delErr.message };
  }

  if (rows.length) {
    const { error: insErr } = await supabase
      .from("honeybook_project_assignees")
      .insert(
        rows.map((r) => ({
          project_id: projectId,
          profile_id: r.profile_id,
          role: r.role,
          assigned_by: profile.id,
        })),
      );
    if (insErr) {
      if (/role|column|166/i.test(insErr.message)) {
        return {
          error:
            "Couldn’t save lead/support — run migration 166_honeybook_assignee_roles.sql in Supabase.",
        };
      }
      return { error: insErr.message };
    }
  }

  revalidatePath("/honeybook");
  revalidatePath(`/honeybook/projects/${projectId}`);
  return { error: null };
}

/**
 * Staff: request adding/removing someone else on a project.
 * Admin approval required. Self remove is applied immediately when already assigned.
 */
export async function requestProjectAssignmentAction(input: {
  projectId: string;
  targetProfileId: string;
  action: "add" | "remove";
  note?: string;
}): Promise<Result & { pendingApproval?: boolean }> {
  const { profile, error: authErr } = await requireHoneyBookAccess();
  if (authErr || !profile) return { error: authErr ?? "Sign in first." };
  if (canAssignHoneyBookFreely(profile.role)) {
    return {
      error: "Admins can assign directly — use the assignee controls on the card.",
    };
  }

  const projectId = input.projectId?.trim() ?? "";
  const targetProfileId = input.targetProfileId?.trim() ?? "";
  const action = input.action === "remove" ? "remove" : "add";
  if (!projectId || !targetProfileId) return { error: "Missing project or person." };

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("honeybook_projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const assigneeIds = await loadAssigneeIds(supabase, projectId);

  // Staff may remove themselves immediately
  if (action === "remove" && targetProfileId === profile.id) {
    if (!assigneeIds.includes(profile.id)) {
      return { error: "You’re not assigned to this project." };
    }
    const { error } = await supabase
      .from("honeybook_project_assignees")
      .delete()
      .eq("project_id", projectId)
      .eq("profile_id", profile.id);
    if (error) return { error: error.message };
    revalidatePath("/honeybook");
    return { error: null };
  }

  // Nominating someone else (or self-add) → admin approval
  if (action === "add" && assigneeIds.includes(targetProfileId)) {
    return { error: "That person is already assigned." };
  }
  if (action === "remove" && !assigneeIds.includes(targetProfileId)) {
    return { error: "That person isn’t assigned." };
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", targetProfileId)
    .maybeSingle();
  if (!target) return { error: "Person not found." };

  const { error: insErr } = await supabase
    .from("honeybook_assignment_requests")
    .insert({
      project_id: projectId,
      requester_id: profile.id,
      target_profile_id: targetProfileId,
      action,
      status: "pending",
      note: (input.note ?? "").trim().slice(0, 500),
    });
  if (insErr) {
    if (/unique|duplicate/i.test(insErr.message)) {
      return { error: "There’s already a pending request for that person." };
    }
    if (/does not exist|schema cache|honeybook_assignment_requests/i.test(insErr.message)) {
      return {
        error:
          "Couldn’t request — run migration 163_honeybook_project_assignees.sql in Supabase, then try again.",
      };
    }
    return { error: insErr.message };
  }

  const requesterName = profile.full_name?.trim() || "Someone";
  const targetName = (target.full_name as string)?.trim() || "a teammate";
  const verb = action === "add" ? "add" : "remove";
  await notifyAdmins(supabase, {
    kind: "honeybook_assign",
    title: "HoneyBook assignment needs approval",
    body: `${requesterName} wants to ${verb} ${targetName} on “${project.name}”.`,
    href: "/honeybook?tab=projects&assign=pending",
  });

  revalidatePath("/honeybook");
  revalidatePath("/for-you");
  revalidatePath("/", "layout");
  return { error: null, pendingApproval: true };
}

export async function reviewAssignmentRequestAction(input: {
  requestId: string;
  decision: "approved" | "denied";
}): Promise<Result> {
  const { profile, error: authErr } = await requireAdmin();
  if (authErr || !profile) return { error: authErr ?? "Sign in first." };
  const requestId = input.requestId?.trim() ?? "";
  if (!requestId) return { error: "Missing request." };
  const decision = input.decision === "denied" ? "denied" : "approved";

  const supabase = await createClient();
  const { data: req, error: loadErr } = await supabase
    .from("honeybook_assignment_requests")
    .select(
      "id, project_id, requester_id, target_profile_id, action, status",
    )
    .eq("id", requestId)
    .maybeSingle();
  if (loadErr) return { error: loadErr.message };
  if (!req) return { error: "Request not found." };
  if (req.status !== "pending") return { error: "Already reviewed." };

  if (decision === "approved") {
    if (req.action === "add") {
      const { error } = await supabase.from("honeybook_project_assignees").upsert(
        {
          project_id: req.project_id,
          profile_id: req.target_profile_id,
          role: "support",
          assigned_by: profile.id,
        },
        { onConflict: "project_id,profile_id" },
      );
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase
        .from("honeybook_project_assignees")
        .delete()
        .eq("project_id", req.project_id)
        .eq("profile_id", req.target_profile_id);
      if (error) return { error: error.message };
    }
  }

  const { error: updErr } = await supabase
    .from("honeybook_assignment_requests")
    .update({
      status: decision,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (updErr) return { error: updErr.message };

  // Notify requester
  await supabase.from("hub_notifications").insert({
    user_id: req.requester_id,
    kind: "honeybook_assign",
    title:
      decision === "approved"
        ? "Assignment request approved"
        : "Assignment request denied",
    body:
      decision === "approved"
        ? "An admin approved your HoneyBook assignment request."
        : "An admin denied your HoneyBook assignment request.",
    href: "/honeybook?tab=projects",
  });

  revalidatePath("/honeybook");
  revalidatePath("/for-you");
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return { error: null };
}


export async function getProjectFileDownloadUrlAction(input: {
  fileId: string;
}): Promise<Result & { url?: string }> {
  const { error: authErr } = await requireHoneyBookAccess();
  if (authErr) return { error: authErr };
  if (!input.fileId) return { error: "Missing file." };

  const supabase = await createClient();
  const { data: file, error } = await supabase
    .from("honeybook_project_files")
    .select("id, storage_path, file_name")
    .eq("id", input.fileId)
    .maybeSingle();
  if (error) {
    if (/does not exist|schema cache|honeybook_project_files/i.test(error.message)) {
      return {
        error:
          "Couldn’t open file — run migration 164_honeybook_project_files.sql in Supabase.",
      };
    }
    return { error: error.message };
  }
  if (!file) return { error: "File not found." };

  // Prefer service role for signed URL so staff without storage policies can download.
  const { createServiceClient, isServiceRoleConfigured } = await import(
    "@/lib/supabase/admin"
  );
  if (!isServiceRoleConfigured()) return { error: "Downloads aren’t configured." };
  const admin = createServiceClient();
  const { data: signed, error: signErr } = await admin.storage
    .from("honeybook-project-files")
    .createSignedUrl(file.storage_path as string, 60 * 60);
  if (signErr || !signed?.signedUrl) {
    return { error: signErr?.message ?? "Could not create download link." };
  }
  return { error: null, url: signed.signedUrl };
}

export async function deleteProjectFileAction(input: {
  fileId: string;
}): Promise<Result> {
  const { profile, error: authErr } = await requireHoneyBookAccess();
  if (authErr || !profile) return { error: authErr ?? "Sign in first." };
  if (!input.fileId) return { error: "Missing file." };

  const supabase = await createClient();
  const { data: file, error } = await supabase
    .from("honeybook_project_files")
    .select("id, project_id, storage_path")
    .eq("id", input.fileId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!file) return { error: "File not found." };

  const editErr = await assertCanEditProject(
    supabase,
    profile,
    file.project_id as string,
  );
  if (editErr && !canAssignHoneyBookFreely(profile.role)) {
    return { error: editErr };
  }

  const { createServiceClient, isServiceRoleConfigured } = await import(
    "@/lib/supabase/admin"
  );
  if (isServiceRoleConfigured()) {
    const admin = createServiceClient();
    await admin.storage
      .from("honeybook-project-files")
      .remove([file.storage_path as string]);
  }

  const { error: delErr } = await supabase
    .from("honeybook_project_files")
    .delete()
    .eq("id", file.id);
  if (delErr) return { error: delErr.message };
  revalidatePath("/honeybook");
  return { error: null };
}

const MERGEABLE_FIELDS = new Set([
  "name",
  "project_type",
  "project_date",
  "budget",
  "location",
  "details",
  "client_id",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Merge two cards that are the same event. `keepId` survives; `mergeId` is archived and its
 * notes, files, payments, tasks, Gmail threads and staff move onto the kept card. `fields` are
 * the columns to copy from the merged card onto the kept one (everything else keeps the kept
 * card's value). Admins and Leads only.
 */
export async function mergeHoneyBookProjectsAction(input: {
  keepId: string;
  mergeId: string;
  fields?: string[];
}): Promise<Result & { keptId?: string }> {
  const { error: authErr } = await requireHoneyBookManager();
  if (authErr) return { error: authErr };
  if (!UUID_RE.test(input.keepId ?? "") || !UUID_RE.test(input.mergeId ?? "")) {
    return { error: "Pick two cards to merge." };
  }
  if (input.keepId === input.mergeId) {
    return { error: "Pick two different cards to merge." };
  }
  const fields = (input.fields ?? []).filter((f) => MERGEABLE_FIELDS.has(f));

  const supabase = await createClient();
  const { error } = await supabase.rpc("merge_honeybook_projects", {
    p_keep: input.keepId,
    p_merge: input.mergeId,
    p_fields: fields,
  });
  if (error) {
    if (/merge_honeybook_projects/i.test(error.message) && /not exist|schema cache|find the function/i.test(error.message)) {
      return {
        error:
          "Couldn’t merge — run migration 175_honeybook_merge_projects.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/honeybook");
  revalidatePath(`/honeybook/projects/${input.keepId}`);
  revalidatePath("/reports");
  revalidatePath("/calendar");
  return { error: null, keptId: input.keepId };
}

/** Undo a merge: the archived card comes back and everything that moved goes home. Admins only. */
export async function undoHoneyBookMergeAction(input: {
  mergedId: string;
}): Promise<Result & { keptId?: string }> {
  const { error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };
  if (!UUID_RE.test(input.mergedId ?? "")) return { error: "Missing card." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("undo_honeybook_merge", {
    p_merged_id: input.mergedId,
  });
  if (error) return { error: error.message };

  revalidatePath("/honeybook");
  revalidatePath(`/honeybook/projects/${input.mergedId}`);
  if (data) revalidatePath(`/honeybook/projects/${data as string}`);
  revalidatePath("/reports");
  revalidatePath("/calendar");
  return { error: null, keptId: (data as string | null) ?? undefined };
}
