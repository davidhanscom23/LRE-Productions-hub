import "server-only";

import { google } from "googleapis";
import { Readable } from "stream";
import { createClient } from "@/lib/supabase/server";

export { parseDriveFolderId } from "@/lib/drive/folder-id";

export const DRIVE_ROOT_FOLDER_SETTING_KEY = "google_drive_root_folder_id";

/**
 * LRE Productions Hub company Drive folder — all Hub Drive writes
 * (Client Reviews sheet, Social Studio backup, /drive browse) land here unless
 * an admin override or GOOGLE_DRIVE_ROOT_FOLDER_ID points elsewhere.
 * https://drive.google.com/drive/folders/1m3XSbIg6_3_GN431KH2Iw7hjQsr_VgWF
 */
export const DEFAULT_DRIVE_ROOT_FOLDER_ID =
  "1m3XSbIg6_3_GN431KH2Iw7hjQsr_VgWF";

export type DriveRootFolderSource = "env" | "app_settings" | "default";

export type DriveConfig = {
  clientEmail: string;
  privateKey: string;
  rootFolderId: string;
};

export type DriveConnectionInfo = {
  configured: boolean;
  clientEmail: string | null;
  rootFolderId: string | null;
  /** Where the root folder id came from */
  rootFolderSource: DriveRootFolderSource | null;
  folderName: string | null;
  webViewLink: string | null;
  error: string | null;
};

function getDriveCredentials(): {
  clientEmail: string;
  privateKey: string;
} | null {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? "";
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "")
    .replace(/\\n/g, "\n")
    .trim();
  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey };
}

function envRootFolderId(): string | null {
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim() ?? "";
  return id || null;
}

async function settingsRootFolderId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", DRIVE_ROOT_FOLDER_SETTING_KEY)
      .maybeSingle();
    const value = data?.value?.trim() ?? "";
    return value || null;
  } catch {
    return null;
  }
}

/** Prefer admin-saved folder id; then env; then the LRE company folder. */
export async function resolveDriveRootFolderId(): Promise<{
  rootFolderId: string | null;
  source: DriveRootFolderSource | null;
}> {
  const fromSettings = await settingsRootFolderId();
  if (fromSettings) {
    return { rootFolderId: fromSettings, source: "app_settings" };
  }
  const fromEnv = envRootFolderId();
  if (fromEnv) {
    return { rootFolderId: fromEnv, source: "env" };
  }
  return {
    rootFolderId: DEFAULT_DRIVE_ROOT_FOLDER_ID,
    source: "default",
  };
}

export async function getDriveConfig(): Promise<DriveConfig | null> {
  const credentials = getDriveCredentials();
  if (!credentials) return null;
  const { rootFolderId } = await resolveDriveRootFolderId();
  if (!rootFolderId) return null;
  return {
    clientEmail: credentials.clientEmail,
    privateKey: credentials.privateKey,
    rootFolderId,
  };
}

export async function isDriveConfigured(): Promise<boolean> {
  return (await getDriveConfig()) !== null;
}

/** Sync check used only when env root is required (credentials + env folder). */
export function isDriveCredentialsConfigured(): boolean {
  return getDriveCredentials() !== null;
}

export async function getDriveClient() {
  const config = await getDriveConfig();
  if (!config) {
    throw new Error(
      "Google Drive is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_DRIVE_ROOT_FOLDER_ID (or save a root folder on /drive).",
    );
  }

  const auth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return {
    drive: google.drive({ version: "v3", auth }),
    rootFolderId: config.rootFolderId,
    clientEmail: config.clientEmail,
  };
}

/** Non-secret snapshot of the connected Drive root (for Hub Health / Drive UI). */
export async function inspectDriveConnection(): Promise<DriveConnectionInfo> {
  const credentials = getDriveCredentials();
  const { rootFolderId, source } = await resolveDriveRootFolderId();

  if (!credentials || !rootFolderId) {
    return {
      configured: false,
      clientEmail: credentials?.clientEmail ?? null,
      rootFolderId,
      rootFolderSource: source,
      folderName: null,
      webViewLink: null,
      error: !credentials
        ? "Service account email/key missing in environment."
        : "Root folder id missing — set GOOGLE_DRIVE_ROOT_FOLDER_ID or save a folder on /drive.",
    };
  }

  try {
    const { drive } = await getDriveClient();
    const meta = await drive.files.get({
      fileId: rootFolderId,
      fields: "id, name, webViewLink, owners(emailAddress,displayName), driveId",
      supportsAllDrives: true,
    });
    return {
      configured: true,
      clientEmail: credentials.clientEmail,
      rootFolderId,
      rootFolderSource: source,
      folderName: meta.data.name ?? null,
      webViewLink: meta.data.webViewLink ?? null,
      error: null,
    };
  } catch (error) {
    return {
      configured: true,
      clientEmail: credentials.clientEmail,
      rootFolderId,
      rootFolderSource: source,
      folderName: null,
      webViewLink: null,
      error:
        error instanceof Error
          ? error.message
          : "Could not read the Drive root folder.",
    };
  }
}

export async function findChildFolder(
  parentId: string,
  name: string,
): Promise<string | null> {
  const { drive } = await getDriveClient();
  const escaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

export async function ensureChildFolder(
  parentId: string,
  name: string,
): Promise<string> {
  const existing = await findChildFolder(parentId, name);
  if (existing) return existing;

  const { drive } = await getDriveClient();
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const id = created.data.id;
  if (!id) throw new Error(`Failed to create Drive folder “${name}”.`);
  return id;
}

export async function uploadFileToFolder(input: {
  parentId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<string> {
  const { drive } = await getDriveClient();

  // Replace existing file with same name in folder (idempotent backup)
  const escaped = input.fileName.replace(/'/g, "\\'");
  const existing = await drive.files.list({
    q: `'${input.parentId}' in parents and name = '${escaped}' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existingId = existing.data.files?.[0]?.id;
  const media = {
    mimeType: input.mimeType || "application/octet-stream",
    body: Readable.from(input.bytes),
  };

  if (existingId) {
    const updated = await drive.files.update({
      fileId: existingId,
      media,
      fields: "id",
      supportsAllDrives: true,
    });
    if (!updated.data.id) throw new Error("Drive update failed.");
    return updated.data.id;
  }

  const created = await drive.files.create({
    requestBody: {
      name: input.fileName,
      parents: [input.parentId],
    },
    media,
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error("Drive upload failed.");
  return created.data.id;
}
