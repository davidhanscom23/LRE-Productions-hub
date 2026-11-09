"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  CRM_FILE_BUCKET,
  CRM_MAX_FILE_BYTES,
  CRM_MAX_FILES_PER_PROJECT,
  isCrmFileItemKey,
  type CrmFileItemKey,
} from "@/lib/honeybook/file-requests";
import {
  sanitizeCrmAnswers,
  type CrmQuestionnaireAnswers,
} from "@/lib/honeybook/questionnaire";
import { loadSharedProjectRow } from "@/lib/honeybook/public-project";

export type CrmFileActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({
  ok: false,
  error,
});

const safeName = (name: string) =>
  name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 120) ||
  "file";

export async function prepareCrmUploadAction(input: {
  token: string;
  fileName: string;
  mimeType: string;
  size: number;
  itemKey: CrmFileItemKey;
}): Promise<
  CrmFileActionResult<{ path: string; uploadToken: string; itemKey: CrmFileItemKey }>
> {
  const loaded = await loadSharedProjectRow(input.token);
  if (!loaded) return fail("This project link is no longer active.");
  if (!isCrmFileItemKey(input.itemKey)) return fail("Invalid folder.");
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return fail("That file looks empty.");
  }
  if (input.size > CRM_MAX_FILE_BYTES) {
    return fail("Files can be up to 50 MB.");
  }

  const { supabase, project } = loaded;
  const { count } = await supabase
    .from("honeybook_project_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id);
  if ((count ?? 0) >= CRM_MAX_FILES_PER_PROJECT) {
    return fail("This project has reached its file limit. Please contact us.");
  }

  const path = `${project.id}/${randomUUID()}-${safeName(input.fileName)}`;
  const { data, error } = await supabase.storage
    .from(CRM_FILE_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return fail("Could not start the upload. Please try again.");
  return {
    ok: true,
    data: { path, uploadToken: data.token, itemKey: input.itemKey },
  };
}

export async function registerCrmUploadAction(input: {
  token: string;
  path: string;
  fileName: string;
  mimeType: string;
  size: number;
  itemKey: CrmFileItemKey;
}): Promise<CrmFileActionResult> {
  const loaded = await loadSharedProjectRow(input.token);
  if (!loaded) return fail("This project link is no longer active.");
  if (!isCrmFileItemKey(input.itemKey)) return fail("Invalid folder.");
  const { supabase, project } = loaded;
  if (
    !input.path.startsWith(`${project.id}/`) ||
    input.path.includes("..")
  ) {
    return fail("Invalid upload.");
  }

  const base = input.path.slice(String(project.id).length + 1);
  const { data: listed } = await supabase.storage
    .from(CRM_FILE_BUCKET)
    .list(String(project.id), { limit: 5, search: base.slice(0, 36) });
  if (!listed?.some((o) => o.name === base)) {
    return fail("The upload did not finish. Please try again.");
  }

  const { error } = await supabase.from("honeybook_project_files").insert({
    project_id: project.id,
    item_key: input.itemKey,
    storage_path: input.path,
    file_name: input.fileName.slice(0, 200),
    mime_type: input.mimeType.slice(0, 120),
    size_bytes: Math.max(0, Math.round(input.size)),
  });
  if (error) {
    if (/does not exist|schema cache|honeybook_project_files/i.test(error.message)) {
      return fail(
        "Uploads aren’t set up yet — ask the team to run migration 164.",
      );
    }
    return fail("Could not save that file. Please try again.");
  }

  revalidatePath(`/project/${input.token}`);
  return { ok: true };
}

export async function removeCrmUploadAction(input: {
  token: string;
  fileId: string;
}): Promise<CrmFileActionResult> {
  const loaded = await loadSharedProjectRow(input.token);
  if (!loaded) return fail("This project link is no longer active.");
  const { supabase, project } = loaded;
  const { data: file } = await supabase
    .from("honeybook_project_files")
    .select("id, storage_path")
    .eq("id", input.fileId)
    .eq("project_id", project.id)
    .maybeSingle();
  if (!file) return fail("File not found.");
  await supabase.storage
    .from(CRM_FILE_BUCKET)
    .remove([file.storage_path as string]);
  await supabase.from("honeybook_project_files").delete().eq("id", file.id);
  revalidatePath(`/project/${input.token}`);
  return { ok: true };
}

export async function saveCrmQuestionnaireAction(input: {
  token: string;
  answers: CrmQuestionnaireAnswers;
}): Promise<CrmFileActionResult> {
  const loaded = await loadSharedProjectRow(input.token);
  if (!loaded) return fail("This project link is no longer active.");
  const { supabase, project } = loaded;
  const answers = sanitizeCrmAnswers(
    input.answers as Record<string, unknown>,
  );
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("honeybook_project_questionnaire_answers")
    .upsert(
      {
        project_id: project.id,
        answers,
        submitted_at: now,
        updated_at: now,
      },
      { onConflict: "project_id" },
    );
  if (error) {
    if (
      /does not exist|schema cache|honeybook_project_questionnaire/i.test(
        error.message,
      )
    ) {
      return fail(
        "Questionnaire isn’t set up yet — ask the team to run migration 165.",
      );
    }
    return fail("Could not save your answers. Please try again.");
  }
  revalidatePath(`/project/${input.token}`);
  return { ok: true };
}
