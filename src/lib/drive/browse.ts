import "server-only";

import { getDriveClient } from "@/lib/drive/client";

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  webViewLink: string | null;
  iconLink: string | null;
  modifiedTime: string | null;
  size: string | null;
};

const FOLDER_MIME = "application/vnd.google-apps.folder";
const FIELDS =
  "files(id, name, mimeType, webViewLink, iconLink, modifiedTime, size)";

function toItem(f: {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  webViewLink?: string | null;
  iconLink?: string | null;
  modifiedTime?: string | null;
  size?: string | null;
}): DriveItem {
  const mimeType = f.mimeType ?? "";
  return {
    id: f.id ?? "",
    name: f.name ?? "Untitled",
    mimeType,
    isFolder: mimeType === FOLDER_MIME,
    webViewLink: f.webViewLink ?? null,
    iconLink: f.iconLink ?? null,
    modifiedTime: f.modifiedTime ?? null,
    size: f.size ?? null,
  };
}

function sortItems(items: DriveItem[]): DriveItem[] {
  return items.sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export type DriveFolderView = {
  folderId: string;
  folderName: string;
  parentId: string | null;
  isRoot: boolean;
  items: DriveItem[];
};

/** List the contents of a folder (defaults to the configured root). */
export async function listDriveFolder(
  folderId?: string,
): Promise<DriveFolderView> {
  const { drive, rootFolderId } = await getDriveClient();
  const id = folderId?.trim() || rootFolderId;
  const isRoot = id === rootFolderId;

  let folderName = "Company Drive";
  let parentId: string | null = null;
  try {
    const meta = await drive.files.get({
      fileId: id,
      fields: "id, name, parents",
      supportsAllDrives: true,
    });
    folderName = meta.data.name ?? (isRoot ? "Company Drive" : "Folder");
    if (!isRoot) {
      parentId = meta.data.parents?.[0] ?? rootFolderId;
    }
  } catch {
    folderName = isRoot ? "Company Drive" : "Folder";
    parentId = isRoot ? null : rootFolderId;
  }

  const res = await drive.files.list({
    q: `'${id}' in parents and trashed = false`,
    fields: FIELDS,
    orderBy: "folder,name",
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const items = sortItems((res.data.files ?? []).map(toItem));
  return { folderId: id, folderName, parentId, isRoot, items };
}

/** Full-text search across the shared Drive. */
export async function searchDrive(query: string): Promise<DriveItem[]> {
  const q = query.trim();
  if (!q) return [];
  const { drive } = await getDriveClient();
  const escaped = q.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `name contains '${escaped}' and trashed = false`,
    fields: FIELDS,
    orderBy: "folder,name",
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return sortItems((res.data.files ?? []).map(toItem));
}
