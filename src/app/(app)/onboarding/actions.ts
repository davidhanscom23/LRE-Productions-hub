"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_ONBOARDING_ITEMS,
  ONBOARDING_CATEGORIES,
  type OnboardingCategory,
} from "@/lib/types/onboarding";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

const VALID_CATEGORY = new Set(ONBOARDING_CATEGORIES.map((c) => c.value));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, error: "Sign in first." as const };
  if (profile.role !== "admin") {
    return { profile: null, error: "Admins only." as const };
  }
  return { profile, error: null as string | null };
}

function cleanCategory(v: string): OnboardingCategory {
  return (VALID_CATEGORY.has(v as OnboardingCategory)
    ? v
    : "other") as OnboardingCategory;
}

export async function createPlanAction(input: {
  subjectName: string;
  profileId: string | null;
  roleTitle: string;
  startDate: string;
}): Promise<Result> {
  const { profile, error: authErr } = await requireAdmin();
  if (authErr || !profile) return { error: authErr };
  const subjectName = input.subjectName?.trim();
  if (!subjectName) return { error: "Enter the new hire’s name." };
  const startDate = ISO_DATE.test(input.startDate?.trim() ?? "")
    ? input.startDate.trim()
    : null;

  const supabase = await createClient();
  const { data: plan, error } = await supabase
    .from("onboarding_plans")
    .insert({
      subject_name: subjectName.slice(0, 200),
      profile_id: input.profileId?.trim() || null,
      role_title: (input.roleTitle ?? "").trim().slice(0, 200),
      start_date: startDate,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const items = DEFAULT_ONBOARDING_ITEMS.map((it, i) => ({
    plan_id: plan.id,
    label: it.label,
    category: it.category,
    sort_order: i,
  }));
  await supabase.from("onboarding_items").insert(items);

  revalidatePath("/onboarding");
  revalidatePath("/for-you");
  return { error: null };
}

export async function addItemAction(input: {
  planId: string;
  label: string;
  category: string;
  sortOrder: number;
}): Promise<Result> {
  const { error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };
  const label = input.label?.trim();
  if (!label) return { error: "Enter a task." };

  const supabase = await createClient();
  const { error } = await supabase.from("onboarding_items").insert({
    plan_id: input.planId,
    label: label.slice(0, 300),
    category: cleanCategory(input.category),
    sort_order: input.sortOrder ?? 999,
  });
  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { error: null };
}

export async function toggleItemAction(input: {
  id: string;
  done: boolean;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const supabase = await createClient();

  if (profile.role === "admin") {
    const { error } = await supabase
      .from("onboarding_items")
      .update({
        is_done: input.done,
        done_at: input.done ? new Date().toISOString() : null,
        done_by: input.done ? profile.id : null,
      })
      .eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.rpc("toggle_my_onboarding_item", {
      p_item_id: input.id,
      p_done: input.done,
    });
    if (error) {
      return {
        error: error.message.includes("toggle_my_onboarding_item")
          ? "Run migration 066_onboarding_subject_reviews_managers.sql, then retry."
          : error.message,
      };
    }
    const payload = data as { error?: string; ok?: boolean } | null;
    if (payload?.error) {
      return {
        error:
          payload.error === "forbidden"
            ? "You can only update your own onboarding checklist."
            : payload.error,
      };
    }
  }

  revalidatePath("/onboarding");
  revalidatePath("/for-you");
  return { error: null };
}

export async function deleteItemAction(id: string): Promise<Result> {
  const { error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };
  const supabase = await createClient();
  const { error } = await supabase.from("onboarding_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { error: null };
}

export async function setPlanStatusAction(input: {
  planId: string;
  status: "active" | "complete" | "archived";
}): Promise<Result> {
  const { error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };
  const supabase = await createClient();
  const { error } = await supabase
    .from("onboarding_plans")
    .update({ status: input.status })
    .eq("id", input.planId);
  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { error: null };
}

export async function deletePlanAction(planId: string): Promise<Result> {
  const { error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };
  const supabase = await createClient();
  const { error } = await supabase
    .from("onboarding_plans")
    .delete()
    .eq("id", planId);
  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { error: null };
}
