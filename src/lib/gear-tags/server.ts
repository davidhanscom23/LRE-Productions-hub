import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { pickBackTarget, pickOutTarget, type TargetItem } from "./checklist-target";
import { formatTag } from "./parse";
import type {
  GearBoard,
  GearRequest,
  GearRequestKind,
  LinkTagInput,
  OwnerCompany,
  ProductOption,
  ProjectOption,
  ScanDirection,
  ScanFlag,
  ScanHistoryRow,
  ScanResult,
  TaggedUnit,
} from "./types";

/**
 * Server-side gear tag work. Every function takes the service-role client: the caller has
 * already confirmed the person is an admin, Lead or staff member (see access.ts).
 */

const UNIT_COLS =
  "id, product_id, serial, status, tag_number, label, is_case, case_unit_id, owner_company, out_project_id, out_since, av_products ( name, owner_company )";

const OWNERS: OwnerCompany[] = ["vident", "lukesent", "lre"];

type UnitRow = Record<string, unknown>;

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function asOwner(v: unknown): OwnerCompany | null {
  return OWNERS.includes(v as OwnerCompany) ? (v as OwnerCompany) : null;
}

function mapUnit(row: UnitRow, projectNames: Map<string, string>): TaggedUnit {
  const product = one(row.av_products as { name?: string; owner_company?: string } | null);
  const outProjectId = (row.out_project_id as string | null) ?? null;
  return {
    id: row.id as string,
    tag: (row.tag_number as string | null) ?? null,
    productId: row.product_id as string,
    productName: product?.name ?? "Unknown item",
    label: (row.label as string) ?? "",
    serial: (row.serial as string) ?? "",
    status: row.status as TaggedUnit["status"],
    isCase: Boolean(row.is_case),
    caseUnitId: (row.case_unit_id as string | null) ?? null,
    owner: asOwner(row.owner_company) ?? asOwner(product?.owner_company) ?? "vident",
    outProjectId,
    outProjectName: outProjectId ? (projectNames.get(outProjectId) ?? "") : "",
    outSince: (row.out_since as string | null) ?? null,
  };
}

async function projectNameMap(svc: SupabaseClient, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await svc.from("pipeline_projects").select("id, name").in("id", unique);
  for (const p of data ?? []) map.set(p.id as string, (p.name as string) ?? "");
  return map;
}

async function mapUnits(svc: SupabaseClient, rows: UnitRow[]): Promise<TaggedUnit[]> {
  const names = await projectNameMap(
    svc,
    rows.map((r) => (r.out_project_id as string | null) ?? null),
  );
  return rows.map((r) => mapUnit(r, names));
}

export async function findUnitByTag(svc: SupabaseClient, tag: string): Promise<TaggedUnit | null> {
  const { data, error } = await svc
    .from("av_product_units")
    .select(UNIT_COLS)
    .eq("tag_number", tag)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return (await mapUnits(svc, [data as UnitRow]))[0];
}

export async function findUnitById(svc: SupabaseClient, id: string): Promise<TaggedUnit | null> {
  const { data, error } = await svc.from("av_product_units").select(UNIT_COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return (await mapUnits(svc, [data as UnitRow]))[0];
}

async function caseContents(svc: SupabaseClient, caseUnitId: string): Promise<TaggedUnit[]> {
  const { data, error } = await svc
    .from("av_product_units")
    .select(UNIT_COLS)
    .eq("case_unit_id", caseUnitId)
    .neq("status", "retired")
    .order("label");
  if (error) throw new Error(error.message);
  return mapUnits(svc, (data ?? []) as UnitRow[]);
}

/** One piece with what is in it (for a case) and its last scans. */
export async function loadUnitDetail(
  svc: SupabaseClient,
  unit: TaggedUnit,
): Promise<{ contents: TaggedUnit[]; history: ScanHistoryRow[] }> {
  const [contents, historyRes] = await Promise.all([
    unit.isCase ? caseContents(svc, unit.id) : Promise.resolve([]),
    svc
      .from("gear_tag_scans")
      .select("id, direction, project_name, flag, note, scanned_at, via_case_unit_id, profiles:scanned_by(full_name)")
      .eq("unit_id", unit.id)
      .order("scanned_at", { ascending: false })
      .limit(25),
  ]);
  if (historyRes.error) throw new Error(historyRes.error.message);
  const history: ScanHistoryRow[] = (historyRes.data ?? []).map((r) => ({
    id: r.id as string,
    direction: r.direction as ScanDirection,
    projectName: (r.project_name as string) ?? "",
    flag: r.flag as ScanFlag,
    note: (r.note as string) ?? "",
    scannedAt: r.scanned_at as string,
    scannedByName: one(r.profiles as { full_name?: string } | null)?.full_name || "Staff",
    viaCase: Boolean(r.via_case_unit_id),
  }));
  return { contents, history };
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

type ChecklistCtx = { id: string; items: TargetItem[] };

async function loadChecklist(
  svc: SupabaseClient,
  projectId: string,
  createdBy: string,
  create: boolean,
): Promise<ChecklistCtx | null> {
  let { data: checklist } = await svc
    .from("event_checklists")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!checklist && create) {
    const made = await svc
      .from("event_checklists")
      .insert({ project_id: projectId, created_by: createdBy })
      .select("id")
      .maybeSingle();
    checklist = made.data;
    if (!checklist) {
      // Someone else created it a moment ago.
      const again = await svc.from("event_checklists").select("id").eq("project_id", projectId).maybeSingle();
      checklist = again.data;
    }
  }
  if (!checklist) return null;

  const [itemsRes, progressRes] = await Promise.all([
    svc
      .from("event_checklist_items")
      .select("id, product_id, qty_needed, origin, removed_at, returns")
      .eq("checklist_id", checklist.id),
    svc.from("event_checklist_item_progress").select("item_id, qty_out, qty_back").eq("checklist_id", checklist.id),
  ]);
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  const progress = new Map<string, { out: number; back: number }>();
  for (const p of progressRes.data ?? []) {
    progress.set(p.item_id as string, { out: Number(p.qty_out) || 0, back: Number(p.qty_back) || 0 });
  }
  const items: TargetItem[] = (itemsRes.data ?? []).map((r) => ({
    id: r.id as string,
    product_id: (r.product_id as string | null) ?? null,
    qty_needed: Number(r.qty_needed) || 0,
    qty_out: progress.get(r.id as string)?.out ?? 0,
    qty_back: progress.get(r.id as string)?.back ?? 0,
    origin: r.origin as TargetItem["origin"],
    removed_at: (r.removed_at as string | null) ?? null,
    returns: Boolean(r.returns),
  }));
  return { id: checklist.id as string, items };
}

/** Tick the event's checklist for one piece leaving. Returns false if the tick could not be saved. */
async function tickOut(
  svc: SupabaseClient,
  checklist: ChecklistCtx,
  unit: TaggedUnit,
  profileId: string,
  clientId: string,
  flag: ScanFlag,
  note: string,
): Promise<boolean> {
  const target = pickOutTarget(checklist.items, unit.productId);
  let itemId: string;
  if (target.kind === "use") {
    itemId = target.itemId;
  } else if (target.kind === "bump") {
    const { error } = await svc
      .from("event_checklist_items")
      .update({ qty_needed: target.qtyNeeded, updated_at: new Date().toISOString() })
      .eq("id", target.itemId);
    if (error) return false;
    itemId = target.itemId;
    const line = checklist.items.find((i) => i.id === itemId);
    if (line) line.qty_needed = target.qtyNeeded;
  } else {
    const { data, error } = await svc
      .from("event_checklist_items")
      .insert({
        checklist_id: checklist.id,
        product_id: unit.productId,
        name: unit.productName,
        qty_needed: 1,
        source: "in_house",
        origin: "manual",
        note: "Added by a gear tag scan",
        sort_order: 9000,
      })
      .select("id")
      .maybeSingle();
    if (error || !data) return false;
    itemId = data.id as string;
    checklist.items.push({
      id: itemId,
      product_id: unit.productId,
      qty_needed: 1,
      qty_out: 0,
      qty_back: 0,
      origin: "manual",
      removed_at: null,
      returns: true,
    });
  }

  const { error } = await svc.from("event_checklist_checks").insert({
    item_id: itemId,
    checklist_id: checklist.id,
    pass: "out",
    qty: 1,
    flag,
    note: note || `Scanned ${formatTag(unit.tag)}`,
    checked_by: profileId,
    client_id: `tag:${clientId}`,
  });
  if (error && error.code !== "23505") return false;
  const line = checklist.items.find((i) => i.id === itemId);
  if (line) line.qty_out += 1;
  return true;
}

async function tickBack(
  svc: SupabaseClient,
  checklist: ChecklistCtx,
  unit: TaggedUnit,
  profileId: string,
  clientId: string,
  flag: ScanFlag,
  note: string,
): Promise<boolean> {
  const itemId = pickBackTarget(checklist.items, unit.productId);
  if (!itemId) return false;
  const { error } = await svc.from("event_checklist_checks").insert({
    item_id: itemId,
    checklist_id: checklist.id,
    pass: "back",
    qty: 1,
    flag,
    note: note || `Scanned ${formatTag(unit.tag)}`,
    checked_by: profileId,
    client_id: `tag:${clientId}`,
  });
  if (error && error.code !== "23505") return false;
  const line = checklist.items.find((i) => i.id === itemId);
  if (line) line.qty_back += 1;
  return true;
}

function safeScanTime(scannedAt: string | null | undefined): string {
  const now = Date.now();
  const t = scannedAt ? Date.parse(scannedAt) : NaN;
  // Trust the phone's time for an offline scan, but never a future time or one over 30 days old.
  if (Number.isFinite(t) && t <= now + 60_000 && t >= now - 30 * 86_400_000) return new Date(t).toISOString();
  return new Date(now).toISOString();
}

export type ApplyScanInput = {
  tag: string;
  direction: ScanDirection;
  /** Event the gear is going to. Ignored on the way back: the piece remembers where it went. */
  projectId: string | null;
  flag: ScanFlag;
  note: string;
  clientId: string;
  scannedAt?: string | null;
  profileId: string;
};

/**
 * Record one scan. Moves the scanned piece (and, for a case, every piece assigned to it), ticks
 * the event's gear checklist, and appends to the scan log. Safe to replay: the same clientId
 * never counts twice.
 */
export async function applyScan(svc: SupabaseClient, input: ApplyScanInput): Promise<ScanResult> {
  const unit = await findUnitByTag(svc, input.tag);
  if (!unit) {
    return { ok: false, code: "unlinked", tag: input.tag, error: `Tag ${input.tag} is not linked to any gear yet.` };
  }
  if (unit.status === "retired") {
    return { ok: false, code: "error", error: `${unit.productName} (${formatTag(unit.tag)}) is retired.` };
  }

  const targets = [unit, ...(unit.isCase ? await caseContents(svc, unit.id) : [])];
  const when = safeScanTime(input.scannedAt);
  const warnings: string[] = [];
  const note = input.note.trim().slice(0, 500);

  let outProjectName = "";
  if (input.direction === "out" && input.projectId) {
    const { data: project } = await svc
      .from("pipeline_projects")
      .select("id, name")
      .eq("id", input.projectId)
      .maybeSingle();
    if (!project) return { ok: false, code: "error", error: "That event no longer exists. Pick another." };
    outProjectName = (project.name as string) ?? "";
  }

  const checklists = new Map<string, ChecklistCtx | null>();
  async function checklistFor(projectId: string, create: boolean) {
    if (!checklists.has(projectId)) {
      checklists.set(projectId, await loadChecklist(svc, projectId, input.profileId, create));
    }
    return checklists.get(projectId) ?? null;
  }

  let moved = 0;
  let resultProject = outProjectName;

  for (const t of targets) {
    const isScanned = t.id === unit.id;
    const cid = `${input.clientId}:${t.id}`;
    const projectId = input.direction === "out" ? input.projectId : (t.outProjectId ?? input.projectId);
    const projectName = input.direction === "out" ? outProjectName : t.outProjectName;
    const flag: ScanFlag = isScanned ? input.flag : "none";

    // The scan log row is the gate: a replayed scan stops here.
    const { error: scanError } = await svc.from("gear_tag_scans").insert({
      unit_id: t.id,
      tag_number: t.tag,
      direction: input.direction,
      project_id: projectId,
      via_case_unit_id: isScanned ? null : unit.id,
      flag,
      note: isScanned ? note : "",
      scanned_by: input.profileId,
      scanned_at: when,
      client_id: cid,
      product_name: t.productName,
      unit_label: t.label,
      project_name: projectName,
    });
    if (scanError) {
      if (scanError.code === "23505") {
        moved += 1;
        continue;
      }
      return { ok: false, code: "error", error: scanError.message };
    }

    if (input.direction === "out") {
      if (t.status === "out" && isScanned) {
        warnings.push(
          t.outProjectName && t.outProjectId !== projectId
            ? `It was still checked out to ${t.outProjectName}.`
            : "It was already checked out.",
        );
      }
      if (projectId) {
        const checklist = await checklistFor(projectId, true);
        const ticked = checklist
          ? await tickOut(svc, checklist, t, input.profileId, cid, flag, isScanned ? note : "")
          : false;
        if (!ticked && isScanned) warnings.push("Saved, but the event checklist could not be ticked.");
      }
    } else {
      if (t.status !== "out" && isScanned) warnings.push("It was not checked out.");
      if (projectId) {
        const checklist = await checklistFor(projectId, false);
        if (checklist) await tickBack(svc, checklist, t, input.profileId, cid, flag, isScanned ? note : "");
        if (isScanned) resultProject = projectName;
      }
    }

    const { error: unitError } = await svc
      .from("av_product_units")
      .update(
        input.direction === "out"
          ? { status: "out", out_project_id: projectId, out_since: when }
          : { status: "in", out_project_id: null, out_since: null },
      )
      .eq("id", t.id);
    if (unitError) return { ok: false, code: "error", error: unitError.message };
    moved += 1;
  }

  const fresh = (await findUnitById(svc, unit.id)) ?? unit;
  return { ok: true, unit: fresh, moved, projectName: resultProject, warnings };
}

// ---------------------------------------------------------------------------
// Linking and editing (admin), suggestions (everyone)
// ---------------------------------------------------------------------------

type Outcome = { ok: true } | { ok: false; error: string };

async function resolveCase(svc: SupabaseClient, caseTag: string): Promise<{ id: string | null; error?: string }> {
  const tag = caseTag.trim();
  if (!tag) return { id: null };
  const found = await findUnitByTag(svc, tag);
  if (!found) return { id: null, error: `Case tag ${tag} is not linked yet. Link the case first.` };
  if (!found.isCase) return { id: null, error: `${formatTag(tag)} is not marked as a case.` };
  return { id: found.id };
}

/** Put a tag on a piece of gear: creates the piece's record. */
export async function linkTag(
  svc: SupabaseClient,
  tag: string,
  input: LinkTagInput,
  profileId: string,
): Promise<Outcome> {
  const existing = await findUnitByTag(svc, tag);
  if (existing) {
    return { ok: false, error: `${formatTag(tag)} is already on ${existing.productName}.` };
  }
  const { data: product } = await svc.from("av_products").select("id").eq("id", input.productId).maybeSingle();
  if (!product) return { ok: false, error: "Pick the inventory item this tag is going on." };

  const caseRes = await resolveCase(svc, input.isCase ? "" : input.caseTag);
  if (caseRes.error) return { ok: false, error: caseRes.error };

  const serial = input.serial.trim() || `TAG-${tag}`;
  const { error } = await svc.from("av_product_units").insert({
    product_id: input.productId,
    serial,
    barcode: tag,
    status: "in",
    tag_number: tag,
    label: input.label.trim().slice(0, 80),
    is_case: input.isCase,
    case_unit_id: caseRes.id,
    owner_company: asOwner(input.owner),
    tagged_at: new Date().toISOString(),
    tagged_by: profileId,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That serial number or tag is already in the hub. Check the Tagged gear tab." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export type UnitEdit = {
  label: string;
  serial: string;
  owner: OwnerCompany | "";
  isCase: boolean;
  caseTag: string;
  retired: boolean;
  /** New tag number when a sticker is replaced; "" keeps the current one. */
  newTag: string;
};

export async function updateUnit(svc: SupabaseClient, unitId: string, edit: UnitEdit): Promise<Outcome> {
  const unit = await findUnitById(svc, unitId);
  if (!unit) return { ok: false, error: "That piece no longer exists." };

  const caseRes = await resolveCase(svc, edit.isCase ? "" : edit.caseTag);
  if (caseRes.error) return { ok: false, error: caseRes.error };
  if (caseRes.id === unit.id) return { ok: false, error: "A piece cannot be its own case." };

  const patch: Record<string, unknown> = {
    label: edit.label.trim().slice(0, 80),
    owner_company: asOwner(edit.owner),
    is_case: edit.isCase,
    case_unit_id: caseRes.id,
  };
  if (edit.serial.trim()) patch.serial = edit.serial.trim();
  if (edit.retired) {
    patch.status = "retired";
    patch.out_project_id = null;
    patch.out_since = null;
  } else if (unit.status === "retired") {
    patch.status = "in";
  }
  if (edit.newTag && edit.newTag !== unit.tag) {
    const taken = await findUnitByTag(svc, edit.newTag);
    if (taken) return { ok: false, error: `${formatTag(edit.newTag)} is already on ${taken.productName}.` };
    patch.tag_number = edit.newTag;
    patch.barcode = edit.newTag;
  }

  const { error } = await svc.from("av_product_units").update(patch).eq("id", unitId);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That serial number is already used by another piece." };
    return { ok: false, error: error.message };
  }
  if (!edit.isCase && unit.isCase) {
    // No longer a case: release what was assigned to it.
    await svc.from("av_product_units").update({ case_unit_id: null }).eq("case_unit_id", unitId);
  }
  return { ok: true };
}

export async function createRequest(
  svc: SupabaseClient,
  input: {
    kind: GearRequestKind;
    tag?: string | null;
    unitId?: string | null;
    productId?: string | null;
    payload?: Record<string, unknown>;
    details: string;
    profileId: string;
  },
): Promise<Outcome> {
  const { error } = await svc.from("gear_change_requests").insert({
    kind: input.kind,
    tag_number: input.tag ?? null,
    unit_id: input.unitId ?? null,
    product_id: input.productId ?? null,
    payload: input.payload ?? {},
    details: input.details.trim().slice(0, 1000),
    requested_by: input.profileId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Admin decision. Approving a link request links the tag; the others are marked for the record. */
export async function reviewRequest(
  svc: SupabaseClient,
  requestId: string,
  approve: boolean,
  note: string,
  profileId: string,
): Promise<Outcome> {
  const { data: req, error } = await svc
    .from("gear_change_requests")
    .select("id, kind, tag_number, payload, status")
    .eq("id", requestId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!req) return { ok: false, error: "That request no longer exists." };
  if (req.status !== "pending") return { ok: false, error: "That request was already reviewed." };

  if (approve && req.kind === "link_tag") {
    const p = (req.payload ?? {}) as Partial<LinkTagInput>;
    const linked = await linkTag(
      svc,
      String(req.tag_number ?? ""),
      {
        productId: String(p.productId ?? ""),
        label: String(p.label ?? ""),
        serial: String(p.serial ?? ""),
        isCase: Boolean(p.isCase),
        caseTag: String(p.caseTag ?? ""),
        owner: asOwner(p.owner) ?? "",
      },
      profileId,
    );
    if (!linked.ok) return linked;
  }

  const { error: updateError } = await svc
    .from("gear_change_requests")
    .update({
      status: approve ? "approved" : "declined",
      reviewed_by: profileId,
      reviewed_at: new Date().toISOString(),
      review_note: note.trim().slice(0, 500),
    })
    .eq("id", requestId)
    .eq("status", "pending");
  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const KIND_LABELS: Record<GearRequestKind, string> = {
  link_tag: "Link a tag",
  add: "Add gear",
  change: "Change gear",
  remove: "Remove gear",
};

function isoDay(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export type GearBoardLoad = { status: "ok"; board: GearBoard } | { status: "needs_migration" } | { status: "error"; message: string };

export async function loadGearBoard(
  svc: SupabaseClient,
  viewer: { id: string; isAdmin: boolean },
): Promise<GearBoardLoad> {
  let requestsQuery = svc
    .from("gear_change_requests")
    .select("id, kind, tag_number, unit_id, product_id, payload, details, status, requested_by, requested_at, review_note, profiles:requested_by(full_name)")
    .order("requested_at", { ascending: false })
    .limit(60);
  if (!viewer.isAdmin) requestsQuery = requestsQuery.eq("requested_by", viewer.id);

  const [unitsRes, productsRes, projectsRes, requestsRes] = await Promise.all([
    svc.from("av_product_units").select(UNIT_COLS).order("tag_number").limit(2000),
    svc
      .from("av_products")
      .select("id, name, owner_company")
      .eq("is_active", true)
      .neq("kind", "package")
      .order("name")
      .limit(1000),
    svc
      .from("pipeline_projects")
      .select("id, name, project_date")
      .gte("project_date", isoDay(-14))
      .lte("project_date", isoDay(60))
      .order("project_date")
      .limit(150),
    requestsQuery,
  ]);

  const missing = [unitsRes.error, requestsRes.error].find(
    (e) => e && (e.code === "42703" || e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST204"),
  );
  if (missing) return { status: "needs_migration" };
  const failed = unitsRes.error ?? productsRes.error ?? projectsRes.error ?? requestsRes.error;
  if (failed) return { status: "error", message: failed.message };

  const units = await mapUnits(svc, (unitsRes.data ?? []) as UnitRow[]);
  const productNames = new Map<string, string>();
  const products: ProductOption[] = (productsRes.data ?? []).map((p) => {
    productNames.set(p.id as string, p.name as string);
    return { id: p.id as string, name: p.name as string, owner: asOwner(p.owner_company) ?? "vident" };
  });
  const projects: ProjectOption[] = (projectsRes.data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    date: (p.project_date as string | null) ?? null,
  }));
  const unitById = new Map(units.map((u) => [u.id, u]));

  const requests: GearRequest[] = (requestsRes.data ?? []).map((r) => {
    const kind = r.kind as GearRequestKind;
    const payload = (r.payload ?? {}) as Partial<LinkTagInput>;
    const unit = r.unit_id ? unitById.get(r.unit_id as string) : undefined;
    const productName = productNames.get(String(payload.productId ?? r.product_id ?? "")) ?? "";
    let summary = KIND_LABELS[kind];
    if (kind === "link_tag") {
      summary = `Link ${formatTag(r.tag_number as string)} to ${productName || "an item"}${payload.label ? ` (${payload.label})` : ""}${payload.isCase ? ", as a case" : ""}`;
    } else if (unit) {
      summary = `${KIND_LABELS[kind]}: ${unit.productName}${unit.label ? ` (${unit.label})` : ""}, ${formatTag(unit.tag)}`;
    } else if (productName) {
      summary = `${KIND_LABELS[kind]}: ${productName}`;
    }
    return {
      id: r.id as string,
      kind,
      tag: (r.tag_number as string | null) ?? null,
      unitId: (r.unit_id as string | null) ?? null,
      summary,
      details: (r.details as string) ?? "",
      status: r.status as GearRequest["status"],
      requestedByName: one(r.profiles as { full_name?: string } | null)?.full_name || "Staff",
      requestedAt: r.requested_at as string,
      reviewNote: (r.review_note as string) ?? "",
      mine: r.requested_by === viewer.id,
    };
  });

  return { status: "ok", board: { units, products, projects, requests, isAdmin: viewer.isAdmin } };
}
