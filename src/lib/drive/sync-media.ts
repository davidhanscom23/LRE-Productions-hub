import "server-only";

import {
  ensureChildFolder,
  getDriveClient,
  isDriveConfigured,
  uploadFileToFolder,
} from "@/lib/drive/client";
import { getEventMediaAccessUrl } from "@/lib/storage/event-media";
import { createClient } from "@/lib/supabase/server";

export type DriveSyncResult = {
  uploaded: number;
  skipped: number;
  error: string | null;
};

async function resolveDriveFolderId(
  folderPath: string,
  cache: Map<string, string>,
): Promise<string> {
  const { drive: _drive, rootFolderId } = await getDriveClient();
  void _drive;

  const parts = folderPath
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  let parentId = rootFolderId;
  let built = "";

  for (const part of parts) {
    built = built ? `${built}/${part}` : part;
    if (cache.has(built)) {
      parentId = cache.get(built)!;
      continue;
    }

    const supabase = await createClient();
    const { data: cached } = await supabase
      .from("drive_folder_cache")
      .select("drive_id")
      .eq("path", built)
      .maybeSingle();

    if (cached?.drive_id) {
      cache.set(built, cached.drive_id as string);
      parentId = cached.drive_id as string;
      continue;
    }

    const folderId = await ensureChildFolder(parentId, part);
    cache.set(built, folderId);
    await supabase.from("drive_folder_cache").upsert({
      path: built,
      drive_id: folderId,
      updated_at: new Date().toISOString(),
    });
    parentId = folderId;
  }

  return parentId;
}

export async function syncPacketMediaToDrive(
  packetId: string,
  options?: { force?: boolean },
): Promise<DriveSyncResult> {
  if (!(await isDriveConfigured())) {
    return {
      uploaded: 0,
      skipped: 0,
      error:
        "Google Drive is not configured. Add GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_DRIVE_ROOT_FOLDER_ID (share that folder with the service account), or save a root folder on /drive.",
    };
  }

  const force = Boolean(options?.force);
  const supabase = await createClient();
  type MediaSyncRow = {
    id: string;
    storage_path: string;
    storage_provider?: string | null;
    file_name: string | null;
    folder_path: string | null;
    media_type: string | null;
    drive_file_id: string | null;
    location_name: string | null;
    dj_name: string | null;
    event_date: string;
  };

  const withProvider = await supabase
    .from("event_media")
    .select(
      "id, storage_path, storage_provider, file_name, folder_path, media_type, drive_file_id, location_name, dj_name, event_date",
    )
    .eq("packet_id", packetId);

  let rows: MediaSyncRow[] = [];
  if (withProvider.error?.message?.includes("storage_provider")) {
    const legacy = await supabase
      .from("event_media")
      .select(
        "id, storage_path, file_name, folder_path, media_type, drive_file_id, location_name, dj_name, event_date",
      )
      .eq("packet_id", packetId);
    if (legacy.error) {
      return { uploaded: 0, skipped: 0, error: legacy.error.message };
    }
    rows = (legacy.data ?? []) as MediaSyncRow[];
  } else if (withProvider.error) {
    return { uploaded: 0, skipped: 0, error: withProvider.error.message };
  } else {
    rows = (withProvider.data ?? []) as MediaSyncRow[];
  }

  if (!rows.length) {
    return { uploaded: 0, skipped: 0, error: "No media on this packet to sync." };
  }

  const cache = new Map<string, string>();
  let uploaded = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      if (!force && row.drive_file_id) {
        skipped += 1;
        continue;
      }

      const folderPath =
        (row.folder_path as string)?.trim() ||
        [
          String(row.location_name || "Venue"),
          `${row.location_name || "Venue"} - ${row.dj_name || "Staff"} - ${row.event_date}`,
        ].join("/");

      const parentId = await resolveDriveFolderId(folderPath, cache);

      const access = await getEventMediaAccessUrl({
        supabase,
        path: row.storage_path as string,
        provider:
          row.storage_provider === "bunny" ||
          row.storage_provider === "supabase"
            ? row.storage_provider
            : "supabase",
        expiresIn: 300,
      });

      if (!access.url) {
        skipped += 1;
        continue;
      }

      const response = await fetch(access.url);
      if (!response.ok) {
        skipped += 1;
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const mimeType =
        response.headers.get("content-type") ||
        (String(row.media_type).startsWith("video")
          ? "video/mp4"
          : "image/jpeg");

      const driveId = await uploadFileToFolder({
        parentId,
        fileName: String(row.file_name || `media-${row.id}`),
        mimeType,
        bytes,
      });

      await supabase
        .from("event_media")
        .update({
          drive_file_id: driveId,
          drive_synced_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      uploaded += 1;
    } catch {
      skipped += 1;
    }
  }

  return { uploaded, skipped, error: null };
}
