"use server";

import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";
import { AV_ERP_TIME_ZONE } from "@/lib/av-erp/datetime";
import {
  AV_JOB_COST_CATEGORIES,
  type AvJobCostCategory,
} from "@/lib/av-erp/margin";

function todayEasternYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AV_ERP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export type CostActionResult = { ok: true } | { ok: false; error: string };

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string) {
  const n = Number(str(formData, key));
  return Number.isFinite(n) ? n : 0;
}

function revalidateCosts(opportunityId?: string) {
  revalidatePath("/rentals/costs");
  revalidatePath("/rentals");
  if (opportunityId) revalidatePath(`/rentals/quotes/${opportunityId}`);
}

export async function createJobCostAction(
  formData: FormData,
): Promise<CostActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const opportunityId = str(formData, "opportunity_id");
  const amount = Math.max(0, num(formData, "amount"));
  if (!opportunityId) return { ok: false, error: "Missing estimate." };
  if (amount <= 0) return { ok: false, error: "Amount must be greater than zero." };

  const categoryRaw = str(formData, "category") || "other";
  const category = (
    AV_JOB_COST_CATEGORIES as readonly string[]
  ).includes(categoryRaw)
    ? (categoryRaw as AvJobCostCategory)
    : "other";

  const supplierId = str(formData, "supplier_id") || null;
  const costDate = str(formData, "cost_date") || todayEasternYmd();

  const taxRaw = str(formData, "tax_amount");
  const taxAmount = taxRaw ? Math.max(0, num(formData, "tax_amount")) : 0;

  const { error: insertError } = await supabase.from("av_job_costs").insert({
    opportunity_id: opportunityId,
    amount,
    tax_amount: taxAmount,
    currency_code: "USD",
    category,
    supplier_id: supplierId,
    description: str(formData, "description"),
    cost_date: costDate,
    created_by: profile.id,
  });
  if (insertError) return { ok: false, error: insertError.message };

  revalidateCosts(opportunityId);
  return { ok: true };
}

export async function deleteJobCostAction(
  formData: FormData,
): Promise<CostActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const id = str(formData, "id");
  const opportunityId = str(formData, "opportunity_id");
  if (!id) return { ok: false, error: "Missing cost." };

  const { data: existing } = await supabase
    .from("av_job_costs")
    .select("booking_id")
    .eq("id", id)
    .maybeSingle();
  if (existing?.booking_id) {
    return {
      ok: false,
      error:
        "This cost is synced from a crew booking. Cancel or remove the booking on Crew instead.",
    };
  }

  const { error: delError } = await supabase
    .from("av_job_costs")
    .delete()
    .eq("id", id);
  if (delError) return { ok: false, error: delError.message };

  revalidateCosts(opportunityId || undefined);
  return { ok: true };
}
