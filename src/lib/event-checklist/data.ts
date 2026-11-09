import type { SupabaseClient } from "@supabase/supabase-js";
import { liveWindowCutoff } from "./archive/format";
import type {
  EventInfo,
  Checklist,
  ChecklistHistoryRow,
  ChecklistItem,
} from "./types";

export type ChecklistProject = {
  id: string;
  name: string;
  project_date: string | null;
  location: string;
};

export type ChecklistBoard =
  | { status: "needs_migration" }
  | { status: "denied" }
  | { status: "not_found" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      project: ChecklistProject;
      checklist: Checklist;
      items: ChecklistItem[];
      history: ChecklistHistoryRow[];
      estimateRef: string | null;
      info: EventInfo | null;
      venueOptions: { id: string; name: string }[];
      productOptions: { id: string; name: string; kind: string }[];
      /** When the server built this board (ms). The offline copy on a device is compared against it. */
      loadedAt: number;
    };

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Build (or refresh) the checklist for a project and load everything the page shows. */
export async function loadChecklistBoard(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ChecklistBoard> {
  const { error: ensureError } = await supabase.rpc("event_checklist_ensure", {
    p_project: projectId,
  });
  if (ensureError) {
    const msg = ensureError.message ?? "";
    if (/not allowed/i.test(msg)) return { status: "denied" };
    if (ensureError.code === "23503") return { status: "not_found" };
    if (
      ensureError.code === "PGRST202" ||
      ensureError.code === "42883" ||
      /could not find the function|does not exist/i.test(msg)
    ) {
      return { status: "needs_migration" };
    }
    return { status: "error", message: msg };
  }

  // Secure lookup (works for assigned staff). Before migration 193 it is missing, so fall back.
  const infoRes = await supabase.rpc("event_checklist_info", { p_project: projectId });
  const info: EventInfo | null = infoRes.error ? null : ((infoRes.data as EventInfo | null) ?? null);
  let project: ChecklistProject | null = info?.project ?? null;
  if (!project) {
    const { data: direct, error: projectError } = await supabase
      .from("honeybook_projects")
      .select("id, name, project_date, location")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError) return { status: "error", message: projectError.message };
    project = (direct as ChecklistProject | null) ?? null;
  }
  if (!project) return { status: "not_found" };

  const venuesRes = await supabase.rpc("event_checklist_venue_options");
  const venueOptions = venuesRes.error ? [] : ((venuesRes.data as { id: string; name: string }[]) ?? []);

  const productsRes = await supabase.rpc("event_checklist_product_options");
  const productOptions = productsRes.error
    ? []
    : ((productsRes.data as { id: string; name: string; kind: string }[]) ?? []);

  const { data: checklist, error: checklistError } = await supabase
    .from("event_checklists")
    .select("id, project_id, opportunity_id, depart_at, return_at, status")
    .eq("project_id", projectId)
    .maybeSingle();
  if (checklistError) return { status: "error", message: checklistError.message };
  if (!checklist) return { status: "error", message: "Checklist could not be created." };

  const [itemsRes, progressRes, historyRes, estimateRes] = await Promise.all([
    supabase
      .from("event_checklist_items")
      .select(
        "id, checklist_id, product_id, name, qty_needed, source, returns, note, sort_order, origin, removed_at",
      )
      .eq("checklist_id", checklist.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("event_checklist_item_progress")
      .select("item_id, qty_out, qty_back")
      .eq("checklist_id", checklist.id),
    supabase
      .from("event_checklist_checks")
      .select(
        "id, item_id, pass, qty, flag, note, photo_path, checked_at, item_name, profiles:checked_by(full_name)",
      )
      .eq("checklist_id", checklist.id)
      .gte("checked_at", liveWindowCutoff(new Date()).toISOString())
      .order("checked_at", { ascending: false })
      .limit(200),
    checklist.opportunity_id
      ? supabase
          .from("av_opportunities")
          .select("reference")
          .eq("id", checklist.opportunity_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (itemsRes.error) return { status: "error", message: itemsRes.error.message };
  if (progressRes.error) return { status: "error", message: progressRes.error.message };
  if (historyRes.error) return { status: "error", message: historyRes.error.message };

  const progress = new Map<string, { out: number; back: number }>();
  for (const p of progressRes.data ?? []) {
    progress.set(p.item_id as string, {
      out: num(p.qty_out),
      back: num(p.qty_back),
    });
  }

  const items: ChecklistItem[] = (itemsRes.data ?? []).map((r) => ({
    ...(r as Omit<ChecklistItem, "qty_out" | "qty_back" | "qty_needed">),
    qty_needed: num(r.qty_needed),
    qty_out: progress.get(r.id as string)?.out ?? 0,
    qty_back: progress.get(r.id as string)?.back ?? 0,
  }));

  const history: ChecklistHistoryRow[] = (historyRes.data ?? []).map((r) => {
    const prof = r.profiles as { full_name?: string } | { full_name?: string }[] | null;
    const name = Array.isArray(prof) ? prof[0]?.full_name : prof?.full_name;
    return {
      id: r.id as string,
      item_id: r.item_id as string,
      pass: r.pass as ChecklistHistoryRow["pass"],
      qty: num(r.qty),
      flag: r.flag as ChecklistHistoryRow["flag"],
      note: (r.note as string) ?? "",
      photo_path: (r.photo_path as string | null) ?? null,
      checked_at: r.checked_at as string,
      checked_by_name: name || "Staff",
      item_name: (r.item_name as string) ?? "",
    };
  });

  return {
    status: "ok",
    project: project as ChecklistProject,
    checklist: checklist as Checklist,
    items,
    history,
    estimateRef: (estimateRes.data as { reference?: string } | null)?.reference ?? null,
    info,
    venueOptions,
    productOptions,
    loadedAt: Date.now(),
  };
}
