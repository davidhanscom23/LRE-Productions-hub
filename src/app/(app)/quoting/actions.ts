"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { sendEmail } from "@/lib/email/send";
import { insertNotifications } from "@/lib/notifications/notify";
import { createClient } from "@/lib/supabase/server";
import {
  QUOTE_DEPARTMENT_OPTIONS,
  summarizeQuoteLines,
  type QuoteLineItem,
  type QuoteStatus,
} from "@/lib/types/quoting";

type Result = { error: string | null; id?: string };

function revalidateQuoting(quoteId?: string) {
  revalidatePath("/quoting");
  revalidatePath("/");
  revalidatePath("/for-you");
  if (quoteId) revalidatePath(`/quoting/${quoteId}`);
}

function cleanDept(value: string): string {
  const v = (value ?? "").trim();
  if (!v) return "General";
  if ((QUOTE_DEPARTMENT_OPTIONS as readonly string[]).includes(v)) return v;
  return v.slice(0, 80);
}

async function requireStaff() {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, error: "Sign in first." as const };
  if (profile.role === "guest") {
    return { profile: null, error: "Guest access is read-only." as const };
  }
  return { profile, error: null };
}

function mapLines(rows: Record<string, unknown>[]): QuoteLineItem[] {
  return rows.map((r) => ({
    id: String(r.id),
    quote_id: String(r.quote_id),
    label: String(r.label ?? ""),
    quantity: Number(r.quantity) || 1,
    list_unit_price: Number(r.list_unit_price) || 0,
    quote_unit_price: Number(r.quote_unit_price) || 0,
    sort_order: Number(r.sort_order) || 0,
  }));
}

async function loadQuoteLines(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quoteId: string,
): Promise<QuoteLineItem[]> {
  const { data } = await supabase
    .from("quote_line_items")
    .select("*")
    .eq("quote_id", quoteId)
    .order("sort_order", { ascending: true });
  return mapLines((data ?? []) as Record<string, unknown>[]);
}

export async function createQuoteAction(input: {
  clientName: string;
  eventName: string;
  eventDate: string;
  department: string;
  notes: string;
}): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };

  const supabase = await createClient();
  const eventDate =
    /^\d{4}-\d{2}-\d{2}$/.test(input.eventDate?.trim() ?? "")
      ? input.eventDate.trim()
      : null;

  const { data, error: insertError } = await supabase
    .from("quotes")
    .insert({
      created_by: profile.id,
      client_name: (input.clientName ?? "").trim().slice(0, 200),
      event_name: (input.eventName ?? "").trim().slice(0, 200),
      event_date: eventDate,
      department: cleanDept(input.department),
      notes: (input.notes ?? "").trim().slice(0, 4000),
      status: "draft",
    })
    .select("id")
    .single();

  if (insertError) {
    if (/quotes|schema cache|does not exist/i.test(insertError.message)) {
      return {
        error:
          "Quoting needs a database update. Run migration 122_quoting.sql in Supabase, then try again.",
      };
    }
    return { error: insertError.message };
  }

  revalidateQuoting(data.id);
  return { error: null, id: data.id as string };
}

export async function updateQuoteMetaAction(input: {
  id: string;
  clientName: string;
  eventName: string;
  eventDate: string;
  department: string;
  notes: string;
}): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("quotes")
    .select("id, created_by, status")
    .eq("id", input.id)
    .maybeSingle();
  if (!existing) return { error: "Quote not found." };
  if (existing.created_by !== profile.id && profile.role !== "admin") {
    return { error: "Not allowed." };
  }
  if (existing.status === "pending_approval" && profile.role !== "admin") {
    return { error: "Quote is locked while approval is pending." };
  }

  const eventDate =
    /^\d{4}-\d{2}-\d{2}$/.test(input.eventDate?.trim() ?? "")
      ? input.eventDate.trim()
      : null;

  const { error: updateError } = await supabase
    .from("quotes")
    .update({
      client_name: (input.clientName ?? "").trim().slice(0, 200),
      event_name: (input.eventName ?? "").trim().slice(0, 200),
      event_date: eventDate,
      department: cleanDept(input.department),
      notes: (input.notes ?? "").trim().slice(0, 4000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (updateError) return { error: updateError.message };
  revalidateQuoting(input.id);
  return { error: null };
}

export async function deleteQuoteAction(id: string): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };

  const supabase = await createClient();
  const { error: delError } = await supabase.from("quotes").delete().eq("id", id);
  if (delError) return { error: delError.message };
  revalidateQuoting();
  return { error: null };
}

export async function upsertQuoteLineAction(input: {
  quoteId: string;
  lineId?: string;
  label: string;
  quantity: string;
  listUnitPrice: string;
  quoteUnitPrice: string;
}): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };

  const label = (input.label ?? "").trim().slice(0, 200);
  if (!label) return { error: "Line description is required." };

  const quantity = Number.parseFloat(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Enter a valid quantity." };
  }
  const listUnit = Number.parseFloat(input.listUnitPrice);
  const quoteUnit = Number.parseFloat(input.quoteUnitPrice);
  if (!Number.isFinite(listUnit) || listUnit < 0) {
    return { error: "Enter a valid list/standard unit price." };
  }
  if (!Number.isFinite(quoteUnit) || quoteUnit < 0) {
    return { error: "Enter a valid quoted unit price." };
  }

  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, created_by, status")
    .eq("id", input.quoteId)
    .maybeSingle();
  if (!quote) return { error: "Quote not found." };
  if (quote.created_by !== profile.id && profile.role !== "admin") {
    return { error: "Not allowed." };
  }
  if (quote.status === "pending_approval" && profile.role !== "admin") {
    return { error: "Quote is locked while approval is pending." };
  }

  const row = {
    quote_id: input.quoteId,
    label,
    quantity: Math.round(quantity * 100) / 100,
    list_unit_price: Math.round(listUnit * 100) / 100,
    quote_unit_price: Math.round(quoteUnit * 100) / 100,
  };

  if (input.lineId) {
    const { error: updateError } = await supabase
      .from("quote_line_items")
      .update({
        label: row.label,
        quantity: row.quantity,
        list_unit_price: row.list_unit_price,
        quote_unit_price: row.quote_unit_price,
      })
      .eq("id", input.lineId)
      .eq("quote_id", input.quoteId);
    if (updateError) return { error: updateError.message };
  } else {
    const lines = await loadQuoteLines(supabase, input.quoteId);
    const { error: insertError } = await supabase.from("quote_line_items").insert({
      quote_id: input.quoteId,
      label: row.label,
      quantity: row.quantity,
      list_unit_price: row.list_unit_price,
      quote_unit_price: row.quote_unit_price,
      sort_order: lines.length,
    });
    if (insertError) return { error: insertError.message };
  }

  // Price edits after ready/denied go back to draft until re-checked.
  if (quote.status === "ready" || quote.status === "denied") {
    await supabase
      .from("quotes")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", input.quoteId);
  } else {
    await supabase
      .from("quotes")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", input.quoteId);
  }

  revalidateQuoting(input.quoteId);
  return { error: null };
}

export async function deleteQuoteLineAction(input: {
  quoteId: string;
  lineId: string;
}): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };

  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, created_by, status")
    .eq("id", input.quoteId)
    .maybeSingle();
  if (!quote) return { error: "Quote not found." };
  if (quote.created_by !== profile.id && profile.role !== "admin") {
    return { error: "Not allowed." };
  }
  if (quote.status === "pending_approval" && profile.role !== "admin") {
    return { error: "Quote is locked while approval is pending." };
  }

  const { error: delError } = await supabase
    .from("quote_line_items")
    .delete()
    .eq("id", input.lineId)
    .eq("quote_id", input.quoteId);
  if (delError) return { error: delError.message };

  if (quote.status === "ready" || quote.status === "denied") {
    await supabase
      .from("quotes")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", input.quoteId);
  } else {
    await supabase
      .from("quotes")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", input.quoteId);
  }

  revalidateQuoting(input.quoteId);
  return { error: null };
}

export async function markQuoteReadyAction(quoteId: string): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };

  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, created_by, status")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return { error: "Quote not found." };
  if (quote.created_by !== profile.id && profile.role !== "admin") {
    return { error: "Not allowed." };
  }
  if (quote.status === "pending_approval") {
    return { error: "Wait for an admin to review the discount first." };
  }

  const lines = await loadQuoteLines(supabase, quoteId);
  if (lines.length === 0) return { error: "Add at least one line item." };

  const summary = summarizeQuoteLines(lines);
  if (summary.needsApproval) {
    const { data: approved } = await supabase
      .from("quote_discount_approvals")
      .select("id, quote_total, lines_snapshot, status")
      .eq("quote_id", quoteId)
      .eq("status", "approved")
      .order("reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const covered =
      approved &&
      summary.quoteTotal + 0.009 >= Number(approved.quote_total) &&
      approvalCoversLines(
        (approved.lines_snapshot as unknown[]) ?? [],
        lines,
      );

    if (!covered) {
      return {
        error:
          "This quote drops list pricing by more than 20% on a line or the total. Request admin approval before continuing.",
      };
    }
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ status: "ready" satisfies QuoteStatus, updated_at: new Date().toISOString() })
    .eq("id", quoteId);
  if (updateError) return { error: updateError.message };

  revalidateQuoting(quoteId);
  return { error: null };
}

function approvalCoversLines(
  snapshot: unknown[],
  current: QuoteLineItem[],
): boolean {
  // Approved snapshot must have the same labels/qty and quote prices no higher
  // discount than currently (i.e. current quoted unit >= approved quoted unit).
  if (!Array.isArray(snapshot) || snapshot.length !== current.length) return false;
  const byKey = new Map<string, { quantity: number; quote_unit_price: number }>();
  for (const raw of snapshot) {
    if (!raw || typeof raw !== "object") return false;
    const row = raw as Record<string, unknown>;
    const label = String(row.label ?? "").trim().toLowerCase();
    byKey.set(`${label}|${Number(row.quantity)}`, {
      quantity: Number(row.quantity) || 0,
      quote_unit_price: Number(row.quote_unit_price) || 0,
    });
  }
  for (const line of current) {
    const key = `${line.label.trim().toLowerCase()}|${line.quantity}`;
    const prev = byKey.get(key);
    if (!prev) return false;
    // Current is "worse" (cheaper for client) than approved → not covered.
    if (line.quote_unit_price < prev.quote_unit_price - 0.009) return false;
  }
  return true;
}

export async function requestQuoteDiscountApprovalAction(input: {
  quoteId: string;
  reason: string;
}): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };

  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, created_by, client_name, status")
    .eq("id", input.quoteId)
    .maybeSingle();
  if (!quote) return { error: "Quote not found." };
  if (quote.created_by !== profile.id && profile.role !== "admin") {
    return { error: "Not allowed." };
  }

  const lines = await loadQuoteLines(supabase, input.quoteId);
  if (lines.length === 0) return { error: "Add at least one line item." };
  const summary = summarizeQuoteLines(lines);
  if (!summary.needsApproval) {
    return {
      error:
        "No >20% decrease on a line or total — you can mark this quote ready without approval.",
    };
  }

  // Collapse any prior pending requests.
  await supabase
    .from("quote_discount_approvals")
    .update({
      status: "denied",
      review_note: "Superseded by a new request",
      reviewed_at: new Date().toISOString(),
    })
    .eq("quote_id", input.quoteId)
    .eq("status", "pending");

  const { data: created, error: insertError } = await supabase
    .from("quote_discount_approvals")
    .insert({
      quote_id: input.quoteId,
      requested_by: profile.id,
      reason: (input.reason ?? "").trim().slice(0, 1000),
      list_total: summary.listTotal,
      quote_total: summary.quoteTotal,
      total_decrease_pct: summary.totalDecreasePct,
      line_breaches: summary.lineBreaches,
      lines_snapshot: lines,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError) return { error: insertError.message };

  await supabase
    .from("quotes")
    .update({
      status: "pending_approval",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.quoteId);

  try {
    await supabase.rpc("notify_admins_of_quote_discount", {
      p_approval_id: created.id,
    });
    const { data: admins } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "admin");
    const emails = (admins ?? []).map((a) => a.email as string).filter(Boolean);
    await sendEmail({
      to: emails,
      subject: `Quote discount approval — ${quote.client_name || "Untitled"}`,
      text:
        `${profile.full_name} requested approval for a >20% discount on quote ${quote.client_name || input.quoteId}.\n` +
        `List ${summary.listTotal} → quoted ${summary.quoteTotal}.\n` +
        (input.reason ? `\nReason: ${input.reason}\n` : "") +
        `\nReview in the Hub under Quoting.`,
    });
  } catch {
    // non-critical
  }

  revalidateQuoting(input.quoteId);
  return { error: null, id: created.id as string };
}

export async function reviewQuoteDiscountApprovalAction(input: {
  approvalId: string;
  decision: "approved" | "denied";
  reviewNote?: string;
}): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };
  if (profile.role !== "admin") {
    return { error: "Only admins can review quote discounts." };
  }
  if (input.decision !== "approved" && input.decision !== "denied") {
    return { error: "Invalid decision." };
  }

  const supabase = await createClient();
  const { data: approval } = await supabase
    .from("quote_discount_approvals")
    .select("*")
    .eq("id", input.approvalId)
    .maybeSingle();
  if (!approval) return { error: "Approval request not found." };
  if (approval.status !== "pending") {
    return { error: "This request was already reviewed." };
  }

  const { error: updateError } = await supabase
    .from("quote_discount_approvals")
    .update({
      status: input.decision,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      review_note: (input.reviewNote ?? "").trim().slice(0, 500),
    })
    .eq("id", input.approvalId);
  if (updateError) return { error: updateError.message };

  const nextStatus: QuoteStatus =
    input.decision === "approved" ? "ready" : "denied";
  await supabase
    .from("quotes")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", approval.quote_id);

  try {
    const { data: quote } = await supabase
      .from("quotes")
      .select("created_by, client_name")
      .eq("id", approval.quote_id)
      .maybeSingle();
    if (quote?.created_by) {
      const word = input.decision === "approved" ? "approved" : "denied";
      await insertNotifications(supabase, [
        {
          userId: quote.created_by as string,
          kind: "quoting",
          title: `Quote discount ${word}`,
          body: `Your discount request on ${quote.client_name || "a quote"} was ${word}.`,
          href: `/quoting/${approval.quote_id}`,
        },
      ]);
    }
  } catch {
    // non-critical
  }

  revalidateQuoting(String(approval.quote_id));
  return { error: null };
}

export async function saveQuotePricingNoteAction(input: {
  id?: string;
  department: string;
  title: string;
  body: string;
  sortOrder?: string;
}): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };

  const title = (input.title ?? "").trim().slice(0, 200);
  if (!title) return { error: "Title is required." };
  const body = (input.body ?? "").trim().slice(0, 8000);
  const sortOrder = Number.parseInt(input.sortOrder ?? "0", 10);
  const department = cleanDept(input.department);

  const supabase = await createClient();
  if (input.id) {
    const { error: updateError } = await supabase
      .from("quote_pricing_notes")
      .update({
        department,
        title,
        body,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);
    if (updateError) return { error: updateError.message };
  } else {
    const { data, error: insertError } = await supabase
      .from("quote_pricing_notes")
      .insert({
        department,
        title,
        body,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("id")
      .single();
    if (insertError) {
      if (/quote_pricing_notes|schema cache|does not exist/i.test(insertError.message)) {
        return {
          error:
            "Quoting needs a database update. Run migration 122_quoting.sql in Supabase, then try again.",
        };
      }
      return { error: insertError.message };
    }
    revalidateQuoting();
    return { error: null, id: data.id as string };
  }

  revalidateQuoting();
  return { error: null };
}

export async function deleteQuotePricingNoteAction(id: string): Promise<Result> {
  const { profile, error } = await requireStaff();
  if (error || !profile) return { error: error ?? "Sign in first." };

  const supabase = await createClient();
  const { error: delError } = await supabase
    .from("quote_pricing_notes")
    .delete()
    .eq("id", id);
  if (delError) return { error: delError.message };
  revalidateQuoting();
  return { error: null };
}
