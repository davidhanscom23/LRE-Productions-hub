import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { POPUP_WINDOW_HOURS, isDueNow } from "@/lib/event-checklist/due";
import { passTotals } from "@/lib/event-checklist/progress";
import type { ChecklistPass } from "@/lib/event-checklist/types";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Gear checklists whose scheduled leave / due-back time has passed and are still under 100%, for
 * the signed-in person (assigned staff, or any checklist for admins and Leads). Drives the popup.
 */
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ due: [] }, { status: 401 });

  const now = new Date();
  const since = new Date(now.getTime() - POPUP_WINDOW_HOURS * 3_600_000).toISOString();
  const nowIso = now.toISOString();

  // Row-level security limits this to checklists the person may open.
  const supabase = await createClient();
  const { data: lists, error } = await supabase
    .from("event_checklists")
    .select("id, project_id, depart_at, return_at")
    .eq("status", "open")
    .or(
      `and(depart_at.gte.${since},depart_at.lte.${nowIso}),and(return_at.gte.${since},return_at.lte.${nowIso})`,
    )
    .limit(30);
  if (error || !lists?.length) return NextResponse.json({ due: [] });

  // Names and totals come from the service client: staff may not read the Events table directly.
  const admin = createServiceClient();
  const ids = lists.map((l) => l.id as string);
  const [{ data: items }, { data: progress }, { data: projects }] = await Promise.all([
    admin.from("event_checklist_items").select("id, checklist_id, qty_needed, returns, removed_at").in("checklist_id", ids),
    admin.from("event_checklist_item_progress").select("item_id, qty_out, qty_back").in("checklist_id", ids),
    admin.from("pipeline_projects").select("id, name").in("id", lists.map((l) => l.project_id as string)),
  ]);
  const byItem = new Map((progress ?? []).map((p) => [p.item_id as string, p]));
  const names = new Map((projects ?? []).map((p) => [p.id as string, String(p.name ?? "Event")]));

  const due: {
    checklistId: string;
    projectId: string;
    name: string;
    pass: ChecklistPass;
    dueAt: string;
    percent: number;
    remainingItems: number;
  }[] = [];

  for (const list of lists) {
    const mine = (items ?? []).filter((i) => i.checklist_id === list.id);
    for (const pass of ["out", "back"] as ChecklistPass[]) {
      const dueAt = (pass === "out" ? list.depart_at : list.return_at) as string | null;
      if (!dueAt || !isDueNow(now, dueAt, POPUP_WINDOW_HOURS)) continue;
      const totals = passTotals(
        mine.map((i) => ({
          returns: Boolean(i.returns),
          removed_at: (i.removed_at as string | null) ?? null,
          qty_needed: Number(i.qty_needed),
          qty_out: Number(byItem.get(i.id as string)?.qty_out ?? 0),
          qty_back: Number(byItem.get(i.id as string)?.qty_back ?? 0),
        })),
        pass,
      );
      if (totals.needed <= 0 || totals.complete) continue;
      due.push({
        checklistId: list.id as string,
        projectId: list.project_id as string,
        name: names.get(list.project_id as string) ?? "Event",
        pass,
        dueAt,
        percent: totals.percent,
        remainingItems: totals.remainingItems,
      });
    }
  }
  return NextResponse.json({ due });
}
