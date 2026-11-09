import { OnboardingClient } from "@/components/onboarding/onboarding-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type {
  OnboardingItem,
  OnboardingPlan,
} from "@/lib/types/onboarding";
import type { StaffOption } from "@/lib/types/action-items";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  const planQuery = isAdmin
    ? supabase
        .from("onboarding_plans")
        .select("*")
        .order("created_at", { ascending: false })
    : supabase
        .from("onboarding_plans")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false });

  const { data: planRows, error } = await planQuery;

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Onboarding needs a database update</p>
        <p className="mt-2">
          Run migration <code>057_onboarding.sql</code>
          {!isAdmin ? " and 066_onboarding_subject_reviews_managers.sql" : ""} in
          Supabase, then refresh. ({error.message})
        </p>
      </div>
    );
  }

  if (!isAdmin && (!planRows || planRows.length === 0)) {
    redirect("/");
  }

  const planIds = ((planRows ?? []) as OnboardingPlan[]).map((p) => p.id);
  const { data: itemRows } = planIds.length
    ? await supabase
        .from("onboarding_items")
        .select("*")
        .in("plan_id", planIds)
        .order("sort_order", { ascending: true })
    : { data: [] as OnboardingItem[] };

  const itemsByPlan = new Map<string, OnboardingItem[]>();
  for (const r of (itemRows ?? []) as OnboardingItem[]) {
    const list = itemsByPlan.get(r.plan_id) ?? [];
    list.push(r);
    itemsByPlan.set(r.plan_id, list);
  }

  const plans: OnboardingPlan[] = ((planRows ?? []) as OnboardingPlan[]).map(
    (p) => ({ ...p, items: itemsByPlan.get(p.id) ?? [] }),
  );

  let staffOptions: StaffOption[] = [];
  if (isAdmin) {
    const { data: staff } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name", { ascending: true });
    staffOptions = (staff ?? [])
      .filter((s) => (s.full_name as string)?.trim())
      .map((s) => ({ id: s.id as string, full_name: s.full_name as string }));
  }

  return (
    <OnboardingClient
      plans={plans}
      staff={staffOptions}
      isAdmin={isAdmin}
    />
  );
}
