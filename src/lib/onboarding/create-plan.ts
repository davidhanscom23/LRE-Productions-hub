import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ONBOARDING_ITEMS } from "@/lib/types/onboarding";

export async function createOnboardingPlanForHire(options: {
  supabase: SupabaseClient;
  createdBy: string;
  subjectName: string;
  roleTitle?: string;
  startDate?: string | null;
  profileId?: string | null;
  candidateId: string;
}): Promise<{ planId: string | null; created: boolean; error: string | null }> {
  const {
    supabase,
    createdBy,
    subjectName,
    roleTitle = "",
    startDate = null,
    profileId = null,
    candidateId,
  } = options;

  const { data: existing } = await supabase
    .from("onboarding_plans")
    .select("id, profile_id")
    .eq("candidate_id", candidateId)
    .maybeSingle();
  if (existing?.id) {
    if (profileId && !existing.profile_id) {
      await supabase
        .from("onboarding_plans")
        .update({ profile_id: profileId })
        .eq("id", existing.id);
    }
    return { planId: existing.id, created: false, error: null };
  }

  const { data: plan, error } = await supabase
    .from("onboarding_plans")
    .insert({
      subject_name: subjectName.trim().slice(0, 200),
      profile_id: profileId?.trim() || null,
      role_title: roleTitle.trim().slice(0, 200),
      start_date: startDate,
      created_by: createdBy,
      candidate_id: candidateId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: again } = await supabase
        .from("onboarding_plans")
        .select("id")
        .eq("candidate_id", candidateId)
        .maybeSingle();
      return { planId: again?.id ?? null, created: false, error: null };
    }
    return { planId: null, created: false, error: error.message };
  }

  const items = DEFAULT_ONBOARDING_ITEMS.map((it, i) => ({
    plan_id: plan.id,
    label: it.label,
    category: it.category,
    sort_order: i,
  }));
  await supabase.from("onboarding_items").insert(items);

  // Auto-check "Send hub invite" when we already linked/invited a profile.
  if (profileId) {
    const inviteLabel = DEFAULT_ONBOARDING_ITEMS.find((it) =>
      /hub invite/i.test(it.label),
    )?.label;
    if (inviteLabel) {
      await supabase
        .from("onboarding_items")
        .update({
          is_done: true,
          done_at: new Date().toISOString(),
          done_by: createdBy,
        })
        .eq("plan_id", plan.id)
        .eq("label", inviteLabel);
    }
  }

  return { planId: plan.id, created: true, error: null };
}
