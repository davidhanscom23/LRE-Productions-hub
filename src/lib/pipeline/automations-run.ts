import "server-only";

import { isEmailConfigured, sendEmailDetailed } from "@/lib/email/send";
import {
  AUTOMATION_KEYS,
  MAX_SENDS_PER_RUN,
  isAutomationDue,
  type AutomationKey,
} from "@/lib/pipeline/automations";
import { pipelineStageMatchKey } from "@/lib/pipeline/pipeline-board";
import {
  applyMergeFields,
  firstNameOf,
  textToEmailHtml,
} from "@/lib/pipeline/project-email";
import { createServiceClient } from "@/lib/supabase/admin";

export type AutomationDueItem = {
  key: AutomationKey;
  projectId: string;
  projectName: string;
  to: string;
};

export type AutomationRunSummary = {
  ok: boolean;
  emailConfigured: boolean;
  due: AutomationDueItem[];
  sent: number;
  failed: number;
  skipped: number;
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" }).format(
        new Date(`${iso}T00:00:00Z`),
      )
    : "";

/**
 * Work out (and unless dryRun, send) every automation that is due today.
 * Safety: each automation only ever sends once per project (unique run row inserted BEFORE
 * sending), only for things that became due in the last 14 days, and at most 25 per run.
 */
export async function runPipelineAutomations(opts: { dryRun?: boolean; now?: Date } = {}): Promise<AutomationRunSummary> {
  const db = createServiceClient();
  const today = (opts.now ?? new Date()).toISOString().slice(0, 10);
  const summary: AutomationRunSummary = {
    ok: true,
    emailConfigured: isEmailConfigured(),
    due: [],
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  const { data: autos } = await db.from("pipeline_automations").select("*").eq("enabled", true);
  const enabled = (autos ?? []).filter((a) => AUTOMATION_KEYS.includes(a.key as AutomationKey));
  if (!enabled.length) return summary;

  const { data: projects } = await db
    .from("pipeline_projects")
    .select("id, name, stage, booked_at, project_date, record_type, merged_into, client_id")
    .limit(5000);
  const all = projects ?? [];

  const clientIds = [...new Set(all.map((p) => p.client_id as string | null).filter((v): v is string => !!v))];
  const clients = new Map<string, { email: string; full_name: string }>();
  for (let i = 0; i < clientIds.length; i += 500) {
    const { data } = await db
      .from("pipeline_clients")
      .select("id, email, full_name")
      .in("id", clientIds.slice(i, i + 500));
    for (const c of data ?? []) clients.set(c.id as string, { email: String(c.email ?? ""), full_name: String(c.full_name ?? "") });
  }

  // When each Proposal Sent project last entered that stage.
  const proposalSent = new Map<string, string>();
  if (enabled.some((a) => a.key === "proposal_nudge")) {
    const ids = all.filter((p) => pipelineStageMatchKey(p.stage as string) === "proposal sent").map((p) => p.id as string);
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await db
        .from("pipeline_project_stage_events")
        .select("project_id, to_stage, created_at")
        .in("project_id", ids.slice(i, i + 200))
        .order("created_at", { ascending: true });
      for (const e of data ?? []) {
        if (pipelineStageMatchKey(e.to_stage as string) === "proposal sent") {
          proposalSent.set(e.project_id as string, String(e.created_at));
        }
      }
    }
  }

  for (const auto of enabled) {
    const key = auto.key as AutomationKey;
    const candidates = all.filter((p) =>
      isAutomationDue(
        key,
        Number(auto.delay_days),
        {
          stage: p.stage as string | null,
          booked_at: p.booked_at as string | null,
          project_date: p.project_date as string | null,
          record_type: p.record_type as string | null,
          merged_into: p.merged_into as string | null,
        },
        today,
        proposalSent.get(p.id as string) ?? null,
      ),
    );
    if (!candidates.length) continue;

    const { data: done } = await db
      .from("pipeline_automation_runs")
      .select("project_id")
      .eq("automation_key", key)
      .in("project_id", candidates.map((c) => c.id as string));
    const already = new Set((done ?? []).map((r) => r.project_id as string));

    let count = 0;
    for (const p of candidates) {
      if (already.has(p.id as string)) continue;
      const client = p.client_id ? clients.get(p.client_id as string) : undefined;
      const to = client?.email?.trim() ?? "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        summary.skipped++;
        continue;
      }
      if (count >= MAX_SENDS_PER_RUN) break;
      count++;
      summary.due.push({ key, projectId: p.id as string, projectName: String(p.name ?? ""), to });
      if (opts.dryRun || !summary.emailConfigured) continue;

      // Claim the slot first so a retry or a second cron can never double-send.
      const { error: claimErr } = await db
        .from("pipeline_automation_runs")
        .insert({ automation_key: key, project_id: p.id, sent_to: to, status: "sent" });
      if (claimErr) {
        summary.skipped++;
        continue;
      }
      const ctx = {
        firstName: firstNameOf(client?.full_name),
        projectName: String(p.name ?? ""),
        eventDate: fmtDate(p.project_date as string | null),
        location: "",
        senderName: "The LRE Productions team",
        projectLink: "",
      };
      const subject = applyMergeFields(String(auto.subject), ctx);
      const text = applyMergeFields(String(auto.body), ctx);
      const res = await sendEmailDetailed({
        to,
        subject,
        text,
        html: textToEmailHtml(text),
        replyTo: process.env.AUTOMATION_REPLY_TO?.trim() || "hello@lreproductions.com",
      });
      if (!res.ok) {
        // Release the slot so tomorrow's run can try again (still inside the catch-up window).
        await db.from("pipeline_automation_runs").delete().eq("automation_key", key).eq("project_id", p.id);
        summary.failed++;
        summary.ok = false;
        continue;
      }
      summary.sent++;
      await db.from("pipeline_project_notes").insert({
        project_id: p.id,
        source: "system",
        category: "email",
        body: `Automatic email sent to ${to}: "${subject}"`,
      });
    }
  }
  return summary;
}
