import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPacketEventType } from "@/lib/event-packets/format-event-type";
import {
  buildEventFolderName,
  buildFolderPath,
  buildMediaFileName,
  extensionFromFileName,
  folderSlugFromName,
  sanitizeNamePart,
} from "@/lib/event-packets/naming";
import {
  deleteEventMediaObject,
  EVENT_MEDIA_BUCKET,
  getEventMediaAccessUrl,
  uploadEventMediaObject,
  type StorageProvider,
} from "@/lib/storage/event-media";

export type SyncPacketMediaFromRecapInput = {
  supabase: SupabaseClient;
  packetId: string;
  venueId: string | null;
  clientName: string;
  venueRaw: string;
  eventType: string;
  eventTypeOther: string;
  djName: string;
  eventDate: string;
};

export type SyncPacketMediaFromRecapResult = {
  updated: number;
  moved: number;
  errors: string[];
  /** True when at least one row needed a rewrite. */
  changed: boolean;
};

function expectedFromRecap(input: SyncPacketMediaFromRecapInput) {
  const locationName = sanitizeNamePart(input.venueRaw || "Venue");
  const djName = sanitizeNamePart(input.djName || "Staff");
  const eventDate =
    input.eventDate.trim() || new Date().toISOString().slice(0, 10);
  const mediaEventType = formatPacketEventType({
    event_type: input.eventType,
    event_type_other: input.eventTypeOther,
  });
  const clientName = input.clientName.trim();
  const eventFolder = buildEventFolderName({
    locationName,
    djName,
    eventDate,
  });
  const folderPath = buildFolderPath({
    venueFolderSlug: folderSlugFromName(locationName),
    eventFolderName: eventFolder,
  });
  return {
    locationName,
    djName,
    eventDate,
    mediaEventType,
    clientName,
    eventFolder,
    folderPath,
  };
}

/** Whether stored media metadata already matches Event details & recap. */
export function mediaRowMatchesRecap(
  row: {
    dj_name?: string | null;
    location_name?: string | null;
    client_name?: string | null;
    event_type?: string | null;
    event_date?: string | null;
    folder_path?: string | null;
    file_name?: string | null;
    original_file_name?: string | null;
    sequence_number?: number | null;
    storage_path?: string | null;
    uploader_id?: string | null;
  },
  expected: ReturnType<typeof expectedFromRecap>,
  packetId: string,
): boolean {
  const sequence =
    typeof row.sequence_number === "number" && row.sequence_number > 0
      ? row.sequence_number
      : 1;
  const fileName = buildMediaFileName({
    locationName: expected.locationName,
    djName: expected.djName,
    eventDate: expected.eventDate,
    sequence,
    extension: extensionFromFileName(
      String(row.file_name || row.original_file_name || "photo.jpg"),
    ),
  });
  const uploaderId = String(row.uploader_id ?? "").trim();
  const expectedPath = uploaderId
    ? `${uploaderId}/${packetId}/${fileName}`
    : String(row.storage_path ?? "").replace(/^\//, "");
  const rowDate = String(row.event_date ?? "").slice(0, 10);

  return (
    String(row.dj_name ?? "") === expected.djName &&
    String(row.location_name ?? "") === expected.locationName &&
    String(row.client_name ?? "") === expected.clientName &&
    String(row.event_type ?? "") === expected.mediaEventType &&
    rowDate === expected.eventDate &&
    String(row.folder_path ?? "") === expected.folderPath &&
    String(row.file_name ?? "") === fileName &&
    String(row.storage_path ?? "").replace(/^\//, "") === expectedPath
  );
}

/**
 * If any attached media is out of date with the recap, rewrite it.
 * Safe to call on packet page load and after save.
 */
export async function ensurePacketMediaMatchesRecap(
  input: SyncPacketMediaFromRecapInput,
): Promise<SyncPacketMediaFromRecapResult> {
  const expected = expectedFromRecap(input);
  const { data: mediaRows, error } = await input.supabase
    .from("event_media")
    .select(
      "id, uploader_id, sequence_number, file_name, original_file_name, storage_path, dj_name, location_name, client_name, event_type, event_date, folder_path",
    )
    .eq("packet_id", input.packetId);

  if (error) {
    return { updated: 0, moved: 0, errors: [error.message], changed: false };
  }
  if (!mediaRows?.length) {
    return { updated: 0, moved: 0, errors: [], changed: false };
  }

  const needsSync = mediaRows.some(
    (row) => !mediaRowMatchesRecap(row, expected, input.packetId),
  );
  if (!needsSync) {
    return { updated: 0, moved: 0, errors: [], changed: false };
  }

  const result = await syncPacketMediaFromRecap(input);
  return { ...result, changed: result.updated > 0 || result.moved > 0 };
}

/**
 * Event details & recap is master. Rewrite tags, folder paths, display names,
 * and storage object keys for every media row on the packet — including files
 * uploaded earlier under an old name/venue.
 */
export async function syncPacketMediaFromRecap(
  input: SyncPacketMediaFromRecapInput,
): Promise<SyncPacketMediaFromRecapResult> {
  const {
    locationName,
    djName,
    eventDate,
    mediaEventType,
    clientName,
    eventFolder,
    folderPath,
  } = expectedFromRecap(input);

  const { data: mediaRows, error: listError } = await input.supabase
    .from("event_media")
    .select(
      "id, uploader_id, sequence_number, file_name, original_file_name, storage_path, storage_provider, drive_file_id, dj_name, location_name, client_name, event_type, event_date, folder_path",
    )
    .eq("packet_id", input.packetId);

  if (listError) {
    return {
      updated: 0,
      moved: 0,
      errors: [listError.message],
      changed: false,
    };
  }

  let updated = 0;
  let moved = 0;
  const errors: string[] = [];

  for (const row of mediaRows ?? []) {
    if (mediaRowMatchesRecap(row, expectedFromRecap(input), input.packetId)) {
      continue;
    }

    const sequence =
      typeof row.sequence_number === "number" && row.sequence_number > 0
        ? row.sequence_number
        : 1;
    const fileName = buildMediaFileName({
      locationName,
      djName,
      eventDate,
      sequence,
      extension: extensionFromFileName(
        String(row.file_name || row.original_file_name || "photo.jpg"),
      ),
    });

    const uploaderId = String(row.uploader_id ?? "").trim();
    const oldPath = String(row.storage_path ?? "").replace(/^\//, "");
    const newPath = uploaderId
      ? `${uploaderId}/${input.packetId}/${fileName}`
      : oldPath;
    const provider: StorageProvider =
      row.storage_provider === "bunny" ? "bunny" : "supabase";

    let storagePath = oldPath;
    if (oldPath && newPath && oldPath !== newPath) {
      const moveResult = await moveEventMediaStorageObject({
        supabase: input.supabase,
        fromPath: oldPath,
        toPath: newPath,
        provider,
      });
      if (moveResult.error) {
        errors.push(`${fileName}: ${moveResult.error}`);
        // Still update DB tags even if the object move failed.
      } else {
        storagePath = newPath;
        moved += 1;
      }
    }

    const metaChanged =
      storagePath !== oldPath ||
      fileName !== String(row.file_name ?? "") ||
      String(row.dj_name ?? "") !== djName ||
      String(row.location_name ?? "") !== locationName ||
      String(row.client_name ?? "") !== clientName ||
      String(row.event_type ?? "") !== mediaEventType ||
      String(row.event_date ?? "").slice(0, 10) !== eventDate ||
      String(row.folder_path ?? "") !== folderPath;

    const { error: updateError } = await input.supabase
      .from("event_media")
      .update({
        venue_id: input.venueId,
        event_name: eventFolder,
        event_date: eventDate,
        dj_name: djName,
        location_name: locationName,
        client_name: clientName,
        event_type: mediaEventType,
        folder_path: folderPath,
        file_name: fileName,
        storage_path: storagePath,
        // Force a fresh Drive upload into the updated folder/name on next backup.
        ...(metaChanged
          ? { drive_file_id: null, drive_synced_at: null }
          : {}),
      })
      .eq("id", row.id);

    if (updateError) {
      errors.push(`${fileName}: ${updateError.message}`);
      continue;
    }
    updated += 1;
  }

  return {
    updated,
    moved,
    errors,
    changed: updated > 0 || moved > 0,
  };
}

async function moveEventMediaStorageObject(input: {
  supabase: SupabaseClient;
  fromPath: string;
  toPath: string;
  provider: StorageProvider;
}): Promise<{ error: string | null }> {
  const fromPath = input.fromPath.replace(/^\//, "");
  const toPath = input.toPath.replace(/^\//, "");
  if (!fromPath || !toPath || fromPath === toPath) {
    return { error: null };
  }

  if (input.provider === "supabase") {
    const { error: moveError } = await input.supabase.storage
      .from(EVENT_MEDIA_BUCKET)
      .move(fromPath, toPath);
    if (!moveError) return { error: null };

    const { data: blob, error: downloadError } = await input.supabase.storage
      .from(EVENT_MEDIA_BUCKET)
      .download(fromPath);
    if (!downloadError && blob) {
      const bytes = Buffer.from(await blob.arrayBuffer());
      const uploaded = await uploadEventMediaObject({
        supabase: input.supabase,
        path: toPath,
        bytes,
        provider: "supabase",
        contentType: blob.type || undefined,
      });
      if (uploaded.error) return { error: uploaded.error };
      await deleteEventMediaObject({
        supabase: input.supabase,
        path: fromPath,
        provider: "supabase",
      });
      return { error: null };
    }

    // Source already gone — treat as done if the destination exists.
    const { data: destBlob } = await input.supabase.storage
      .from(EVENT_MEDIA_BUCKET)
      .download(toPath);
    if (destBlob) return { error: null };

    return {
      error:
        moveError.message ||
        downloadError?.message ||
        "Storage object not found to rename.",
    };
  }

  // Bunny: download via CDN URL, re-upload, delete old key.
  const access = await getEventMediaAccessUrl({
    supabase: input.supabase,
    path: fromPath,
    provider: "bunny",
    expiresIn: 300,
  });
  if (!access.url) {
    const destAccess = await getEventMediaAccessUrl({
      supabase: input.supabase,
      path: toPath,
      provider: "bunny",
      expiresIn: 60,
    });
    if (destAccess.url) return { error: null };
    return { error: access.error ?? "Could not read Bunny object." };
  }
  const response = await fetch(access.url);
  if (!response.ok) {
    if (response.status === 404) {
      const destAccess = await getEventMediaAccessUrl({
        supabase: input.supabase,
        path: toPath,
        provider: "bunny",
        expiresIn: 60,
      });
      if (destAccess.url) return { error: null };
    }
    return { error: `Bunny download failed (${response.status}).` };
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const uploaded = await uploadEventMediaObject({
    supabase: input.supabase,
    path: toPath,
    bytes,
    provider: "bunny",
    contentType: response.headers.get("content-type") || undefined,
  });
  if (uploaded.error) return { error: uploaded.error };
  await deleteEventMediaObject({
    supabase: input.supabase,
    path: fromPath,
    provider: "bunny",
  });
  return { error: null };
}
