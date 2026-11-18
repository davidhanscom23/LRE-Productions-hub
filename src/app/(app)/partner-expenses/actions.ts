"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  PARTNERS,
  cleanCategory,
  parseAmountToCents,
  type Partner,
} from "@/lib/partner-expenses/shared";
import { createClient } from "@/lib/supabase/server";

type Result = { error: string | null };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RECEIPT_BYTES = 12 * 1024 * 1024;
const BUCKET = "partner-receipts";

type Ctx = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  partner: Partner;
};

/** Every action re-checks that the caller is one of the two partners. The database enforces it too. */
async function requirePartner(): Promise<Ctx | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_lre_partner");
  if (error) return { error: "Partner expenses is not set up yet." };
  if (data !== "david" && data !== "luke") {
    return { error: "Partner expenses is only for David and Luke." };
  }
  return { supabase, userId: profile.id, partner: data };
}

function refresh() {
  revalidatePath("/partner-expenses");
  revalidatePath("/partner-expenses/activity");
}

function receiptExtension(fileName: string, contentType: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (/^(jpe?g|png|webp|pdf|heic|heif)$/.test(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("heic")) return "heic";
  return "jpg";
}

async function uploadReceipt(
  ctx: Ctx,
  expenseId: string,
  file: File,
): Promise<{ error: string | null; path?: string; name?: string }> {
  if (file.size <= 0) return { error: "The receipt file is empty." };
  if (file.size > MAX_RECEIPT_BYTES) {
    return { error: "A receipt must be 12 MB or smaller." };
  }
  const type = (file.type || "").toLowerCase();
  const okType =
    type === "application/pdf" ||
    /^image\/(jpeg|png|webp|heic|heif)$/.test(type) ||
    /\.(jpe?g|png|webp|pdf|heic|heif)$/i.test(file.name);
  if (!okType) return { error: "Upload a photo (JPG, PNG, WEBP, HEIC) or a PDF." };

  const path = `${expenseId}/${randomUUID()}.${receiptExtension(file.name, type)}`;
  const contentType =
    type === "application/pdf" || type.startsWith("image/")
      ? type
      : "application/octet-stream";
  const { error } = await ctx.supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType,
      upsert: false,
      cacheControl: "31536000",
    });
  if (error) return { error: "The receipt could not be uploaded. Try again." };
  return { error: null, path, name: file.name.slice(0, 200) };
}

type Fields = {
  paid_by: Partner;
  amount_cents: number;
  description: string;
  category: string;
  expense_date: string;
  note: string;
};

function readFields(formData: FormData): Fields | { error: string } {
  const paidBy = String(formData.get("paid_by") ?? "");
  if (!PARTNERS.includes(paidBy as Partner)) {
    return { error: "Pick whose expense this is: David or Luke." };
  }
  const cents = parseAmountToCents(String(formData.get("amount") ?? ""));
  if (cents === null) {
    return { error: "Enter an amount greater than zero, like 49.99." };
  }
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "Add a short description." };
  if (description.length > 140) return { error: "Keep the description under 140 characters." };
  const date = String(formData.get("expense_date") ?? "").trim();
  if (!ISO_DATE.test(date)) return { error: "Pick the date of the expense." };
  const note = String(formData.get("note") ?? "").trim();
  if (note.length > 300) return { error: "Keep the note under 300 characters." };
  return {
    paid_by: paidBy as Partner,
    amount_cents: cents,
    description,
    category: cleanCategory(String(formData.get("category") ?? "other")),
    expense_date: date,
    note,
  };
}

function receiptFile(formData: FormData): File | null {
  const f = formData.get("receipt");
  return f instanceof File && f.size > 0 ? f : null;
}

export async function addPartnerExpenseAction(formData: FormData): Promise<Result> {
  const ctx = await requirePartner();
  if ("error" in ctx) return ctx;
  const fields = readFields(formData);
  if ("error" in fields) return fields;

  const id = randomUUID();
  let receipt_path = "";
  let receipt_name = "";
  const file = receiptFile(formData);
  if (file) {
    const up = await uploadReceipt(ctx, id, file);
    if (up.error) return { error: up.error };
    receipt_path = up.path ?? "";
    receipt_name = up.name ?? "";
  }

  const { error } = await ctx.supabase.from("partner_expenses").insert({
    id,
    ...fields,
    receipt_path,
    receipt_name,
    created_by: ctx.userId,
  });
  if (error) return { error: "Could not save the expense. Please try again." };
  refresh();
  return { error: null };
}

export async function editPartnerExpenseAction(formData: FormData): Promise<Result> {
  const ctx = await requirePartner();
  if ("error" in ctx) return ctx;
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing expense." };
  const fields = readFields(formData);
  if ("error" in fields) return fields;

  const patch: Record<string, unknown> = { ...fields };
  const file = receiptFile(formData);
  if (file) {
    const up = await uploadReceipt(ctx, id, file);
    if (up.error) return { error: up.error };
    patch.receipt_path = up.path;
    patch.receipt_name = up.name;
  }

  const { data, error } = await ctx.supabase
    .from("partner_expenses")
    .update(patch)
    .eq("id", id)
    .select("id");
  if (error) return { error: "Could not save the changes. Please try again." };
  if (!data?.length) {
    return {
      error:
        "Only the person who entered an expense can edit it, and a voided expense is final.",
    };
  }
  refresh();
  return { error: null };
}

export async function voidPartnerExpenseAction(
  id: string,
  reason: string,
): Promise<Result> {
  const ctx = await requirePartner();
  if ("error" in ctx) return ctx;
  const why = (reason ?? "").trim();
  if (!why) return { error: "Say why you are voiding this expense." };
  if (why.length > 300) return { error: "Keep the reason under 300 characters." };

  const { data, error } = await ctx.supabase
    .from("partner_expenses")
    .update({ voided_at: new Date().toISOString(), void_reason: why })
    .eq("id", id)
    .select("id");
  if (error) return { error: "Could not void the expense. Please try again." };
  if (!data?.length) {
    return { error: "Only the person who entered an expense can void it." };
  }
  refresh();
  return { error: null };
}

export async function setPartnerReimbursedAction(
  id: string,
  reimbursed: boolean,
): Promise<Result> {
  const ctx = await requirePartner();
  if ("error" in ctx) return ctx;
  const { error } = await ctx.supabase.rpc("partner_expense_set_reimbursed", {
    p_id: id,
    p_reimbursed: reimbursed,
  });
  if (error) return { error: error.message || "Could not update." };
  refresh();
  return { error: null };
}

export async function setPartnerFlagAction(
  id: string,
  flagged: boolean,
  note: string,
): Promise<Result> {
  const ctx = await requirePartner();
  if ("error" in ctx) return ctx;
  if (flagged && !(note ?? "").trim()) {
    return { error: "Add a short question or reason for the flag." };
  }
  const { error } = await ctx.supabase.rpc("partner_expense_set_flag", {
    p_id: id,
    p_flagged: flagged,
    p_note: (note ?? "").trim().slice(0, 300),
  });
  if (error) return { error: error.message || "Could not update." };
  refresh();
  return { error: null };
}

export async function verifyAuditLogAction(): Promise<
  | { error: string }
  | { error: null; ok: boolean; rowsChecked: number; firstBadId: number | null }
> {
  const ctx = await requirePartner();
  if ("error" in ctx) return ctx;
  const { data, error } = await ctx.supabase.rpc("partner_audit_verify");
  if (error) return { error: "Could not check the log right now." };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "Could not check the log right now." };
  return {
    error: null,
    ok: Boolean(row.ok),
    rowsChecked: Number(row.rows_checked) || 0,
    firstBadId: row.first_bad_id == null ? null : Number(row.first_bad_id),
  };
}
