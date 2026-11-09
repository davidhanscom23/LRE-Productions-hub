import "server-only";

import { insertNotifications } from "@/lib/notifications/notify";
import { isSmsConfigured, normalizePhone, sendSms } from "@/lib/sms/twilio";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  ALERT_WINDOW_HOURS,
  alertBody,
  alertSms,
  alertTitle,
  isDueNow,
  isStale,
} from "./due";
import { passTotals } from "./progress";
import type { ChecklistPass } from "./types";

export type AlertRunResult = {
  examined: number;
  alerted: number;
  texted: number;
  textFailed: number;
  quiet: number;
  error?: string;
};

function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://hub.videntproductions.com";
  return raw.replace(/\/+$/, "");
}

const COLUMN: Record<ChecklistPass, "out_alert_sent_at" | "back_alert_sent_at"> = {
  out: "out_alert_sent_at",
  back: "back_alert_sent_at",
};

/**
 * Run every few minutes. When a checklist's scheduled leave time (or due-back time) has passed and
 * that step is under 100%, tell the assigned staff and the admins: in the Hub, as a push, and as a
 * text. Each alert is claimed before it is sent, so an overlapping run never sends it twice.
 */
export async function runChecklistAlerts(now: Date = new Date()): Promise<AlertRunResult> {
  const result: AlertRunResult = { examined: 0, alerted: 0, texted: 0, textFailed: 0, quiet: 0 };
  const supabase = createServiceClient();

  const { data: lists, error } = await supabase
    .from("event_checklists")
    .select("id, project_id, depart_at, return_at, out_alert_sent_at, back_alert_sent_at")
    .eq("status", "open")
    .or(
      `and(depart_at.lte.${now.toISOString()},out_alert_sent_at.is.null),and(return_at.lte.${now.toISOString()},back_alert_sent_at.is.null)`,
    )
    .limit(200);
  if (error) return { ...result, error: error.message };

  for (const list of lists ?? []) {
    for (const pass of ["out", "back"] as ChecklistPass[]) {
      const dueAt = (pass === "out" ? list.depart_at : list.return_at) as string | null;
      const sentAt = list[COLUMN[pass]] as string | null;
      if (sentAt || !dueAt || new Date(dueAt).getTime() > now.getTime()) continue;
      result.examined += 1;

      // Claim it first (also how we quietly retire times that are long past).
      const { data: claimed } = await supabase
        .from("event_checklists")
        .update({ [COLUMN[pass]]: now.toISOString() })
        .eq("id", list.id)
        .is(COLUMN[pass], null)
        .select("id");
      if (!claimed?.length) continue;
      if (isStale(now, dueAt) || !isDueNow(now, dueAt, ALERT_WINDOW_HOURS)) {
        result.quiet += 1;
        continue;
      }

      const [{ data: items }, { data: progress }, { data: project }] = await Promise.all([
        supabase
          .from("event_checklist_items")
          .select("id, qty_needed, returns, removed_at")
          .eq("checklist_id", list.id),
        supabase
          .from("event_checklist_item_progress")
          .select("item_id, qty_out, qty_back")
          .eq("checklist_id", list.id),
      supabase.from("honeybook_projects").select("name").eq("id", list.project_id).maybeSingle(),
      ]);
      const byItem = new Map((progress ?? []).map((p) => [p.item_id as string, p]));
      const totals = passTotals(
        (items ?? []).map((i) => ({
          returns: Boolean(i.returns),
          removed_at: (i.removed_at as string | null) ?? null,
          qty_needed: Number(i.qty_needed),
          qty_out: Number(byItem.get(i.id as string)?.qty_out ?? 0),
          qty_back: Number(byItem.get(i.id as string)?.qty_back ?? 0),
        })),
        pass,
      );
      // Nothing to check, or already finished: no alert needed.
      if (totals.needed <= 0 || totals.complete) {
        result.quiet += 1;
        continue;
      }

      const eventName = String(project?.name ?? "Event");
      const href = `/event-checklist/${list.project_id}`;
      const url = `${siteUrl()}${href}`;

      const [{ data: assigned }, { data: admins }] = await Promise.all([
        supabase
          .from("honeybook_project_assignees")
          .select("profile_id")
          .eq("project_id", list.project_id),
        supabase.from("profiles").select("id").eq("role", "admin"),
      ]);
      const ids = Array.from(
        new Set([
          ...(assigned ?? []).map((a) => a.profile_id as string),
          ...(admins ?? []).map((a) => a.id as string),
        ]),
      );
      if (!ids.length) continue;

      const title = alertTitle(pass, eventName, totals.percent);
      await insertNotifications(
        supabase,
        ids.map((userId) => ({
          userId,
          kind: "gear_checklist",
          title,
          body: alertBody(pass, totals.percent, totals.remainingItems),
          href,
        })),
      );
      result.alerted += 1;

      if (isSmsConfigured()) {
        const { data: people } = await supabase.from("profiles").select("id, phone").in("id", ids);
        const seen = new Set<string>();
        for (const person of people ?? []) {
          const phone = normalizePhone(person.phone as string | null);
          if (!phone || seen.has(phone)) continue;
          seen.add(phone);
          const sent = await sendSms(phone, alertSms(pass, eventName, totals.percent, url));
          if (sent.ok) result.texted += 1;
          else result.textFailed += 1;
        }
      }
    }
  }
  return result;
}
