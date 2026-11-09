"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  MAX_FILES_PER_PORTAL,
  MAX_FILE_BYTES,
  classifyFile,
  isStoredFileKey,
  parseContact,
  parseHeadcount,
  parseLoadInText,
  type StoredFileKey,
} from "@/lib/av-portals/items";
import {
  PORTAL_BUCKET,
  fetchPortalByToken,
  fetchPortalState,
  syncCompletion,
  type PortalRow,
} from "@/lib/av-portals/server";

export type PortalActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

async function activePortal(token: string): Promise<PortalRow | null> {
  const portal = await fetchPortalByToken(token);
  return portal && portal.is_active ? portal : null;
}

async function touch(portal: PortalRow) {
  const supabase = createServiceClient();
  await supabase
    .from("av_event_portals")
    .update({ last_client_activity_at: new Date().toISOString() })
    .eq("id", portal.id);
  const { status } = await fetchPortalState(portal.id);
  await syncCompletion(portal, status);
  revalidatePath(`/portal/${portal.token}`);
}

const safeName = (name: string) =>
  name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 120) || "file";

export async function prepareUploadAction(input: {
  token: string;
  fileName: string;
  mimeType: string;
  size: number;
  itemKey: StoredFileKey | "auto";
}): Promise<PortalActionResult<{ path: string; uploadToken: string; itemKey: StoredFileKey }>> {
  const portal = await activePortal(input.token);
  if (!portal) return fail("This portal link is no longer active.");
  if (!Number.isFinite(input.size) || input.size <= 0) return fail("That file looks empty.");
  if (input.size > MAX_FILE_BYTES) return fail("Files can be up to 50 MB. Please send larger media another way.");

  const supabase = createServiceClient();
  const { count } = await supabase
    .from("av_event_portal_files")
    .select("id", { count: "exact", head: true })
    .eq("portal_id", portal.id);
  if ((count ?? 0) >= MAX_FILES_PER_PORTAL) return fail("This portal has reached its file limit. Please contact us.");

  const itemKey: StoredFileKey =
    input.itemKey === "auto"
      ? classifyFile(input.fileName, input.mimeType)
      : isStoredFileKey(input.itemKey)
        ? input.itemKey
        : "other";

  const path = `${portal.id}/${randomUUID()}-${safeName(input.fileName)}`;
  const { data, error } = await supabase.storage.from(PORTAL_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return fail("Could not start the upload. Please try again.");
  return { ok: true, data: { path, uploadToken: data.token, itemKey } };
}

export async function registerUploadAction(input: {
  token: string;
  path: string;
  fileName: string;
  mimeType: string;
  size: number;
  itemKey: StoredFileKey;
  auto: boolean;
}): Promise<PortalActionResult> {
  const portal = await activePortal(input.token);
  if (!portal) return fail("This portal link is no longer active.");
  if (!input.path.startsWith(`${portal.id}/`) || input.path.includes("..")) return fail("Invalid upload.");
  if (!isStoredFileKey(input.itemKey)) return fail("Invalid item.");

  const supabase = createServiceClient();
  const base = input.path.slice(portal.id.length + 1);
  const { data: listed } = await supabase.storage
    .from(PORTAL_BUCKET)
    .list(portal.id, { limit: 5, search: base.slice(0, 36) });
  if (!listed?.some((o) => o.name === base)) return fail("The upload did not finish. Please try again.");

  const { error } = await supabase.from("av_event_portal_files").insert({
    portal_id: portal.id,
    item_key: input.itemKey,
    storage_path: input.path,
    file_name: input.fileName.slice(0, 200),
    mime_type: input.mimeType.slice(0, 120),
    size_bytes: Math.max(0, Math.round(input.size)),
    matched_by: input.auto ? "auto" : "client",
  });
  if (error) return fail("Could not save that file. Please try again.");
  await touch(portal);
  return { ok: true };
}

export async function saveValueAction(input: {
  token: string;
  itemKey: "headcount" | "day_of_contact" | "load_in";
  value: unknown;
}): Promise<PortalActionResult> {
  const portal = await activePortal(input.token);
  if (!portal) return fail("This portal link is no longer active.");

  let clean: unknown;
  if (input.itemKey === "headcount") {
    clean = parseHeadcount(input.value);
    if (clean === null) return fail("Please enter a whole number of guests.");
  } else if (input.itemKey === "day_of_contact") {
    clean = parseContact(input.value);
    if (!clean) return fail("Please enter a name and a cell number.");
  } else if (input.itemKey === "load_in") {
    clean = parseLoadInText(input.value);
    if (!clean) return fail("Please add a few words about load-in, dock and parking.");
  } else {
    return fail("Invalid item.");
  }

  const { error } = await createServiceClient()
    .from("av_event_portal_values")
    .upsert(
      { portal_id: portal.id, item_key: input.itemKey, value: clean, updated_at: new Date().toISOString() },
      { onConflict: "portal_id,item_key" },
    );
  if (error) return fail("Could not save. Please try again.");
  await touch(portal);
  return { ok: true };
}

export async function removeFileAction(input: { token: string; fileId: string }): Promise<PortalActionResult> {
  const portal = await activePortal(input.token);
  if (!portal) return fail("This portal link is no longer active.");
  const supabase = createServiceClient();
  const { data: file } = await supabase
    .from("av_event_portal_files")
    .select("id, storage_path")
    .eq("id", input.fileId)
    .eq("portal_id", portal.id)
    .maybeSingle();
  if (!file) return fail("File not found.");
  await supabase.storage.from(PORTAL_BUCKET).remove([file.storage_path as string]);
  await supabase.from("av_event_portal_files").delete().eq("id", file.id);
  await touch(portal);
  return { ok: true };
}

export async function moveFileAction(input: {
  token: string;
  fileId: string;
  itemKey: StoredFileKey;
}): Promise<PortalActionResult> {
  const portal = await activePortal(input.token);
  if (!portal) return fail("This portal link is no longer active.");
  if (!isStoredFileKey(input.itemKey)) return fail("Invalid item.");
  const { data, error } = await createServiceClient()
    .from("av_event_portal_files")
    .update({ item_key: input.itemKey, matched_by: "client" })
    .eq("id", input.fileId)
    .eq("portal_id", portal.id)
    .select("id");
  if (error || !data?.length) return fail("Could not move that file.");
  await touch(portal);
  return { ok: true };
}
