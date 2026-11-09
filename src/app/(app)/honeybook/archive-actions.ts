"use server";

import { randomUUID } from "node:crypto";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canAccessHoneyBook, canManageHoneyBookCrm } from "@/lib/honeybook/access";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const ARCHIVE_BUCKET = "honeybook-archive";
type Result<T = object> = { error: string } | ({ error: null } & T);
const UUID_RE = /^[0-9a-f-]{36}$/i;
const KINDS = ["contract", "invoice", "proposal", "other"] as const;

async function requireManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, error: "Sign in first." };
  if (!canManageHoneyBookCrm(profile.role)) return { profile: null, error: "Only admins and Leads can file archive documents." };
  if (!isServiceRoleConfigured()) return { profile: null, error: "Storage isn't configured." };
  return { profile, error: null as string | null };
}

/** Step 1 of an upload: a signed URL so the browser sends the file straight to storage. */
export async function createArchiveUpload(input: { projectId: string; fileName: string }): Promise<Result<{ path: string; token: string }>> {
  const { error } = await requireManager();
  if (error) return { error };
  if (!UUID_RE.test(input.projectId)) return { error: "Pick a project." };
  const ext = (input.fileName.split(".").pop() ?? "").toLowerCase();
  if (!["pdf", "png", "jpg", "jpeg", "docx", "xlsx", "csv", "txt"].includes(ext)) {
    return { error: `${input.fileName}: that file type isn't supported (PDF, images, Word, Excel, CSV, text).` };
  }
  const path = `${input.projectId}/${randomUUID()}.${ext}`;
  const { data, error: e } = await createServiceClient().storage.from(ARCHIVE_BUCKET).createSignedUploadUrl(path);
  if (e || !data) return { error: e?.message ?? "Could not start the upload." };
  return { error: null, path, token: data.token };
}

/** Step 2: record the uploaded file against the project. */
export async function registerArchiveDocument(input: {
  projectId: string;
  kind: string;
  path: string;
  fileName: string;
  sizeBytes: number;
}): Promise<Result> {
  const { profile, error } = await requireManager();
  if (error || !profile) return { error: error ?? "Sign in first." };
  if (!UUID_RE.test(input.projectId) || !input.path.startsWith(`${input.projectId}/`)) return { error: "Bad upload." };
  const kind = (KINDS as readonly string[]).includes(input.kind) ? input.kind : "other";
  const supabase = await createClient();
  const { error: e } = await supabase.from("honeybook_archive_documents").insert({
    project_id: input.projectId,
    kind,
    file_name: input.fileName.slice(0, 200),
    storage_path: input.path,
    size_bytes: Math.max(0, Math.floor(input.sizeBytes || 0)),
    uploaded_by: profile.id,
  });
  if (e) return { error: e.message };
  revalidatePath(`/honeybook/projects/${input.projectId}`);
  return { error: null };
}

export async function getArchiveDownloadUrl(id: string): Promise<Result<{ url: string }>> {
  const profile = await getCurrentProfile();
  if (!profile || !canAccessHoneyBook(profile.role)) return { error: "Sign in first." };
  if (!UUID_RE.test(id) || !isServiceRoleConfigured()) return { error: "Not found." };
  const supabase = await createClient();
  const { data: doc } = await supabase.from("honeybook_archive_documents").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!doc) return { error: "Not found." };
  const { data, error } = await createServiceClient()
    .storage.from(ARCHIVE_BUCKET)
    .createSignedUrl(doc.storage_path as string, 300, { download: doc.file_name as string });
  if (error || !data) return { error: error?.message ?? "Could not open the file." };
  return { error: null, url: data.signedUrl };
}

export async function deleteArchiveDocument(id: string): Promise<Result> {
  const { error } = await requireManager();
  if (error) return { error };
  if (!UUID_RE.test(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data: doc } = await supabase.from("honeybook_archive_documents").select("storage_path, project_id").eq("id", id).maybeSingle();
  if (!doc) return { error: "Not found." };
  await createServiceClient().storage.from(ARCHIVE_BUCKET).remove([doc.storage_path as string]);
  const { error: e } = await supabase.from("honeybook_archive_documents").delete().eq("id", id);
  if (e) return { error: e.message };
  revalidatePath(`/honeybook/projects/${doc.project_id}`);
  return { error: null };
}
