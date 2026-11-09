"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { datetimeLocalEasternToIso } from "@/lib/av-erp/datetime";
import { clampDelta } from "@/lib/event-checklist/progress";
import type {
  ChecklistFlag,
  ChecklistPass,
  ChecklistSource,
} from "@/lib/event-checklist/types";
import { createClient } from "@/lib/supabase/server";

export type ChecklistActionResult = { ok: true } | { ok: false; error: string };

const SOURCES: ChecklistSource[] = ["in_house", "client_supplied", "sub_rented"];
const FLAGS: ChecklistFlag[] = ["none", "damaged", "missing"];

async function context() {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be signed in." as const };
  const supabase = await createClient();
  return { supabase, profile, error: null };
}

function refresh(projectId: string) {
  revalidatePath(`/event-checklist/${projectId}`);
}

async function projectIdFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  checklistId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("event_checklists")
    .select("project_id")
    .eq("id", checklistId)
    .maybeSingle();
  return (data?.project_id as string | undefined) ?? null;
}

/**
 * Record one check (or undo). `qty` is the change for that pass: positive checks items off,
 * negative undoes. The change is clamped to what is still needed / already checked, and
 * `clientId` makes a replayed (offline) request harmless.
 */
export async function recordCheckAction(input: {
  itemId: string;
  pass: ChecklistPass;
  qty: number;
  flag?: ChecklistFlag;
  note?: string;
  photoPath?: string | null;
  clientId?: string;
}): Promise<ChecklistActionResult> {
  const ctx = await context();
  if (ctx.error) return { ok: false, error: ctx.error };
  const { supabase, profile } = ctx;

  if (input.pass !== "out" && input.pass !== "back") {
    return { ok: false, error: "Pick out or back." };
  }
  const flag = FLAGS.includes(input.flag ?? "none") ? (input.flag ?? "none") : "none";

  const [itemRes, progressRes] = await Promise.all([
    supabase
      .from("event_checklist_items")
      .select("id, checklist_id, qty_needed, removed_at, returns")
      .eq("id", input.itemId)
      .maybeSingle(),
    supabase
      .from("event_checklist_item_progress")
      .select("qty_out, qty_back")
      .eq("item_id", input.itemId)
      .maybeSingle(),
  ]);
  if (itemRes.error) return { ok: false, error: itemRes.error.message };
  const item = itemRes.data;
  if (!item) return { ok: false, error: "You can't check this item." };
  if (item.removed_at) return { ok: false, error: "This item was removed from the list." };
  if (input.pass === "back" && !item.returns) {
    return { ok: false, error: "This item is sold or used up, so it doesn't come back." };
  }

  const delta = clampDelta(
    {
      qty_needed: Number(item.qty_needed),
      qty_out: Number(progressRes.data?.qty_out ?? 0),
      qty_back: Number(progressRes.data?.qty_back ?? 0),
    },
    input.pass,
    Number(input.qty) || 0,
  );
  // A flag with no quantity change (e.g. "missing" on an item that is already counted) is still
  // worth recording, so only skip a plain check that changes nothing.
  if (delta === 0 && flag === "none") {
    return { ok: false, error: "Nothing to change." };
  }

  const row = {
    item_id: item.id,
    checklist_id: item.checklist_id,
    pass: input.pass,
    qty: delta,
    flag,
    note: (input.note ?? "").trim().slice(0, 500),
    photo_path: input.photoPath ?? null,
    checked_by: profile.id,
    client_id: input.clientId ?? null,
  };
  const { error: insertError } = await supabase
    .from("event_checklist_checks")
    .insert(row);
  if (insertError) {
    // Replayed offline request: already saved.
    if (insertError.code === "23505") return { ok: true };
    return { ok: false, error: insertError.message };
  }

  const projectId = await projectIdFor(supabase, item.checklist_id as string);
  if (projectId) refresh(projectId);
  return { ok: true };
}

export async function setItemSourceAction(input: {
  itemId: string;
  source: ChecklistSource;
}): Promise<ChecklistActionResult> {
  const ctx = await context();
  if (ctx.error) return { ok: false, error: ctx.error };
  const { supabase } = ctx;
  if (!SOURCES.includes(input.source)) return { ok: false, error: "Unknown source." };

  const { data, error } = await supabase
    .from("event_checklist_items")
    .update({ source: input.source, updated_at: new Date().toISOString() })
    .eq("id", input.itemId)
    .select("checklist_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "You can't change this item." };

  const projectId = await projectIdFor(supabase, data.checklist_id as string);
  if (projectId) refresh(projectId);
  return { ok: true };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function addManualItemAction(input: {
  /** Client-made id so a replayed (offline) request cannot add the line twice. */
  id?: string;
  checklistId: string;
  name: string;
  qty: number;
  source: ChecklistSource;
  productId?: string | null;
  returns?: boolean;
}): Promise<ChecklistActionResult> {
  const ctx = await context();
  if (ctx.error) return { ok: false, error: ctx.error };
  const { supabase } = ctx;

  const name = input.name.trim();
  const qty = Math.round((Number(input.qty) || 0) * 100) / 100;
  if (!name) return { ok: false, error: "Give the item a name." };
  if (qty <= 0) return { ok: false, error: "Quantity must be more than zero." };
  if (!SOURCES.includes(input.source)) return { ok: false, error: "Unknown source." };

  const { error } = await supabase.from("event_checklist_items").insert({
    ...(input.id && UUID_RE.test(input.id) ? { id: input.id } : {}),
    checklist_id: input.checklistId,
    product_id: input.productId || null,
    name: name.slice(0, 200),
    qty_needed: qty,
    source: input.source,
    returns: input.returns ?? true,
    origin: "manual",
    sort_order: 10000,
  });
  // Replayed offline request: the line is already there.
  if (error && error.code !== "23505") return { ok: false, error: error.message };

  const projectId = await projectIdFor(supabase, input.checklistId);
  if (projectId) refresh(projectId);
  return { ok: true };
}

/** Manual items only: contract items follow the estimate and cannot be removed here. Removing twice is fine. */
export async function removeManualItemAction(itemId: string): Promise<ChecklistActionResult> {
  const ctx = await context();
  if (ctx.error) return { ok: false, error: ctx.error };
  const { supabase } = ctx;

  const { data, error } = await supabase
    .from("event_checklist_items")
    .update({ removed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("origin", "manual")
    .is("removed_at", null)
    .select("checklist_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) {
    // Already removed (replayed offline request)?
    const { data: existing } = await supabase
      .from("event_checklist_items")
      .select("origin, removed_at")
      .eq("id", itemId)
      .maybeSingle();
    if (existing?.origin === "manual" && existing.removed_at) return { ok: true };
    return { ok: false, error: "Only items added by hand can be removed. Contract items follow the estimate." };
  }

  const projectId = await projectIdFor(supabase, data.checklist_id as string);
  if (projectId) refresh(projectId);
  return { ok: true };
}

/** Set the leave-the-warehouse and back-in-the-warehouse times (Eastern, approximate is fine). */
export async function updateScheduleAction(input: {
  checklistId: string;
  departAt: string;
  returnAt: string;
}): Promise<ChecklistActionResult> {
  const ctx = await context();
  if (ctx.error) return { ok: false, error: ctx.error };
  const { supabase } = ctx;

  const depart = datetimeLocalEasternToIso(input.departAt);
  const back = datetimeLocalEasternToIso(input.returnAt);
  if (depart && back && new Date(back).getTime() < new Date(depart).getTime()) {
    return { ok: false, error: "Return time can't be before departure." };
  }

  const { data, error } = await supabase
    .from("event_checklists")
    .update({
      depart_at: depart,
      return_at: back,
      // Re-arm the reminders if the times moved.
      out_alert_sent_at: null,
      back_alert_sent_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.checklistId)
    .select("project_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "You can't change this checklist." };

  refresh(data.project_id as string);
  return { ok: true };
}

/** Save the venue, room and load-in details for this event. Details stay with the venue. */
export async function saveVenueAction(input: {
  projectId: string;
  venueId: string | null;
  venueName: string;
  room: string;
  fields: Partial<
    Record<
      | "contact_name"
      | "email"
      | "phone"
      | "address_line1"
      | "city"
      | "region"
      | "postal_code"
      | "access_notes"
      | "power_notes"
      | "parking_notes"
      | "loading_dock_notes"
      | "path_notes"
      | "load_in_hours"
      | "venue_rules",
      string
    >
  >;
}): Promise<ChecklistActionResult> {
  const ctx = await context();
  if (ctx.error) return { ok: false, error: ctx.error };
  const { supabase } = ctx;

  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.fields)) {
    if (typeof v === "string") fields[k] = v.trim().slice(0, 1000);
  }
  const { error } = await supabase.rpc("event_checklist_save_venue", {
    p_project: input.projectId,
    p_venue_id: input.venueId || null,
    p_venue_name: input.venueName.trim().slice(0, 200),
    p_room: input.room.trim(),
    p_fields: fields,
  });
  if (error) {
    if (/could not find the function/i.test(error.message)) {
      return { ok: false, error: "Run migration 193 in Supabase first." };
    }
    return { ok: false, error: error.message };
  }
  refresh(input.projectId);
  return { ok: true };
}
