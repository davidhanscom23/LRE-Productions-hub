import { AutomationsClient, type AutomationRow } from "@/components/pipeline/automations-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { AUTOMATION_KEYS, type AutomationKey } from "@/lib/pipeline/automations";
import { isEmailConfigured } from "@/lib/email/send";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PipelineAutomationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/pipeline");
  const supabase = await createClient();
  const { data, error } = await supabase.from("pipeline_automations").select("key, enabled, delay_days, subject, body");
  const rows = AUTOMATION_KEYS.map((k) => (data ?? []).find((r) => r.key === k))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({ ...r, key: r.key as AutomationKey })) as AutomationRow[];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <a href="/pipeline" className="text-xs text-[var(--muted)] underline">← Pipeline</a>
        <h1 className="text-xl font-semibold">Client email automations</h1>
        <p className="text-sm text-[var(--muted)]">
          Emails the Hub sends for you once a day. Every automation starts Off. Each client gets each email once, and only when it became due in the last two weeks, so turning one on never emails old events.
        </p>
      </div>
      {error || rows.length === 0 ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Automations need migration 179_pipeline_automations.sql. {error?.message ?? ""}
        </p>
      ) : (
        <AutomationsClient rows={rows} emailReady={isEmailConfigured()} />
      )}
    </div>
  );
}
