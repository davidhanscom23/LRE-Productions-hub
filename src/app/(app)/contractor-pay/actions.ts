"use server";

import { randomUUID } from "crypto";
import { getCurrentProfile } from "@/lib/auth/profile";
import { sendEmail } from "@/lib/email/send";
import { insertNotifications } from "@/lib/notifications/notify";
import {
  getEventMediaAccessUrl,
  getEventMediaStorageProvider,
  uploadEventMediaObject,
} from "@/lib/storage/event-media";
import { createClient } from "@/lib/supabase/server";
import {
  CONTRACTOR_1099_ACK_TEXT,
  CONTRACTOR_PAY_CATEGORIES,
  contractorPayCategoryLabel,
  currentTaxYear,
  formatContractorMoney,
  type ContractorPayCategory,
} from "@/lib/types/contractor-pay";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

const VALID_CATEGORY = new Set(CONTRACTOR_PAY_CATEGORIES.map((c) => c.value));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_W9_BYTES = 12 * 1024 * 1024;

function cleanCategory(value: string): ContractorPayCategory {
  return (VALID_CATEGORY.has(value as ContractorPayCategory)
    ? value
    : "other") as ContractorPayCategory;
}

function revalidateContractorPay() {
  revalidatePath("/contractor-pay");
  revalidatePath("/");
  revalidatePath("/for-you");
}

export async function submitContractorPaymentAction(input: {
  amount: string;
  category: string;
  description: string;
  workDate: string;
  eventName: string;
  hours: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const amount = Number.parseFloat(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount." };
  }
  if (amount > 1_000_000) return { error: "That amount looks too large." };

  const workDate = ISO_DATE.test(input.workDate?.trim() ?? "")
    ? input.workDate.trim()
    : null;
  if (!workDate) return { error: "Pick the work date." };

  let hours: number | null = null;
  const hoursRaw = (input.hours ?? "").trim();
  if (hoursRaw) {
    const h = Number.parseFloat(hoursRaw);
    if (!Number.isFinite(h) || h < 0 || h > 500) {
      return { error: "Enter valid hours (0–500) or leave blank." };
    }
    hours = Math.round(h * 100) / 100;
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("contractor_payment_requests")
    .insert({
      user_id: profile.id,
      amount: Math.round(amount * 100) / 100,
      category: cleanCategory(input.category),
      description: (input.description ?? "").trim().slice(0, 1000),
      work_date: workDate,
      event_name: (input.eventName ?? "").trim().slice(0, 200),
      hours,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    if (/contractor_payment_requests|schema cache|does not exist/i.test(error.message)) {
      return {
        error:
          "Contractor Pay needs a database update. Run migration 121_contractor_pay.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }
  if (!created) return { error: "Could not create payment request." };

  try {
    await supabase.rpc("notify_admins_of_contractor_payment", {
      p_payment_id: created.id,
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
      subject: `Contractor payment — ${profile.full_name}`,
      text:
        `${profile.full_name} submitted ${formatContractorMoney(amount)} (${contractorPayCategoryLabel(cleanCategory(input.category))}) for ${workDate}.` +
        (input.eventName ? `\nEvent: ${input.eventName}` : "") +
        (input.description ? `\n\n${input.description}` : "") +
        `\n\nReview it in the hub under Contractor Pay.`,
    });
  } catch {
    // non-critical
  }

  revalidateContractorPay();
  return { error: null };
}

export async function deleteContractorPaymentAction(
  id: string,
): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("contractor_payment_requests")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateContractorPay();
  return { error: null };
}

export async function reviewContractorPaymentAction(input: {
  id: string;
  decision: "approved" | "denied";
  reviewNote?: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role !== "admin") {
    return { error: "Only admins can review contractor payments." };
  }
  if (input.decision !== "approved" && input.decision !== "denied") {
    return { error: "Invalid decision." };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("contractor_payment_requests")
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
        kind: "contractor_pay",
        title: `Payment ${word}`,
        body: `Your ${formatContractorMoney(Number(updated.amount))} ${contractorPayCategoryLabel(updated.category as ContractorPayCategory)} payment was ${word}.`,
        href: "/contractor-pay",
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
        subject: `Your contractor payment was ${word}`,
        text: `Your ${formatContractorMoney(Number(updated.amount))} payment was ${word}.`,
      });
    }
  } catch {
    // non-critical
  }

  revalidateContractorPay();
  return { error: null };
}

export async function markContractorPaymentPaidAction(
  id: string,
): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role !== "admin") {
    return { error: "Only admins can mark payments paid." };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("contractor_payment_requests")
    .update({
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("user_id, amount")
    .single();
  if (error) return { error: error.message };

  try {
    await insertNotifications(supabase, [
      {
        userId: updated.user_id as string,
        kind: "contractor_pay",
        title: "Payment marked paid",
        body: `Your ${formatContractorMoney(Number(updated.amount))} contractor payment has been marked paid.`,
        href: "/contractor-pay",
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
        subject: "Your contractor payment was marked paid",
        text: `Your ${formatContractorMoney(Number(updated.amount))} payment has been marked paid.`,
      });
    }
  } catch {
    // non-critical
  }

  revalidateContractorPay();
  return { error: null };
}

export async function signContractor1099Action(input: {
  signerName: string;
  signerEmail: string;
  signatureData: string;
  taxYear?: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const name = input.signerName.trim();
  if (!name) return { error: "Full name is required." };
  if (!input.signatureData?.startsWith("data:image/")) {
    return { error: "A drawn signature is required." };
  }

  const taxYear = input.taxYear ?? currentTaxYear();
  if (taxYear < 2020 || taxYear > 2100) {
    return { error: "Invalid tax year." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contractor_1099_acknowledgements").upsert(
    {
      user_id: profile.id,
      tax_year: taxYear,
      signer_name: name,
      signer_email: (input.signerEmail ?? "").trim().slice(0, 200),
      signature_data: input.signatureData,
      acknowledgment: CONTRACTOR_1099_ACK_TEXT,
      ip_address: input.ipAddress?.trim() || null,
      user_agent: input.userAgent?.slice(0, 240) || null,
      signed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,tax_year" },
  );

  if (error) {
    if (/contractor_1099|schema cache|does not exist/i.test(error.message)) {
      return {
        error:
          "Contractor Pay needs a database update. Run migration 121_contractor_pay.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }

  revalidateContractorPay();
  return { error: null };
}

function w9Extension(fileName: string, contentType: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (fromName && /^(jpe?g|png|webp|gif|pdf|heic|heif)$/i.test(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

export async function uploadContractorW9Action(input: {
  file: File;
  taxYear?: number;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const file = input.file;
  if (!file || file.size <= 0) return { error: "Choose a W-9 file." };
  if (file.size > MAX_W9_BYTES) {
    return { error: "W-9 must be 12 MB or smaller." };
  }

  const contentType = (file.type || "application/octet-stream").toLowerCase();
  const allowed =
    contentType.startsWith("image/") ||
    contentType === "application/pdf" ||
    /\.(jpe?g|png|webp|gif|pdf|heic|heif)$/i.test(file.name);
  if (!allowed) {
    return { error: "Upload a PDF or image of your W-9." };
  }

  const taxYear = input.taxYear ?? currentTaxYear();
  const supabase = await createClient();
  const ext = w9Extension(file.name, contentType);
  const path = `${profile.id}/contractor-w9/${taxYear}-${randomUUID()}.${ext}`;
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

  const { error } = await supabase.from("contractor_w9_files").insert({
    user_id: profile.id,
    tax_year: taxYear,
    storage_path: path,
    storage_provider: upload.provider ?? provider,
    file_name: file.name.slice(0, 200),
    content_type:
      contentType.startsWith("image/") || contentType === "application/pdf"
        ? contentType
        : "application/octet-stream",
  });

  if (error) {
    if (/contractor_w9|schema cache|does not exist/i.test(error.message)) {
      return {
        error:
          "Contractor Pay needs a database update. Run migration 121_contractor_pay.sql in Supabase, then try again.",
      };
    }
    return { error: error.message };
  }

  revalidateContractorPay();
  return { error: null };
}

export async function getContractorW9AccessUrlAction(
  id: string,
): Promise<{ error: string | null; url?: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_w9_files")
    .select("user_id, storage_path, storage_provider")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "W-9 not found." };
  if (data.user_id !== profile.id && profile.role !== "admin") {
    return { error: "Not allowed." };
  }

  const provider = String(data.storage_provider ?? "supabase");
  const access = await getEventMediaAccessUrl({
    supabase,
    path: String(data.storage_path),
    provider:
      provider === "bunny" || provider === "supabase" ? provider : "supabase",
    expiresIn: 3600,
  });
  return { error: null, url: access.url };
}

