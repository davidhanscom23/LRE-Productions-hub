"use server";

import { randomUUID } from "crypto";
import { getCurrentProfile } from "@/lib/auth/profile";
import { sendEmail } from "@/lib/email/send";
import { insertNotifications } from "@/lib/notifications/notify";
import {
  getEventMediaAccessUrl,
  getEventMediaStorageProvider,
  uploadEventMediaObject,
  type StorageProvider,
} from "@/lib/storage/event-media";
import { createClient } from "@/lib/supabase/server";
import {
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  formatMoney,
  type ExpenseCategory,
} from "@/lib/types/expenses";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

const VALID_CATEGORY = new Set(EXPENSE_CATEGORIES.map((c) => c.value));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RECEIPT_BYTES = 12 * 1024 * 1024;

function cleanCategory(value: string): ExpenseCategory {
  return (VALID_CATEGORY.has(value as ExpenseCategory)
    ? value
    : "other") as ExpenseCategory;
}

function receiptExtension(fileName: string, contentType: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (
    fromName &&
    /^(jpe?g|png|webp|gif|pdf|heic|heif)$/i.test(fromName)
  ) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

async function uploadReceiptFile(options: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  file: File;
}): Promise<{
  error: string | null;
  path?: string;
  provider?: StorageProvider;
  fileName?: string;
  url?: string | null;
}> {
  const { supabase, userId, file } = options;
  if (file.size <= 0) return { error: "Receipt file is empty." };
  if (file.size > MAX_RECEIPT_BYTES) {
    return { error: "Receipt must be 12 MB or smaller." };
  }

  const contentType = (file.type || "application/octet-stream").toLowerCase();
  const allowed =
    contentType.startsWith("image/") ||
    contentType === "application/pdf" ||
    /\.(jpe?g|png|webp|gif|pdf|heic|heif)$/i.test(file.name);
  if (!allowed) {
    return { error: "Upload an image or PDF receipt." };
  }

  const ext = receiptExtension(file.name, contentType);
  const path = `${userId}/expenses/${randomUUID()}.${ext}`;
  const provider = getEventMediaStorageProvider();
  const bytes = Buffer.from(await file.arrayBuffer());

  const upload = await uploadEventMediaObject({
    supabase,
    path,
    bytes,
    contentType: contentType.startsWith("image/")
      ? contentType
      : contentType === "application/pdf"
        ? "application/pdf"
        : "application/octet-stream",
    provider,
  });
  if (upload.error) return { error: upload.error };

  let url: string | null = upload.url;
  if (!url) {
    const access = await getEventMediaAccessUrl({
      supabase,
      path,
      provider: upload.provider,
    });
    url = access.url;
  }

  return {
    error: null,
    path,
    provider: upload.provider,
    fileName: file.name.slice(0, 200),
    url,
  };
}

export async function submitExpenseAction(input: {
  amount: string;
  category: string;
  description: string;
  expenseDate: string;
  receiptUrl: string;
  /** Optional uploaded receipt (image/PDF). */
  receiptFile?: File | null;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const amount = Number.parseFloat(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount." };
  }
  if (amount > 1_000_000) return { error: "That amount looks too large." };
  const expenseDate = ISO_DATE.test(input.expenseDate?.trim() ?? "")
    ? input.expenseDate.trim()
    : null;
  if (!expenseDate) return { error: "Pick the expense date." };

  const supabase = await createClient();

  let receiptStoragePath = "";
  let receiptStorageProvider: StorageProvider = "supabase";
  let receiptFileName = "";
  let receiptUrl = (input.receiptUrl ?? "").trim().slice(0, 500);

  if (input.receiptFile && input.receiptFile.size > 0) {
    const uploaded = await uploadReceiptFile({
      supabase,
      userId: profile.id,
      file: input.receiptFile,
    });
    if (uploaded.error) return { error: uploaded.error };
    receiptStoragePath = uploaded.path ?? "";
    receiptStorageProvider = uploaded.provider ?? "supabase";
    receiptFileName = uploaded.fileName ?? "";
    if (!receiptUrl && uploaded.url) {
      receiptUrl = uploaded.url.slice(0, 500);
    }
  }

  const insertRow: Record<string, unknown> = {
    user_id: profile.id,
    amount: Math.round(amount * 100) / 100,
    category: cleanCategory(input.category),
    description: (input.description ?? "").trim().slice(0, 1000),
    expense_date: expenseDate,
    receipt_url: receiptUrl,
    status: "pending",
    receipt_storage_path: receiptStoragePath,
    receipt_storage_provider: receiptStorageProvider,
    receipt_file_name: receiptFileName,
  };

  let { data: created, error } = await supabase
    .from("expense_requests")
    .insert(insertRow)
    .select("id")
    .single();

  // Migration 065 may not be applied yet — fall back without storage columns.
  if (
    error &&
    (error.message.includes("receipt_storage_path") ||
      error.message.includes("schema cache"))
  ) {
    delete insertRow.receipt_storage_path;
    delete insertRow.receipt_storage_provider;
    delete insertRow.receipt_file_name;
    ({ data: created, error } = await supabase
      .from("expense_requests")
      .insert(insertRow)
      .select("id")
      .single());
    if (!error && receiptStoragePath) {
      // Uploaded file but columns missing — keep external/CDN URL if we have it.
    }
  }
  if (error) return { error: error.message };
  if (!created) return { error: "Could not create expense." };

  try {
    await supabase.rpc("notify_admins_of_expense", {
      p_expense_id: created.id,
    });
    const { data: admins } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "admin");
    const emails = (admins ?? [])
      .map((a) => a.email as string)
      .filter(Boolean);
    await sendEmail({
      to: emails,
      subject: `New expense — ${profile.full_name}`,
      text:
        `${profile.full_name} submitted ${formatMoney(amount)} (${expenseCategoryLabel(cleanCategory(input.category))}) for ${expenseDate}.` +
        (input.description ? `\n\n${input.description}` : "") +
        `\n\nReview it in the hub under Expenses.`,
    });
  } catch {
    // non-critical
  }

  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/for-you");
  return { error: null };
}

export async function deleteExpenseAction(id: string): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_requests")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/for-you");
  return { error: null };
}

export async function reviewExpenseAction(input: {
  id: string;
  decision: "approved" | "denied";
  reviewNote?: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role !== "admin") {
    return { error: "Only admins can review expenses." };
  }
  if (input.decision !== "approved" && input.decision !== "denied") {
    return { error: "Invalid decision." };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("expense_requests")
    .update({
      status: input.decision,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      review_note: (input.reviewNote ?? "").trim().slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select("user_id, amount, category")
    .single();
  if (error) return { error: error.message };

  try {
    const word = input.decision === "approved" ? "approved" : "declined";
    await insertNotifications(supabase, [
      {
        userId: updated.user_id as string,
        kind: "expense",
        title: `Expense ${word}`,
        body: `Your ${formatMoney(Number(updated.amount))} ${expenseCategoryLabel(updated.category as ExpenseCategory)} expense was ${word}.`,
        href: "/expenses",
      },
    ]);
    const { data: subject } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", updated.user_id)
      .maybeSingle();
    if (subject?.email) {
      await sendEmail({
        to: subject.email as string,
        subject: `Your expense was ${word}`,
        text: `Your ${formatMoney(Number(updated.amount))} expense was ${word}.`,
      });
    }
  } catch {
    // non-critical
  }

  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/for-you");
  return { error: null };
}

export async function markReimbursedAction(id: string): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role !== "admin") {
    return { error: "Only admins can mark reimbursed." };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("expense_requests")
    .update({ reimbursed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("user_id, amount")
    .single();
  if (error) return { error: error.message };

  try {
    await insertNotifications(supabase, [
      {
        userId: updated.user_id as string,
        kind: "expense",
        title: "Expense reimbursed",
        body: `Your ${formatMoney(Number(updated.amount))} expense has been marked reimbursed.`,
        href: "/expenses",
      },
    ]);
    const { data: subject } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", updated.user_id)
      .maybeSingle();
    if (subject?.email) {
      await sendEmail({
        to: subject.email as string,
        subject: "Your expense was reimbursed",
        text: `Your ${formatMoney(Number(updated.amount))} expense has been marked reimbursed.`,
      });
    }
  } catch {
    // non-critical
  }

  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/for-you");
  return { error: null };
}
