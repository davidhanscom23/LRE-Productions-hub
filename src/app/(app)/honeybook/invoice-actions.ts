"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { canManageHoneyBookCrm } from "@/lib/honeybook/access";
import { COMPANY } from "@/lib/company";
import { isEmailConfigured, sendEmailDetailed } from "@/lib/email/send";
import { buildRmsDocumentPdf, rmsDocumentFileName } from "@/lib/av-erp/documents/rms-document-pdf";
import { rmsDocumentFromProjectInvoice } from "@/lib/project-invoices/document";
import { roundMoney } from "@/lib/av-erp/invoicing";
import {
  buildPlan,
  computeTotals,
  type Installment,
  type PlanKind,
} from "@/lib/project-invoices/math";
import {
  newProjectInvoiceToken,
  projectInvoicePayUrl,
  refreshProjectInvoice,
  todayIso,
} from "@/lib/project-invoices/server";
import { textToEmailHtml } from "@/lib/honeybook/project-email";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Result<T = object> = { error: string } | ({ error: null } & T);

const UUID_RE = /^[0-9a-f-]{36}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, error: "Sign in first." };
  if (!canManageHoneyBookCrm(profile.role)) {
    return { profile: null, error: "Only admins and Leads can create or change invoices." };
  }
  return { profile, error: null as string | null };
}

export type InvoiceDraftInput = {
  id?: string;
  projectId: string;
  title: string;
  taxRatePct: number;
  dueAt: string | null;
  notes: string;
  lines: { description: string; qty: number; unit_price: number; catalog_item_id?: string | null; section?: string }[];
  plan: PlanKind | "custom";
  installments?: Installment[];
  eventDate?: string | null;
};

/** Create or replace a draft/unpaid invoice. Paid or void invoices can't be edited. */
export async function saveProjectInvoice(input: InvoiceDraftInput): Promise<Result<{ id: string }>> {
  const { profile, error } = await requireManager();
  if (error || !profile) return { error: error ?? "Sign in first." };
  if (!UUID_RE.test(input.projectId)) return { error: "Project not found." };
  const lines = input.lines
    .map((l) => ({
      description: String(l.description ?? "").trim().slice(0, 300),
      qty: Number(l.qty),
      unit_price: Number(l.unit_price),
      catalog_item_id: l.catalog_item_id && UUID_RE.test(l.catalog_item_id) ? l.catalog_item_id : null,
      section: String(l.section ?? "").trim().slice(0, 80),
    }))
    .filter((l) => l.description);
  if (!lines.length) return { error: "Add at least one line item." };
  if (lines.some((l) => !Number.isFinite(l.qty) || l.qty <= 0 || !Number.isFinite(l.unit_price))) {
    return { error: "Check the quantities and prices." };
  }
  const tax = Number(input.taxRatePct) || 0;
  if (tax < 0 || tax > 100) return { error: "Tax rate must be between 0 and 100." };
  const { subtotal, tax: taxAmount, total } = computeTotals(lines, tax);
  if (!(total > 0)) return { error: "The total must be more than $0." };
  if (input.dueAt && !DATE_RE.test(input.dueAt)) return { error: "Bad due date." };

  const issued = todayIso();
  let installments: Installment[];
  if (input.plan === "custom") {
    installments = (input.installments ?? [])
      .map((i) => ({ label: String(i.label ?? "").trim().slice(0, 80) || "Payment", amount: roundMoney(Number(i.amount)), due_at: i.due_at && DATE_RE.test(i.due_at) ? i.due_at : null }))
      .filter((i) => i.amount > 0);
    const sum = roundMoney(installments.reduce((s, i) => s + i.amount, 0));
    if (!installments.length) return { error: "Add at least one payment to the schedule." };
    if (Math.abs(sum - total) > 0.005) {
      return { error: `The payment schedule adds up to $${sum.toFixed(2)} but the invoice total is $${total.toFixed(2)}.` };
    }
  } else {
    installments = buildPlan({ kind: input.plan, total, issuedAt: issued, eventDate: input.eventDate ?? null });
  }

  const supabase = await createClient();
  let id = input.id ?? null;
  if (id) {
    if (!UUID_RE.test(id)) return { error: "Invoice not found." };
    const { data: cur } = await supabase.from("project_invoices").select("status, amount_paid, project_id").eq("id", id).maybeSingle();
    if (!cur) return { error: "Invoice not found." };
    if (cur.status === "void" || cur.status === "paid") return { error: "Paid or void invoices can't be edited." };
    if (Number(cur.amount_paid) > 0) return { error: "This invoice already has payments, so it can't be edited. Void it and make a new one if needed." };
    const { error: upErr } = await supabase
      .from("project_invoices")
      .update({
        title: input.title.trim().slice(0, 160),
        tax_rate_pct: tax,
        subtotal,
        tax_amount: taxAmount,
        total,
        due_at: input.dueAt,
        notes: input.notes.trim().slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (upErr) return { error: upErr.message };
    await supabase.from("project_invoice_lines").delete().eq("invoice_id", id);
    await supabase.from("project_invoice_installments").delete().eq("invoice_id", id);
  } else {
    const { data: row, error: insErr } = await supabase
      .from("project_invoices")
      .insert({
        project_id: input.projectId,
        number: "",
        title: input.title.trim().slice(0, 160),
        tax_rate_pct: tax,
        subtotal,
        tax_amount: taxAmount,
        total,
        due_at: input.dueAt,
        notes: input.notes.trim().slice(0, 2000),
        pay_token: newProjectInvoiceToken(),
        created_by: profile.id,
      })
      .select("id")
      .single();
    if (insErr || !row) return { error: insErr?.message ?? "Could not create the invoice." };
    id = row.id as string;
  }

  const lineRows = lines.map((l, i) => ({
    invoice_id: id,
    sort_order: i,
    description: l.description,
    qty: l.qty,
    unit_price: l.unit_price,
    catalog_item_id: l.catalog_item_id,
  }));
  // Tolerant before migration 188: if the section column isn't there yet, save without it.
  let { error: lineErr } = await supabase
    .from("project_invoice_lines")
    .insert(lineRows.map((r, i) => ({ ...r, section: lines[i].section })));
  if (lineErr && /section/i.test(lineErr.message)) {
    ({ error: lineErr } = await supabase.from("project_invoice_lines").insert(lineRows));
  }
  if (lineErr) return { error: lineErr.message };
  const { error: instErr } = await supabase.from("project_invoice_installments").insert(
    installments.map((p, i) => ({ invoice_id: id, sort_order: i, label: p.label, amount: p.amount, due_at: p.due_at })),
  );
  if (instErr) return { error: instErr.message };
  revalidatePath(`/honeybook/projects/${input.projectId}`);
  return { error: null, id: id! };
}

/** Email the pay link and mark the invoice sent. */
export async function sendProjectInvoice(input: { id: string; to: string; message: string }): Promise<Result<{ sentTo: string }>> {
  const { profile, error } = await requireManager();
  if (error || !profile) return { error: error ?? "Sign in first." };
  if (!UUID_RE.test(input.id)) return { error: "Invoice not found." };
  const to = input.to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: "Enter a valid email address." };
  if (!isEmailConfigured()) return { error: "Email isn't set up yet. An admin needs to add RESEND_API_KEY and EMAIL_FROM in Vercel." };

  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("project_invoices")
    .select("id, number, title, status, total, pay_token, pay_enabled, project_id")
    .eq("id", input.id)
    .maybeSingle();
  if (!inv) return { error: "Invoice not found." };
  if (inv.status === "void") return { error: "This invoice is void." };
  if (inv.status === "paid") return { error: "This invoice is already paid." };
  const { data: project } = await supabase.from("honeybook_projects").select("name").eq("id", inv.project_id).maybeSingle();

  const link = projectInvoicePayUrl(inv.pay_token as string);
  const intro = input.message.trim() || `Here is your invoice for ${project?.name ?? "your event"}.`;
  const text = `${intro}\n\nInvoice ${inv.number}${inv.title ? ` — ${inv.title}` : ""}\nTotal: $${Number(inv.total).toFixed(2)}\n\nView and pay online: ${link}\n\n--\n${profile.full_name ?? COMPANY.displayName}\n${COMPANY.displayName}`;
  const result = await sendEmailDetailed({
    to: [to],
    subject: `Invoice ${inv.number} from ${COMPANY.displayName}`,
    text,
    html: textToEmailHtml(text),
    replyTo: profile.email || null,
  });
  if (!result.ok) return { error: result.error ?? "The email didn't send." };

  await supabase
    .from("project_invoices")
    .update({ status: "sent", issued_at: todayIso(), pay_enabled: true, updated_at: new Date().toISOString() })
    .eq("id", inv.id)
    .eq("status", "draft");
  await supabase.from("honeybook_project_notes").insert({
    project_id: inv.project_id,
    author_id: profile.id,
    source: "manual",
    category: "email",
    body: `Emailed invoice ${inv.number} ($${Number(inv.total).toFixed(2)}) to ${to}.`,
  });
  revalidatePath(`/honeybook/projects/${inv.project_id}`);
  return { error: null, sentTo: to };
}

export async function recordProjectInvoicePayment(input: {
  invoiceId: string;
  amount: number;
  method: string;
  receivedAt: string;
  notes: string;
}): Promise<Result> {
  const { profile, error } = await requireManager();
  if (error || !profile) return { error: error ?? "Sign in first." };
  if (!UUID_RE.test(input.invoiceId)) return { error: "Invoice not found." };
  const amount = roundMoney(Number(input.amount));
  if (!(amount > 0)) return { error: "Enter an amount above $0." };
  if (!DATE_RE.test(input.receivedAt)) return { error: "Pick the date received." };
  const method = ["check", "cash", "venmo", "zelle", "card", "bank", "other"].includes(input.method) ? input.method : "other";

  const supabase = await createClient();
  const { data: inv } = await supabase.from("project_invoices").select("id, status, total, amount_paid, project_id").eq("id", input.invoiceId).maybeSingle();
  if (!inv) return { error: "Invoice not found." };
  if (inv.status === "void") return { error: "This invoice is void." };
  const remaining = roundMoney(Number(inv.total) - Number(inv.amount_paid));
  if (amount - remaining > 0.005) return { error: `That's more than the $${remaining.toFixed(2)} still owed.` };

  const { error: payErr } = await supabase.from("project_invoice_payments").insert({
    invoice_id: inv.id,
    amount,
    received_at: input.receivedAt,
    method,
    notes: input.notes.trim().slice(0, 300),
    created_by: profile.id,
  });
  if (payErr) return { error: payErr.message };
  await refreshProjectInvoice(supabase, inv.id as string, { markSent: true });
  await supabase.from("honeybook_project_notes").insert({
    project_id: inv.project_id,
    author_id: profile.id,
    source: "manual",
    category: "note",
    body: `Recorded a $${amount.toFixed(2)} ${method} payment on an invoice.`,
  });
  revalidatePath(`/honeybook/projects/${inv.project_id}`);
  return { error: null };
}

export async function voidProjectInvoice(id: string): Promise<Result> {
  const { error } = await requireManager();
  if (error) return { error };
  if (!UUID_RE.test(id)) return { error: "Invoice not found." };
  const supabase = await createClient();
  const { data: inv } = await supabase.from("project_invoices").select("project_id, status").eq("id", id).maybeSingle();
  if (!inv) return { error: "Invoice not found." };
  const { error: e } = await supabase.from("project_invoices").update({ status: "void", pay_enabled: false, updated_at: new Date().toISOString() }).eq("id", id);
  if (e) return { error: e.message };
  revalidatePath(`/honeybook/projects/${inv.project_id}`);
  return { error: null };
}

/** Drafts can be deleted outright; anything that was sent must be voided instead. */
export async function deleteDraftProjectInvoice(id: string): Promise<Result> {
  const { error } = await requireManager();
  if (error) return { error };
  if (!UUID_RE.test(id)) return { error: "Invoice not found." };
  const supabase = await createClient();
  const { data: inv } = await supabase.from("project_invoices").select("project_id, status").eq("id", id).maybeSingle();
  if (!inv) return { error: "Invoice not found." };
  if (inv.status !== "draft") return { error: "Only drafts can be deleted. Void a sent invoice instead." };
  const { error: e } = await supabase.from("project_invoices").delete().eq("id", id);
  if (e) return { error: e.message };
  revalidatePath(`/honeybook/projects/${inv.project_id}`);
  return { error: null };
}

export type ProjectInvoicePdfResult = { ok: true; pdfBase64: string; fileName: string } | { ok: false; error: string };

/** Branded customer PDF for a project invoice (kind "invoice") or its receipt (kind "receipt"). */
export async function downloadProjectInvoicePdf(invoiceId: string, kind: "invoice" | "receipt"): Promise<ProjectInvoicePdfResult> {
  const { profile, error } = await requireManager();
  if (error || !profile) return { ok: false, error: error ?? "Sign in first." };
  if (!UUID_RE.test(invoiceId)) return { ok: false, error: "Invoice not found." };
  const supabase = await createClient();
  const { data: inv } = await supabase.from("project_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!inv) return { ok: false, error: "Invoice not found." };
  const [{ data: lines }, { data: inst }, { data: pays }, { data: project }] = await Promise.all([
    supabase.from("project_invoice_lines").select("*").eq("invoice_id", invoiceId).order("sort_order"),
    supabase.from("project_invoice_installments").select("label, amount, due_at").eq("invoice_id", invoiceId).order("sort_order"),
    supabase.from("project_invoice_payments").select("amount, received_at, method, reference").eq("invoice_id", invoiceId).order("received_at"),
    supabase.from("honeybook_projects").select("name, client_id").eq("id", inv.project_id).maybeSingle(),
  ]);
  if (kind === "receipt" && !(pays ?? []).length) return { ok: false, error: "No payments have been recorded on this invoice yet." };
  let clientName = "";
  let clientEmail = "";
  if (project?.client_id) {
    const { data: c } = await supabase.from("honeybook_clients").select("full_name, email").eq("id", project.client_id).maybeSingle();
    clientName = String(c?.full_name ?? "");
    clientEmail = String(c?.email ?? "");
  }
  const doc = rmsDocumentFromProjectInvoice(
    {
      number: String(inv.number),
      title: String(inv.title ?? ""),
      issuedAt: (inv.issued_at as string | null) ?? null,
      dueAt: (inv.due_at as string | null) ?? null,
      taxRatePct: Number(inv.tax_rate_pct),
      subtotal: Number(inv.subtotal),
      taxAmount: Number(inv.tax_amount),
      total: Number(inv.total),
      amountPaid: Number(inv.amount_paid),
      notes: String(inv.notes ?? ""),
      projectName: String(project?.name ?? ""),
      clientName,
      clientEmail,
      lines: (lines ?? []).map((l) => ({ description: String(l.description), qty: Number(l.qty), unit_price: Number(l.unit_price), section: String(l.section ?? "") })),
      installments: (inst ?? []).map((i) => ({ label: String(i.label), amount: Number(i.amount), due_at: (i.due_at as string | null) ?? null })),
      payUrl: inv.status === "draft" ? null : projectInvoicePayUrl(String(inv.pay_token)),
      payments: (pays ?? []).map((p) => ({ received_at: String(p.received_at), method: String(p.method), reference: (p.reference as string | null) ?? null, amount: Number(p.amount) })),
    },
    kind,
  );
  const bytes = await buildRmsDocumentPdf(doc);
  return { ok: true, pdfBase64: Buffer.from(bytes).toString("base64"), fileName: rmsDocumentFileName(doc) };
}
