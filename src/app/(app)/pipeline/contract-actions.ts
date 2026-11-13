"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { COMPANY } from "@/lib/company";
import { isEmailConfigured, sendEmailDetailed } from "@/lib/email/send";
import { canManagePipelineCrm } from "@/lib/pipeline/access";
import { textToEmailHtml } from "@/lib/pipeline/project-email";
import { fillContract, leftoverTokens } from "@/lib/project-contracts/text";
import {
  contractHash,
  contractSignUrl,
  formatDateLong,
  newContractToken,
} from "@/lib/project-contracts/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Result<T = object> = { error: string } | ({ error: null } & T);

const UUID_RE = /^[0-9a-f-]{36}$/i;
const MAX_BODY = 60_000;

async function requireManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, error: "Sign in first." };
  if (!canManagePipelineCrm(profile.role)) {
    return { profile: null, error: "Only admins and Leads can create or send contracts." };
  }
  return { profile, error: null as string | null };
}

/** Make a draft contract for a project from a template (or blank), with the project details filled in. */
export async function createProjectContract(input: { projectId: string; templateId: string | null }): Promise<Result<{ id: string }>> {
  const { profile, error } = await requireManager();
  if (error || !profile) return { error: error ?? "Sign in first." };
  if (!UUID_RE.test(input.projectId)) return { error: "Project not found." };
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("pipeline_projects")
    .select("name, project_date, location, client_id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };
  let clientName = "";
  let clientEmail = "";
  let clientPhone = "";
  let clientAddress = "";
  if (project.client_id) {
    const { data: c } = await supabase
      .from("pipeline_clients")
      .select("full_name, email, phone, address")
      .eq("id", project.client_id)
      .maybeSingle();
    clientName = String(c?.full_name ?? "");
    clientEmail = String(c?.email ?? "");
    clientPhone = String(c?.phone ?? "");
    clientAddress = String(c?.address ?? "");
  }

  // Fees, services and payment schedule come from the project's latest invoice that is not void.
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  let feeTotal = "";
  let servicesList = "";
  let paymentSchedule = "";
  const { data: inv } = await supabase
    .from("project_invoices")
    .select("id, total")
    .eq("project_id", input.projectId)
    .neq("status", "void")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (inv) {
    feeTotal = money(Number(inv.total));
    const { data: lines } = await supabase
      .from("project_invoice_lines")
      .select("description, qty, unit_price")
      .eq("invoice_id", inv.id)
      .order("sort_order");
    servicesList = (lines ?? [])
      .filter((l) => String(l.description ?? "").trim())
      .map((l) => {
        const qty = Number(l.qty);
        const total = qty * Number(l.unit_price);
        return `- ${String(l.description).trim().replace(/\s*\n\s*/g, " ")}${qty !== 1 ? ` (x${qty})` : ""}: ${money(total)}`;
      })
      .join("\n");
    const { data: inst } = await supabase
      .from("project_invoice_installments")
      .select("label, amount, due_at")
      .eq("invoice_id", inv.id)
      .order("sort_order");
    paymentSchedule = (inst ?? [])
      .map((i) => `${String(i.label || "Payment")}: ${money(Number(i.amount))}${i.due_at ? `, due ${formatDateLong(i.due_at as string)}` : ""}`)
      .join("\n");
  }

  let title = "Agreement";
  let body = "";
  if (input.templateId) {
    if (!UUID_RE.test(input.templateId)) return { error: "Template not found." };
    const { data: t } = await supabase.from("contract_templates").select("name, body").eq("id", input.templateId).maybeSingle();
    if (!t) return { error: "Template not found." };
    title = String(t.name).replace(/\s*\(starter\)\s*$/i, "").replace(/\s+-\s+.*$/, "");
    // Customers always see "Event Agreement", never a title that is just "AV".
    if (/\bAV\b/.test(title) || /^Services Agreement/i.test(title)) title = "Event Agreement";
    body = fillContract(String(t.body), {
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      feeTotal,
      servicesList,
      paymentSchedule,
      projectName: String(project.name ?? ""),
      eventDate: formatDateLong(project.project_date as string | null),
      location: String(project.location ?? ""),
      companyName: COMPANY.displayName,
      today: formatDateLong(new Date().toISOString().slice(0, 10)),
    });
  }

  const { data: row, error: insErr } = await supabase
    .from("project_contracts")
    .insert({ project_id: input.projectId, title, body, sign_token: newContractToken(), created_by: profile.id })
    .select("id")
    .single();
  if (insErr || !row) return { error: insErr?.message ?? "Could not create the contract." };
  revalidatePath(`/pipeline/projects/${input.projectId}`);
  return { error: null, id: row.id as string };
}

export async function saveProjectContract(input: { id: string; title: string; body: string }): Promise<Result> {
  const { error } = await requireManager();
  if (error) return { error };
  if (!UUID_RE.test(input.id)) return { error: "Contract not found." };
  const title = input.title.trim().slice(0, 160);
  const body = input.body.replace(/\r\n/g, "\n");
  if (!title) return { error: "Add a title." };
  if (!body.trim()) return { error: "The contract is empty." };
  if (body.length > MAX_BODY) return { error: "That's too long for one contract." };
  const supabase = await createClient();
  const { data: cur } = await supabase.from("project_contracts").select("status, project_id").eq("id", input.id).maybeSingle();
  if (!cur) return { error: "Contract not found." };
  if (cur.status !== "draft") return { error: "Only drafts can be edited. Void it and make a new one." };
  const { error: e } = await supabase
    .from("project_contracts")
    .update({ title, body, updated_at: new Date().toISOString() })
    .eq("id", input.id);
  if (e) return { error: e.message };
  revalidatePath(`/pipeline/projects/${cur.project_id}`);
  return { error: null };
}

export async function sendProjectContract(input: { id: string; to: string; message: string }): Promise<Result<{ sentTo: string }>> {
  const { profile, error } = await requireManager();
  if (error || !profile) return { error: error ?? "Sign in first." };
  if (!UUID_RE.test(input.id)) return { error: "Contract not found." };
  const to = input.to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: "Enter a valid email address." };
  if (!isEmailConfigured()) return { error: "Email isn't set up yet. An admin needs to add RESEND_API_KEY and EMAIL_FROM in Vercel." };

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("project_contracts")
    .select("id, title, body, status, sign_token, project_id")
    .eq("id", input.id)
    .maybeSingle();
  if (!c) return { error: "Contract not found." };
  if (c.status === "signed") return { error: "This contract is already signed." };
  if (c.status === "void") return { error: "This contract is void." };
  if (c.status === "declined") return { error: "The client declined this contract. Make a new one to send again." };
  const left = leftoverTokens(`${c.title}\n${c.body}`);
  if (left.length) return { error: `Replace these placeholders before sending: ${left.join(", ")}` };

  const { data: project } = await supabase.from("pipeline_projects").select("name").eq("id", c.project_id).maybeSingle();
  const link = contractSignUrl(c.sign_token as string);
  const intro = input.message.trim() || `Your agreement for ${project?.name ?? "your event"} is ready to review and sign.`;
  const text = `${intro}\n\nReview and sign online: ${link}\n\nIt takes about a minute and works on a phone. You will get a signed copy by email.\n\n--\n${profile.full_name ?? COMPANY.displayName}\n${COMPANY.displayName}`;
  const result = await sendEmailDetailed({
    to: [to],
    subject: `${c.title} from ${COMPANY.displayName}`,
    text,
    html: textToEmailHtml(text),
    replyTo: profile.email || null,
  });
  if (!result.ok) return { error: result.error ?? "The email didn't send." };

  if (c.status === "draft") {
    await supabase
      .from("project_contracts")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        body_hash: contractHash(String(c.title), String(c.body)),
        signer_email: to,
        updated_at: new Date().toISOString(),
      })
      .eq("id", c.id)
      .eq("status", "draft");
  }
  await supabase.from("pipeline_project_notes").insert({
    project_id: c.project_id,
    author_id: profile.id,
    source: "manual",
    category: "email",
    body: `Emailed contract "${c.title}" for signature to ${to}.`,
  });
  revalidatePath(`/pipeline/projects/${c.project_id}`);
  return { error: null, sentTo: to };
}

export async function voidProjectContract(id: string): Promise<Result> {
  const { error } = await requireManager();
  if (error) return { error };
  if (!UUID_RE.test(id)) return { error: "Contract not found." };
  const supabase = await createClient();
  const { data: c } = await supabase.from("project_contracts").select("project_id, status").eq("id", id).maybeSingle();
  if (!c) return { error: "Contract not found." };
  if (c.status === "signed") return { error: "A signed contract can't be voided here. Keep it on file and make an amendment instead." };
  const { error: e } = await supabase.from("project_contracts").update({ status: "void", updated_at: new Date().toISOString() }).eq("id", id);
  if (e) return { error: e.message };
  revalidatePath(`/pipeline/projects/${c.project_id}`);
  return { error: null };
}

export async function deleteDraftProjectContract(id: string): Promise<Result> {
  const { error } = await requireManager();
  if (error) return { error };
  if (!UUID_RE.test(id)) return { error: "Contract not found." };
  const supabase = await createClient();
  const { data: c } = await supabase.from("project_contracts").select("project_id, status").eq("id", id).maybeSingle();
  if (!c) return { error: "Contract not found." };
  if (c.status !== "draft") return { error: "Only drafts can be deleted." };
  const { error: e } = await supabase.from("project_contracts").delete().eq("id", id);
  if (e) return { error: e.message };
  revalidatePath(`/pipeline/projects/${c.project_id}`);
  return { error: null };
}

/** Keep a draft's wording as a reusable template (with the project's details left in, so edit them first if needed). */
export async function saveContractAsTemplate(input: { id: string; name: string }): Promise<Result> {
  const { profile, error } = await requireManager();
  if (error || !profile) return { error: error ?? "Sign in first." };
  const name = input.name.trim().slice(0, 120);
  if (!name) return { error: "Name the template." };
  if (!UUID_RE.test(input.id)) return { error: "Contract not found." };
  const supabase = await createClient();
  const { data: c } = await supabase.from("project_contracts").select("body").eq("id", input.id).maybeSingle();
  if (!c) return { error: "Contract not found." };
  const { error: e } = await supabase.from("contract_templates").insert({ name, body: c.body, created_by: profile.id });
  if (e) return { error: /duplicate|unique/i.test(e.message) ? "A template with that name already exists." : e.message };
  return { error: null };
}
