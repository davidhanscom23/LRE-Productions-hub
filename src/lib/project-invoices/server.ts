import "server-only";

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { roundMoney, invoiceOutstanding } from "@/lib/av-erp/invoicing";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/stripe/server";
import {
  PAY_TOKEN_RE,
  allocatePayments,
  deriveStatus,
  nextPayable,
  type InstallmentStatus,
  type InvoiceStatus,
} from "./math";

export function newProjectInvoiceToken(): string {
  return randomBytes(18).toString("base64url");
}

export function projectInvoicePayUrl(token: string): string {
  return `${siteOrigin()}/pay/${token}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Recompute amount_paid and status from the payments table. Safe to call repeatedly. */
export async function refreshProjectInvoice(
  db: SupabaseClient,
  invoiceId: string,
  opts: { markSent?: boolean } = {},
): Promise<void> {
  const { data: inv } = await db
    .from("project_invoices")
    .select("status, total")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return;
  const { data: pays } = await db.from("project_invoice_payments").select("amount").eq("invoice_id", invoiceId);
  const paid = roundMoney((pays ?? []).reduce((s, p) => s + Number(p.amount), 0));
  let current = inv.status as InvoiceStatus;
  if (opts.markSent && current === "draft") current = "sent";
  const status = deriveStatus({ current, total: Number(inv.total), amountPaid: paid });
  await db
    .from("project_invoices")
    .update({ amount_paid: paid, status, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
}

export type PublicProjectInvoice = {
  id: string;
  number: string;
  title: string;
  status: InvoiceStatus;
  projectName: string;
  clientName: string;
  clientEmail: string;
  issuedAt: string | null;
  dueAt: string | null;
  taxRatePct: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  outstanding: number;
  notes: string;
  payEnabled: boolean;
  lines: { description: string; qty: number; unit_price: number; section: string }[];
  installments: InstallmentStatus[];
  payable: { label: string; amount: number } | null;
};

export async function loadPublicProjectInvoice(token: string): Promise<PublicProjectInvoice | null> {
  if (!PAY_TOKEN_RE.test(token) || !isServiceRoleConfigured()) return null;
  const db = createServiceClient();
  const { data: inv } = await db.from("project_invoices").select("*").eq("pay_token", token).maybeSingle();
  // Drafts are never public.
  if (!inv || inv.status === "draft") return null;
  const [{ data: lines }, { data: inst }, { data: project }] = await Promise.all([
    db.from("project_invoice_lines").select("*").eq("invoice_id", inv.id).order("sort_order"),
    db.from("project_invoice_installments").select("label, amount, due_at").eq("invoice_id", inv.id).order("sort_order"),
    db.from("honeybook_projects").select("name, client_id").eq("id", inv.project_id).maybeSingle(),
  ]);
  let clientName = "";
  let clientEmail = "";
  if (project?.client_id) {
    const { data: c } = await db.from("honeybook_clients").select("full_name, email").eq("id", project.client_id).maybeSingle();
    clientName = String(c?.full_name ?? "");
    clientEmail = String(c?.email ?? "");
  }
  const total = Number(inv.total);
  const amountPaid = Number(inv.amount_paid);
  const outstanding = inv.status === "void" ? 0 : invoiceOutstanding(total, amountPaid);
  const installments = allocatePayments(
    (inst ?? []).map((i) => ({ label: String(i.label), amount: Number(i.amount), due_at: (i.due_at as string | null) ?? null })),
    amountPaid,
    todayIso(),
  );
  return {
    id: inv.id as string,
    number: String(inv.number),
    title: String(inv.title ?? ""),
    status: inv.status as InvoiceStatus,
    projectName: String(project?.name ?? ""),
    clientName,
    clientEmail,
    issuedAt: (inv.issued_at as string | null) ?? null,
    dueAt: (inv.due_at as string | null) ?? null,
    taxRatePct: Number(inv.tax_rate_pct),
    subtotal: Number(inv.subtotal),
    taxAmount: Number(inv.tax_amount),
    total,
    amountPaid,
    outstanding,
    notes: String(inv.notes ?? ""),
    payEnabled: Boolean(inv.pay_enabled),
    lines: (lines ?? []).map((l) => ({ description: String(l.description), qty: Number(l.qty), unit_price: Number(l.unit_price), section: String(l.section ?? "") })),
    installments,
    payable: inv.status === "void" ? null : nextPayable(installments, outstanding),
  };
}
