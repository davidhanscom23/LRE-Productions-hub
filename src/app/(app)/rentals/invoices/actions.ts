"use server";

import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";
import { rmsDocumentFromInvoice, rmsReceiptFromInvoice } from "@/lib/av-erp/documents/from-invoice";
import {
  buildRmsDocumentPdf,
  rmsDocumentFileName,
} from "@/lib/av-erp/documents/rms-document-pdf";
import {
  customerUnitPrice,
  lineTotal,
} from "@/lib/av-erp/pricing";
import {
  invoiceGrandTotal,
  invoiceLinesSubtotal,
  invoiceOutstanding,
  invoiceTaxAmount,
  resolveInvoiceTaxRatePct,
  roundMoney,
} from "@/lib/av-erp/invoicing";
import {
  emailInvoicePayLink,
  loadInvoiceCustomerEmail,
} from "@/lib/av-erp/invoice-pay-email";
import { refreshSettlementTotals } from "@/lib/av-erp/invoice-settlement";
import { newInvoicePayToken } from "@/lib/av-erp/public-invoice";
import { loadShopDefaultSalesTaxRatePct } from "@/lib/av-erp/shop-tax";
import { loadBillingType } from "@/lib/av-erp/billing-type";
import { applyPaidVenueDepositToInvoice } from "@/lib/av-erp/venue-deposit-payment";
import { COMPANY } from "@/lib/company";
import { getStripe, siteOrigin, stripeSecretConfigured } from "@/lib/stripe/server";
import type {
  AvCustomer,
  AvInvoice,
  AvInvoiceLine,
  AvJobVenue,
  AvPayment,
} from "@/lib/av-erp/types";

export type InvoiceActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export type MarkInvoiceSentResult =
  | {
      ok: true;
      id: string;
      payPath?: string;
      emailedTo?: string;
      emailSkipped?: boolean;
      emailError?: string;
    }
  | { ok: false; error: string };

export type EnableInvoicePayResult =
  | {
      ok: true;
      token: string;
      path: string;
      emailedTo?: string;
      emailSkipped?: boolean;
      emailError?: string;
    }
  | { ok: false; error: string };

export type DownloadInvoiceResult =
  | { ok: true; pdfBase64: string; fileName: string }
  | { ok: false; error: string };

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string) {
  const n = Number(str(formData, key));
  return Number.isFinite(n) ? n : 0;
}

function revalidateInvoice(id?: string) {
  revalidatePath("/rentals/invoices");
  revalidatePath("/rentals");
  if (id) revalidatePath(`/rentals/invoices/${id}`);
}

type AvErpSupabase = Awaited<
  ReturnType<typeof requireAvErpAccess>
>["supabase"];

async function requireDraftInvoice(
  supabase: AvErpSupabase,
  invoiceId: string,
): Promise<InvoiceActionResult | { ok: true; status: string }> {
  if (!invoiceId) return { ok: false, error: "Missing invoice." };
  const { data: inv } = await supabase
    .from("av_invoices")
    .select("id, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status !== "draft") {
    return {
      ok: false,
      error: "Only draft invoices can be edited. Mark sent locks the lines.",
    };
  }
  return { ok: true, status: inv.status as string };
}

/** Recompute subtotal / tax / total from current draft lines + tax_rate_pct. */
async function recomputeDraftTotals(
  supabase: AvErpSupabase,
  invoiceId: string,
): Promise<InvoiceActionResult> {
  const { data: inv, error: invError } = await supabase
    .from("av_invoices")
    .select("id, tax_rate_pct")
    .eq("id", invoiceId)
    .eq("status", "draft")
    .maybeSingle();
  if (invError) return { ok: false, error: invError.message };
  if (!inv) return { ok: false, error: "Draft invoice not found." };

  const { data: lines, error } = await supabase
    .from("av_invoice_lines")
    .select("qty, unit_price")
    .eq("invoice_id", invoiceId);
  if (error) return { ok: false, error: error.message };

  const subtotal = invoiceLinesSubtotal(lines ?? []);
  const taxRatePct = Number(inv.tax_rate_pct) || 0;
  const taxAmount = invoiceTaxAmount(subtotal, taxRatePct);
  const total = invoiceGrandTotal(subtotal, taxAmount);
  const { error: updateError } = await supabase
    .from("av_invoices")
    .update({ subtotal, tax_amount: taxAmount, total })
    .eq("id", invoiceId)
    .eq("status", "draft");
  if (updateError) {
    if (/tax_amount|tax_rate_pct|column/i.test(updateError.message)) {
      return {
        ok: false,
        error:
          "Invoice sales tax needs migration 153_av_tax_co_lines_signed.sql in Supabase.",
      };
    }
    return { ok: false, error: updateError.message };
  }
  return { ok: true, id: invoiceId };
}

/** Draft an invoice from a Hub quote using customer-facing line prices. */
export async function createInvoiceFromOpportunityAction(
  opportunityId: string,
): Promise<InvoiceActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };
  if (!opportunityId) return { ok: false, error: "Missing estimate." };

  const { data: opp, error: oppError } = await supabase
    .from("av_opportunities")
    .select(
      "id, reference, subject, customer_id, status, surcharge_pct, discount_pct, venue_markup_pct, venue_markup_enabled",
    )
    .eq("id", opportunityId)
    .maybeSingle();
  if (oppError || !opp) {
    return { ok: false, error: oppError?.message ?? "Estimate not found." };
  }

  const { data: lines, error: linesError } = await supabase
    .from("av_opportunity_lines")
    .select("description, qty, unit_price, discount_pct, sort_order")
    .eq("opportunity_id", opportunityId)
    .order("sort_order");
  if (linesError) return { ok: false, error: linesError.message };
  if (!lines || lines.length === 0) {
    return { ok: false, error: "Estimate has no lines to invoice." };
  }

  const markupEnabled = Boolean(opp.venue_markup_enabled);
  const markupPct = Number(opp.venue_markup_pct) || 0;

  const invoiceLines = lines.map((l, i) => {
    const custUnit = customerUnitPrice(
      Number(l.unit_price) || 0,
      markupPct,
      markupEnabled,
    );
    const qty = Number(l.qty) || 0;
    const disc = Number(l.discount_pct) || 0;
    // Fold line discount into unit so invoice lines stay simple.
    const unitAfterDisc = roundMoney(custUnit * (1 - disc / 100));
    return {
      description: (l.description as string) || "Line",
      qty: Math.max(0.01, qty),
      unit_price: unitAfterDisc,
      sort_order: i,
      line_total: lineTotal({
        qty: Math.max(0.01, qty),
        unitPrice: unitAfterDisc,
        discountPct: 0,
      }),
    };
  });

  let subtotal = roundMoney(
    invoiceLines.reduce((s, l) => s + l.line_total, 0),
  );
  const billingType = await loadBillingType(supabase, "av_opportunities", opportunityId);
  // Venue partner jobs never show our surcharge; the venue adds its own on the master bill.
  const surchargePct = billingType === "venue" ? 0 : Number(opp.surcharge_pct) || 0;
  const discountPct = Number(opp.discount_pct) || 0;
  if (surchargePct > 0) {
    const amt = roundMoney(subtotal * (surchargePct / 100));
    invoiceLines.push({
      description: `Surcharge (${surchargePct}%)`,
      qty: 1,
      unit_price: amt,
      sort_order: invoiceLines.length,
      line_total: amt,
    });
    subtotal = roundMoney(subtotal + amt);
  }
  if (discountPct > 0) {
    const amt = roundMoney(subtotal * (discountPct / 100));
    invoiceLines.push({
      description: `Discount (${discountPct}%)`,
      qty: 1,
      unit_price: -amt,
      sort_order: invoiceLines.length,
      line_total: -amt,
    });
    subtotal = roundMoney(subtotal - amt);
  }

  let customerTaxExempt = false;
  if (opp.customer_id) {
    const { data: customer } = await supabase
      .from("av_customers")
      .select("tax_exempt")
      .eq("id", opp.customer_id)
      .maybeSingle();
    customerTaxExempt = Boolean(customer?.tax_exempt);
  }
  const shopDefault = await loadShopDefaultSalesTaxRatePct(supabase);
  const taxRatePct = resolveInvoiceTaxRatePct({
    customerTaxExempt,
    shopDefaultRatePct: shopDefault,
  });
  const taxAmount = invoiceTaxAmount(subtotal, taxRatePct);
  const grandTotal = invoiceGrandTotal(subtotal, taxAmount);

  const today = new Date().toISOString().slice(0, 10);
  const { data: invoice, error: invError } = await supabase
    .from("av_invoices")
    .insert({
      reference: "",
      opportunity_id: opportunityId,
      customer_id: opp.customer_id,
      subject: (opp.subject as string) || `Invoice for ${opp.reference}`,
      status: "draft",
      issued_at: today,
      due_at: today,
      subtotal,
      tax_rate_pct: taxRatePct,
      tax_amount: taxAmount,
      total: grandTotal,
      amount_paid: 0,
      amount_credited: 0,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (invError || !invoice) {
    if (invError && /tax_rate_pct|tax_amount|column/i.test(invError.message)) {
      return {
        ok: false,
        error:
          "Invoice sales tax needs migration 153_av_tax_co_lines_signed.sql in Supabase.",
      };
    }
    return { ok: false, error: invError?.message ?? "Could not create invoice" };
  }

  if (billingType === "venue") {
    await supabase.from("av_invoices").update({ billing_type: "venue" }).eq("id", invoice.id);
  }

  const { error: lineError } = await supabase.from("av_invoice_lines").insert(
    invoiceLines.map((l) => ({
      invoice_id: invoice.id,
      description: l.description,
      qty: l.qty,
      unit_price: l.unit_price,
      sort_order: l.sort_order,
    })),
  );
  if (lineError) return { ok: false, error: lineError.message };

  await applyPaidVenueDepositToInvoice(supabase, {
    invoiceId: invoice.id as string,
    opportunityId,
    createdBy: profile.id,
  });

  revalidateInvoice(invoice.id as string);
  revalidatePath(`/rentals/quotes/${opportunityId}`);
  return { ok: true, id: invoice.id as string };
}

/** Enable pay link on a non-draft invoice with outstanding balance. */
async function ensureInvoicePayLinkEnabled(
  supabase: AvErpSupabase,
  invoiceId: string,
): Promise<
  | { ok: true; token: string; path: string }
  | { ok: false; error: string; skip?: boolean }
> {
  const { data: inv } = await supabase
    .from("av_invoices")
    .select(
      "id, status, total, amount_paid, amount_credited, pay_token, pay_enabled",
    )
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status === "draft" || inv.status === "void") {
    return {
      ok: false,
      error: "Mark the invoice sent before sharing a pay link.",
      skip: true,
    };
  }
  const outstanding = invoiceOutstanding(
    Number(inv.total) || 0,
    Number(inv.amount_paid) || 0,
    Number(inv.amount_credited) || 0,
  );
  if (outstanding <= 0) {
    return { ok: false, error: "Nothing outstanding to collect.", skip: true };
  }

  const token =
    (inv.pay_token as string | null)?.trim() || newInvoicePayToken();
  const { error: updateError } = await supabase
    .from("av_invoices")
    .update({ pay_token: token, pay_enabled: true })
    .eq("id", invoiceId);
  if (updateError) {
    if (/pay_token|pay_enabled|column/i.test(updateError.message)) {
      return {
        ok: false,
        error:
          "Invoice pay links need migration 155_venue_convert_invoice_pay.sql in Supabase.",
      };
    }
    return { ok: false, error: updateError.message };
  }
  return { ok: true, token, path: `/invoice/${token}` };
}

async function emailEnabledPayLink(
  supabase: AvErpSupabase,
  invoiceId: string,
  path: string,
): Promise<{
  emailedTo?: string;
  emailSkipped?: boolean;
  emailError?: string;
}> {
  const customer = await loadInvoiceCustomerEmail(supabase, invoiceId);
  if (!customer) {
    return {
      emailSkipped: true,
      emailError: "No customer email on file — pay link is enabled; share it manually.",
    };
  }
  const sent = await emailInvoicePayLink({
    to: customer.email,
    customerName: customer.customerName,
    reference: customer.reference,
    subject: customer.subject,
    path,
  });
  if (sent.skipped) {
    return {
      emailSkipped: true,
      emailError: sent.error || "Email is not configured (Resend).",
    };
  }
  if (!sent.ok) {
    return { emailError: sent.error || "Pay link email failed." };
  }
  return { emailedTo: customer.email };
}

export async function markInvoiceSentAction(
  invoiceId: string,
): Promise<MarkInvoiceSentResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!invoiceId) return { ok: false, error: "Missing invoice." };

  await refreshSettlementTotals(supabase, invoiceId, { markSent: true });
  const { data } = await supabase
    .from("av_invoices")
    .select("status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (data?.status === "draft") {
    await supabase
      .from("av_invoices")
      .update({ status: "sent" })
      .eq("id", invoiceId);
  }

  const pay = await ensureInvoicePayLinkEnabled(supabase, invoiceId);
  if (!pay.ok) {
    revalidateInvoice(invoiceId);
    if (pay.skip) {
      return { ok: true, id: invoiceId };
    }
    return { ok: false, error: pay.error };
  }

  const mail = await emailEnabledPayLink(supabase, invoiceId, pay.path);
  revalidateInvoice(invoiceId);
  return {
    ok: true,
    id: invoiceId,
    payPath: pay.path,
    ...mail,
  };
}

export async function voidInvoiceAction(
  invoiceId: string,
): Promise<InvoiceActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!invoiceId) return { ok: false, error: "Missing invoice." };

  const { error: updateError } = await supabase
    .from("av_invoices")
    .update({ status: "void" })
    .eq("id", invoiceId);
  if (updateError) return { ok: false, error: updateError.message };
  revalidateInvoice(invoiceId);
  return { ok: true, id: invoiceId };
}

export async function recordPaymentAction(
  formData: FormData,
): Promise<InvoiceActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const invoiceId = str(formData, "invoice_id");
  const amount = Math.max(0, num(formData, "amount"));
  if (!invoiceId) return { ok: false, error: "Missing invoice." };
  if (amount <= 0) return { ok: false, error: "Amount must be greater than zero." };

  const { data: inv } = await supabase
    .from("av_invoices")
    .select("status, total, amount_paid, amount_credited")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status === "void") {
    return { ok: false, error: "Cannot pay a void invoice." };
  }

  const outstanding = invoiceOutstanding(
    Number(inv.total) || 0,
    Number(inv.amount_paid) || 0,
    Number(inv.amount_credited) || 0,
  );
  if (amount > outstanding + 0.001) {
    return {
      ok: false,
      error: `Amount exceeds outstanding ${outstanding.toFixed(2)}.`,
    };
  }

  const receivedAt =
    str(formData, "received_at") || new Date().toISOString().slice(0, 10);

  const { error: payError } = await supabase.from("av_payments").insert({
    invoice_id: invoiceId,
    amount,
    received_at: receivedAt,
    method: str(formData, "method"),
    reference: str(formData, "reference"),
    notes: str(formData, "notes"),
    created_by: profile.id,
  });
  if (payError) return { ok: false, error: payError.message };

  await refreshSettlementTotals(supabase, invoiceId, { markSent: true });
  revalidateInvoice(invoiceId);
  return { ok: true, id: invoiceId };
}

/** Issue a credit note against an invoice (reduces AR). */
export async function issueCreditAction(
  formData: FormData,
): Promise<InvoiceActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const invoiceId = str(formData, "invoice_id");
  const amount = Math.max(0, num(formData, "amount"));
  if (!invoiceId) return { ok: false, error: "Missing invoice." };
  if (amount <= 0) return { ok: false, error: "Amount must be greater than zero." };

  const { data: inv } = await supabase
    .from("av_invoices")
    .select("status, total, amount_paid, amount_credited")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status === "void") {
    return { ok: false, error: "Cannot credit a void invoice." };
  }
  if (inv.status === "draft") {
    return { ok: false, error: "Mark the invoice sent before issuing a credit." };
  }

  const outstanding = invoiceOutstanding(
    Number(inv.total) || 0,
    Number(inv.amount_paid) || 0,
    Number(inv.amount_credited) || 0,
  );
  if (amount > outstanding + 0.001) {
    return {
      ok: false,
      error: `Amount exceeds outstanding ${outstanding.toFixed(2)}.`,
    };
  }

  const issuedAt =
    str(formData, "issued_at") || new Date().toISOString().slice(0, 10);

  const { error: creditError } = await supabase.from("av_invoice_credits").insert({
    invoice_id: invoiceId,
    reference: "",
    amount,
    issued_at: issuedAt,
    reason: str(formData, "reason"),
    notes: str(formData, "notes"),
    created_by: profile.id,
  });
  if (creditError) return { ok: false, error: creditError.message };

  await refreshSettlementTotals(supabase, invoiceId);
  revalidateInvoice(invoiceId);
  return { ok: true, id: invoiceId };
}

/** Update draft invoice header (subject / dates / notes). */
export async function updateInvoiceHeaderAction(
  formData: FormData,
): Promise<InvoiceActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const invoiceId = str(formData, "invoice_id");
  const gate = await requireDraftInvoice(supabase, invoiceId);
  if (!gate.ok) return gate;

  const subject = str(formData, "subject");
  if (!subject) return { ok: false, error: "Subject is required." };

  const issuedAt = str(formData, "issued_at") || null;
  const dueAt = str(formData, "due_at") || null;
  const taxRateRaw = str(formData, "tax_rate_pct");
  const taxRatePct = Math.max(
    0,
    Math.min(100, Number.isFinite(Number(taxRateRaw)) ? Number(taxRateRaw) : 0),
  );

  const { error: updateError } = await supabase
    .from("av_invoices")
    .update({
      subject,
      issued_at: issuedAt,
      due_at: dueAt,
      notes: str(formData, "notes"),
      tax_rate_pct: taxRatePct,
    })
    .eq("id", invoiceId)
    .eq("status", "draft");
  if (updateError) {
    if (/tax_rate_pct|column/i.test(updateError.message)) {
      return {
        ok: false,
        error:
          "Invoice sales tax needs migration 153_av_tax_co_lines_signed.sql in Supabase.",
      };
    }
    return { ok: false, error: updateError.message };
  }

  const recomputed = await recomputeDraftTotals(supabase, invoiceId);
  if (!recomputed.ok) return recomputed;

  revalidateInvoice(invoiceId);
  return { ok: true, id: invoiceId };
}

/** Update a draft invoice line and recompute totals. */
export async function updateInvoiceLineAction(
  formData: FormData,
): Promise<InvoiceActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const invoiceId = str(formData, "invoice_id");
  const lineId = str(formData, "id");
  if (!lineId) return { ok: false, error: "Missing line." };

  const gate = await requireDraftInvoice(supabase, invoiceId);
  if (!gate.ok) return gate;

  const description = str(formData, "description") || "Line";
  const qty = Math.max(0.01, num(formData, "qty"));
  const unitPrice = num(formData, "unit_price");

  const { error: updateError } = await supabase
    .from("av_invoice_lines")
    .update({
      description,
      qty,
      unit_price: unitPrice,
    })
    .eq("id", lineId)
    .eq("invoice_id", invoiceId);
  if (updateError) return { ok: false, error: updateError.message };

  const recomputed = await recomputeDraftTotals(supabase, invoiceId);
  if (!recomputed.ok) return recomputed;

  revalidateInvoice(invoiceId);
  return { ok: true, id: invoiceId };
}

/** Add a free-text line to a draft invoice. */
export async function addInvoiceLineAction(
  formData: FormData,
): Promise<InvoiceActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const invoiceId = str(formData, "invoice_id");
  const gate = await requireDraftInvoice(supabase, invoiceId);
  if (!gate.ok) return gate;

  const description = str(formData, "description");
  if (!description) return { ok: false, error: "Description is required." };

  const qty = Math.max(0.01, num(formData, "qty") || 1);
  const unitPrice = num(formData, "unit_price");

  const { count } = await supabase
    .from("av_invoice_lines")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId);

  const { error: insertError } = await supabase.from("av_invoice_lines").insert({
    invoice_id: invoiceId,
    description,
    qty,
    unit_price: unitPrice,
    sort_order: count ?? 0,
  });
  if (insertError) return { ok: false, error: insertError.message };

  const recomputed = await recomputeDraftTotals(supabase, invoiceId);
  if (!recomputed.ok) return recomputed;

  revalidateInvoice(invoiceId);
  return { ok: true, id: invoiceId };
}

/** Remove a line from a draft invoice. */
export async function deleteInvoiceLineAction(
  formData: FormData,
): Promise<InvoiceActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const invoiceId = str(formData, "invoice_id");
  const lineId = str(formData, "id");
  if (!lineId) return { ok: false, error: "Missing line." };

  const gate = await requireDraftInvoice(supabase, invoiceId);
  if (!gate.ok) return gate;

  const { error: delError } = await supabase
    .from("av_invoice_lines")
    .delete()
    .eq("id", lineId)
    .eq("invoice_id", invoiceId);
  if (delError) return { ok: false, error: delError.message };

  const recomputed = await recomputeDraftTotals(supabase, invoiceId);
  if (!recomputed.ok) return recomputed;

  revalidateInvoice(invoiceId);
  return { ok: true, id: invoiceId };
}

type InvoiceDocLoad =
  | { ok: true; input: Parameters<typeof rmsDocumentFromInvoice>[0]; supabase: Awaited<ReturnType<typeof requireAvErpAccess>>["supabase"] }
  | { ok: false; error: string };

/** Loads everything an invoice or receipt PDF needs. */
async function loadInvoiceDocInput(invoiceId: string): Promise<InvoiceDocLoad> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!invoiceId) return { ok: false, error: "Missing invoice." };

  const { data: inv } = await supabase
    .from("av_invoices")
    .select(
      "id, reference, opportunity_id, customer_id, subject, status, issued_at, due_at, subtotal, tax_rate_pct, tax_amount, total, amount_paid, amount_credited, notes, created_at, updated_at",
    )
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return { ok: false, error: "Invoice not found." };

  const [{ data: lines }, customerRes, oppRes, termsRes] = await Promise.all([
    supabase
      .from("av_invoice_lines")
      .select("id, invoice_id, description, qty, unit_price, sort_order")
      .eq("invoice_id", invoiceId)
      .order("sort_order"),
    inv.customer_id
      ? supabase
          .from("av_customers")
          .select(
            "id, name, contact_name, email, phone, address_line1, address_line2, city, region, postal_code, country, standing_discount_pct, notes, is_quotable, is_retired, external_rms_id, created_at, updated_at",
          )
          .eq("id", inv.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    inv.opportunity_id
      ? supabase
          .from("av_opportunities")
          .select(
            "venue_id, gear_starts_at, gear_ends_at, charge_starts_at, charge_ends_at",
          )
          .eq("id", inv.opportunity_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("av_document_templates")
      .select("terms")
      .eq("kind", "invoice")
      .eq("is_active", true)
      .eq("is_default", true)
      .limit(1)
      .maybeSingle(),
  ]);

  let venue: AvJobVenue | null = null;
  if (oppRes.data?.venue_id) {
    const { data: v } = await supabase
      .from("av_job_venues")
      .select(
        "id, name, contact_name, email, phone, address_line1, address_line2, city, region, postal_code, country, access_notes, power_notes, parking_notes, notes, is_retired, external_rms_id, created_at, updated_at",
      )
      .eq("id", oppRes.data.venue_id)
      .maybeSingle();
    venue = (v as AvJobVenue | null) ?? null;
  }

  const terms =
    !termsRes.error && termsRes.data
      ? String(termsRes.data.terms ?? "")
      : "";

  const billingType = await loadBillingType(supabase, "av_invoices", invoiceId);
  const input = {
    billingType,
    invoice: inv as AvInvoice,
    lines: (lines ?? []) as AvInvoiceLine[],
    customer: (customerRes.data as AvCustomer | null) ?? null,
    venue,
    terms,
    gearStartsAt: oppRes.data?.gear_starts_at ?? null,
    gearEndsAt: oppRes.data?.gear_ends_at ?? null,
    chargeStartsAt: oppRes.data?.charge_starts_at ?? null,
    chargeEndsAt: oppRes.data?.charge_ends_at ?? null,
  };

  return { ok: true, input, supabase };
}

/** Customer-facing invoice PDF (branded layout). */
export async function downloadInvoicePdfAction(
  invoiceId: string,
): Promise<DownloadInvoiceResult> {
  const loaded = await loadInvoiceDocInput(invoiceId);
  if (!loaded.ok) return loaded;
  const doc = rmsDocumentFromInvoice(loaded.input);
  const bytes = await buildRmsDocumentPdf(doc);
  return {
    ok: true,
    pdfBase64: Buffer.from(bytes).toString("base64"),
    fileName: rmsDocumentFileName(doc),
  };
}

/** Customer-facing receipt PDF: the invoice items plus every payment received. */
export async function downloadReceiptPdfAction(
  invoiceId: string,
): Promise<DownloadInvoiceResult> {
  const loaded = await loadInvoiceDocInput(invoiceId);
  if (!loaded.ok) return loaded;
  const { data: payments } = await loaded.supabase
    .from("av_payments")
    .select("id, invoice_id, amount, received_at, method, reference, notes, created_at")
    .eq("invoice_id", invoiceId)
    .order("received_at");
  if (!payments || payments.length === 0) {
    return { ok: false, error: "No payments have been recorded on this invoice yet." };
  }
  const doc = rmsReceiptFromInvoice({ ...loaded.input, payments: payments as AvPayment[] });
  const bytes = await buildRmsDocumentPdf(doc);
  return {
    ok: true,
    pdfBase64: Buffer.from(bytes).toString("base64"),
    fileName: rmsDocumentFileName(doc),
  };
}

/** Enable (or rotate) the public Stripe pay link and email it to the customer. */
export async function enableInvoicePayLinkAction(
  invoiceId: string,
): Promise<EnableInvoicePayResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!invoiceId) return { ok: false, error: "Missing invoice." };

  const pay = await ensureInvoicePayLinkEnabled(supabase, invoiceId);
  if (!pay.ok) return { ok: false, error: pay.error };

  const mail = await emailEnabledPayLink(supabase, invoiceId, pay.path);
  revalidateInvoice(invoiceId);
  return {
    ok: true,
    token: pay.token,
    path: pay.path,
    ...mail,
  };
}

/** Staff: send (or re-send) an unpaid invoice pay-link reminder email. */
export async function sendInvoiceReminderAction(
  invoiceId: string,
): Promise<EnableInvoicePayResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!invoiceId) return { ok: false, error: "Missing invoice." };

  const pay = await ensureInvoicePayLinkEnabled(supabase, invoiceId);
  if (!pay.ok) return { ok: false, error: pay.error };

  const mail = await emailEnabledPayLink(supabase, invoiceId, pay.path);
  if (mail.emailedTo) {
    const { data: inv } = await supabase
      .from("av_invoices")
      .select("remind_count")
      .eq("id", invoiceId)
      .maybeSingle();
    await supabase
      .from("av_invoices")
      .update({
        last_reminded_at: new Date().toISOString(),
        remind_count: (Number(inv?.remind_count) || 0) + 1,
      })
      .eq("id", invoiceId);
  }
  revalidateInvoice(invoiceId);
  return {
    ok: true,
    token: pay.token,
    path: pay.path,
    ...mail,
  };
}

export async function disableInvoicePayLinkAction(
  invoiceId: string,
): Promise<InvoiceActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };
  if (!invoiceId) return { ok: false, error: "Missing invoice." };
  const { error: updateError } = await supabase
    .from("av_invoices")
    .update({ pay_enabled: false })
    .eq("id", invoiceId);
  if (updateError) return { ok: false, error: updateError.message };
  revalidateInvoice(invoiceId);
  return { ok: true, id: invoiceId };
}

export type StartInvoiceCheckoutResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

/** Public: start Stripe Checkout for outstanding balance on a pay-enabled invoice. */
export async function startInvoiceCheckoutAction(
  token: string,
): Promise<StartInvoiceCheckoutResult> {
  const { loadPublicInvoiceByPayToken } = await import(
    "@/lib/av-erp/public-invoice"
  );
  const invoice = await loadPublicInvoiceByPayToken(token);
  if (!invoice) {
    return { ok: false, error: "Pay link not found or disabled." };
  }
  if (invoice.outstanding <= 0) {
    return { ok: false, error: "This invoice is already paid." };
  }
  if (!stripeSecretConfigured()) {
    return {
      ok: false,
      error: "Online payment isn’t configured yet. Please contact us to pay.",
    };
  }
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, error: "Online payment isn’t available right now." };
  }

  const origin = siteOrigin();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: invoice.customerEmail.includes("@")
        ? invoice.customerEmail
        : undefined,
      client_reference_id: invoice.id,
      metadata: {
        av_invoice_id: invoice.id,
        av_invoice_reference: invoice.reference,
        pay_token: token,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(invoice.outstanding * 100),
            product_data: {
              name: `${COMPANY.displayName} invoice ${invoice.reference}`,
              description: invoice.subject || "Invoice balance",
            },
          },
        },
      ],
      success_url: `${origin}/invoice/${token}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/invoice/${token}?canceled=1`,
    });
    if (!session.url) {
      return { ok: false, error: "Could not start checkout." };
    }

    const { createServiceClient } = await import("@/lib/supabase/admin");
    const db = createServiceClient();
    await db
      .from("av_invoices")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", invoice.id);

    return { ok: true, checkoutUrl: session.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed.";
    return { ok: false, error: message };
  }
}
