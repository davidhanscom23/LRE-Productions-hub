"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canScanGear, isGearAdmin } from "@/lib/gear-tags/access";
import { parseTagCode } from "@/lib/gear-tags/parse";
import {
  applyScan,
  createRequest,
  findUnitById,
  findUnitByTag,
  linkTag,
  loadUnitDetail,
  reviewRequest,
  updateUnit,
  type UnitEdit,
} from "@/lib/gear-tags/server";
import type {
  GearRequestKind,
  LinkTagInput,
  ScanDirection,
  ScanFlag,
  ScanHistoryRow,
  ScanResult,
  TaggedUnit,
} from "@/lib/gear-tags/types";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";

export type GearActionResult = { ok: true; message?: string } | { ok: false; error: string };

export type LookupResult =
  | { status: "found"; unit: TaggedUnit; contents: TaggedUnit[]; history: ScanHistoryRow[] }
  | { status: "unlinked"; tag: string }
  | { status: "error"; error: string };

const FLAGS: ScanFlag[] = ["none", "damaged", "missing"];
const REQUEST_KINDS: GearRequestKind[] = ["add", "change", "remove"];
const NOT_A_TAG = "That is not an LRE gear tag. Scan the tag on the gear, or type its number.";

async function context() {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be signed in." as const };
  if (!canScanGear(profile)) return { error: "Gear scanning is for LRE staff." as const };
  if (!isServiceRoleConfigured()) {
    return { error: "Gear scan is not set up on the server yet (SUPABASE_SERVICE_ROLE_KEY is missing)." as const };
  }
  return { profile, svc: createServiceClient(), admin: isGearAdmin(profile), error: null };
}

function refresh(projectId?: string | null) {
  revalidatePath("/gear-scan");
  revalidatePath("/rentals/serials");
  if (projectId) revalidatePath(`/event-checklist/${projectId}`);
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/** What is this tag on? Changes nothing. */
export async function lookupTagAction(raw: string): Promise<LookupResult> {
  const ctx = await context();
  if (ctx.error) return { status: "error", error: ctx.error };
  const tag = parseTagCode(raw);
  if (!tag) return { status: "error", error: NOT_A_TAG };
  try {
    const unit = await findUnitByTag(ctx.svc, tag);
    if (!unit) return { status: "unlinked", tag };
    const detail = await loadUnitDetail(ctx.svc, unit);
    return { status: "found", unit, ...detail };
  } catch (e) {
    return { status: "error", error: message(e) };
  }
}

/** Check a piece out or back in. `clientId` makes a replayed (offline) scan harmless. */
export async function scanTagAction(input: {
  raw: string;
  direction: ScanDirection;
  projectId: string | null;
  flag?: ScanFlag;
  note?: string;
  clientId: string;
  scannedAt?: string | null;
}): Promise<ScanResult> {
  const ctx = await context();
  if (ctx.error) return { ok: false, code: "error", error: ctx.error };
  const tag = parseTagCode(input.raw);
  if (!tag) return { ok: false, code: "error", error: NOT_A_TAG };
  if (input.direction !== "out" && input.direction !== "back") {
    return { ok: false, code: "error", error: "Pick Check out or Check in." };
  }
  if (!input.clientId || input.clientId.length > 80) {
    return { ok: false, code: "error", error: "This scan could not be identified. Scan again." };
  }
  try {
    const result = await applyScan(ctx.svc, {
      tag,
      direction: input.direction,
      projectId: input.projectId || null,
      flag: FLAGS.includes(input.flag ?? "none") ? (input.flag ?? "none") : "none",
      note: input.note ?? "",
      clientId: input.clientId,
      scannedAt: input.scannedAt ?? null,
      profileId: ctx.profile.id,
    });
    if (result.ok) refresh(input.projectId ?? result.unit.outProjectId);
    return result;
  } catch (e) {
    return { ok: false, code: "error", error: message(e) };
  }
}

/** Put a tag on gear. Admins link it right away; everyone else sends it to an admin. */
export async function linkTagAction(raw: string, input: LinkTagInput): Promise<GearActionResult> {
  const ctx = await context();
  if (ctx.error) return { ok: false, error: ctx.error };
  const tag = parseTagCode(raw);
  if (!tag) return { ok: false, error: NOT_A_TAG };
  if (!input.productId) return { ok: false, error: "Pick the inventory item this tag is going on." };
  const caseTag = input.caseTag.trim() ? parseTagCode(input.caseTag) : "";
  if (caseTag === null) return { ok: false, error: "The case tag number is not an LRE tag." };
  const clean: LinkTagInput = { ...input, caseTag: caseTag ?? "" };

  try {
    if (ctx.admin) {
      const linked = await linkTag(ctx.svc, tag, clean, ctx.profile.id);
      if (!linked.ok) return linked;
      refresh();
      return { ok: true, message: `Tag ${tag} is linked.` };
    }
    const existing = await findUnitByTag(ctx.svc, tag);
    if (existing) return { ok: false, error: `Tag ${tag} is already on ${existing.productName}.` };
    const sent = await createRequest(ctx.svc, {
      kind: "link_tag",
      tag,
      productId: clean.productId,
      payload: clean,
      details: "",
      profileId: ctx.profile.id,
    });
    if (!sent.ok) return sent;
    refresh();
    return { ok: true, message: `Sent to an admin. Tag ${tag} will work once it is approved.` };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

/** Admin only: edit a tagged piece. */
export async function updateUnitAction(
  unitId: string,
  edit: Omit<UnitEdit, "newTag"> & { newTag: string },
): Promise<GearActionResult> {
  const ctx = await context();
  if (ctx.error) return { ok: false, error: ctx.error };
  if (!ctx.admin) return { ok: false, error: "Only an admin can edit gear. Use Suggest a change instead." };
  const newTag = edit.newTag.trim() ? parseTagCode(edit.newTag) : "";
  if (newTag === null) return { ok: false, error: "The new tag number is not an LRE tag." };
  const caseTag = edit.caseTag.trim() ? parseTagCode(edit.caseTag) : "";
  if (caseTag === null) return { ok: false, error: "The case tag number is not an LRE tag." };
  try {
    const saved = await updateUnit(ctx.svc, unitId, { ...edit, newTag: newTag ?? "", caseTag: caseTag ?? "" });
    if (!saved.ok) return saved;
    refresh();
    return { ok: true, message: "Saved." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

/** Anyone on staff: suggest an addition, a change or a removal for an admin to approve. */
export async function suggestGearChangeAction(input: {
  kind: GearRequestKind;
  unitId?: string | null;
  details: string;
}): Promise<GearActionResult> {
  const ctx = await context();
  if (ctx.error) return { ok: false, error: ctx.error };
  if (!REQUEST_KINDS.includes(input.kind)) return { ok: false, error: "Pick add, change or remove." };
  if (input.details.trim().length < 3) return { ok: false, error: "Say what should change." };
  try {
    const unit = input.unitId ? await findUnitById(ctx.svc, input.unitId) : null;
    const sent = await createRequest(ctx.svc, {
      kind: input.kind,
      unitId: unit?.id ?? null,
      tag: unit?.tag ?? null,
      productId: unit?.productId ?? null,
      details: input.details,
      profileId: ctx.profile.id,
    });
    if (!sent.ok) return sent;
    refresh();
    return { ok: true, message: "Sent to an admin for approval." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

/** Admin only: approve or decline a suggestion. */
export async function reviewGearRequestAction(input: {
  id: string;
  approve: boolean;
  note?: string;
}): Promise<GearActionResult> {
  const ctx = await context();
  if (ctx.error) return { ok: false, error: ctx.error };
  if (!ctx.admin) return { ok: false, error: "Only an admin can approve gear changes." };
  try {
    const done = await reviewRequest(ctx.svc, input.id, input.approve, input.note ?? "", ctx.profile.id);
    if (!done.ok) return done;
    refresh();
    return { ok: true, message: input.approve ? "Approved." : "Declined." };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
