"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { AUTOMATION_KEYS, type AutomationKey } from "@/lib/pipeline/automations";
import { runPipelineAutomations, type AutomationDueItem } from "@/lib/pipeline/automations-run";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;
  return profile;
}

export async function saveAutomationAction(input: {
  key: string;
  enabled: boolean;
  delayDays: number;
  subject: string;
  body: string;
}): Promise<{ error: string | null }> {
  const profile = await requireAdmin();
  if (!profile) return { error: "Admins only." };
  if (!AUTOMATION_KEYS.includes(input.key as AutomationKey)) return { error: "Unknown automation." };
  const subject = input.subject.trim().slice(0, 200);
  const body = input.body.trim().slice(0, 8000);
  if (!subject || !body) return { error: "Subject and message can't be empty." };
  const delay = Math.round(Number(input.delayDays));
  if (!Number.isFinite(delay) || delay < 0 || delay > 730) return { error: "Days must be between 0 and 730." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("pipeline_automations")
    .update({ enabled: input.enabled, delay_days: delay, subject, body, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("key", input.key);
  if (error) return { error: error.message };
  revalidatePath("/pipeline/automations");
  return { error: null };
}

/** Who would get an email if the cron ran right now (nothing is sent). */
export async function previewAutomationsAction(): Promise<{ error: string | null; due: AutomationDueItem[] }> {
  if (!(await requireAdmin())) return { error: "Admins only.", due: [] };
  if (!isServiceRoleConfigured()) return { error: "SUPABASE_SERVICE_ROLE_KEY isn't set.", due: [] };
  const res = await runPipelineAutomations({ dryRun: true });
  return { error: null, due: res.due };
}
