"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  DRIVE_ROOT_FOLDER_SETTING_KEY,
  getDriveClient,
  isDriveConfigured,
  parseDriveFolderId,
  uploadFileToFolder,
} from "@/lib/drive/client";
import { createClient } from "@/lib/supabase/server";

async function requireManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "You must be signed in." };
  if (profile.role !== "admin" && profile.role !== "trainer") {
    return { ok: false as const, error: "Only admins and trainers can use Drive." };
  }
  return { ok: true as const, profile };
}

export async function uploadToDriveAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const gate = await requireManager();
  if (!gate.ok) return { error: gate.error };
  if (!(await isDriveConfigured())) {
    return { error: "Google Drive isn’t configured." };
  }

  const folderId = String(formData.get("folder_id") ?? "").trim();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > 100 * 1024 * 1024) {
    return { error: "File is too large (100MB max)." };
  }

  const client = await getDriveClient();
  const parentId = folderId || client.rootFolderId;
  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await uploadFileToFolder({
      parentId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Upload to Drive failed.",
    };
  }

  revalidatePath("/drive");
  return { error: null };
}

export async function createDriveFolderAction(input: {
  parentId: string;
  name: string;
}): Promise<{ error: string | null }> {
  const gate = await requireManager();
  if (!gate.ok) return { error: gate.error };
  if (!(await isDriveConfigured())) {
    return { error: "Google Drive isn’t configured." };
  }

  const name = input.name.trim();
  if (!name) return { error: "Enter a folder name." };

  try {
    const { drive, rootFolderId } = await getDriveClient();
    await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [input.parentId || rootFolderId],
      },
      fields: "id",
      supportsAllDrives: true,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Couldn’t create the folder.",
    };
  }

  revalidatePath("/drive");
  return { error: null };
}

export async function saveDriveRootFolderAction(
  input: string,
): Promise<{ error: string | null }> {
  const gate = await requireManager();
  if (!gate.ok) return { error: gate.error };
  if (gate.profile.role !== "admin") {
    return { error: "Only admins can change the Drive root folder." };
  }

  const folderId = parseDriveFolderId(input);
  if (!folderId) {
    return {
      error:
        "Paste a Google Drive folder URL (drive.google.com/…/folders/…) or the folder id.",
    };
  }

  const supabase = await createClient();
  const { error: upsertError } = await supabase.from("app_settings").upsert(
    {
      key: DRIVE_ROOT_FOLDER_SETTING_KEY,
      value: folderId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (upsertError) return { error: upsertError.message };

  // Old path→id cache belongs to the previous root.
  await supabase.from("drive_folder_cache").delete().neq("path", "__none__");

  revalidatePath("/drive");
  revalidatePath("/hub-health");
  return { error: null };
}

export async function clearDriveRootFolderOverrideAction(): Promise<{
  error: string | null;
}> {
  const gate = await requireManager();
  if (!gate.ok) return { error: gate.error };
  if (gate.profile.role !== "admin") {
    return { error: "Only admins can change the Drive root folder." };
  }

  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from("app_settings")
    .delete()
    .eq("key", DRIVE_ROOT_FOLDER_SETTING_KEY);
  if (deleteError) return { error: deleteError.message };

  await supabase.from("drive_folder_cache").delete().neq("path", "__none__");

  revalidatePath("/drive");
  revalidatePath("/hub-health");
  return { error: null };
}
