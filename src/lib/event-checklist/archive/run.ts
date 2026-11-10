import "server-only";

import JSZip from "jszip";
import { getDriveClient, ensureChildFolder, uploadFileToFolder, isDriveConfigured } from "@/lib/drive/client";
import { insertNotifications } from "@/lib/notifications/notify";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  ARCHIVE_FOLDER_NAME,
  DEFAULT_BACKUP_DRIVE_ID,
  MAX_ROWS_PER_ZIP,
  MAX_ZIP_BYTES,
  archiveCutoff,
  archiveFileName,
  buildCsv,
  liveWindowCutoff,
  photoFileName,
  type ArchiveCheckRow,
} from "./format";

export type ArchiveRunResult = {
  archivedZips: number;
  archivedRows: number;
  archivedPhotos: number;
  purgedPhotos: number;
  skipped?: string;
  error?: string;
};

const BUCKET = "checklist-photos";
/** A run stops after this many zips; the January catch-up days finish any remainder. */
const MAX_ZIPS_PER_RUN = 6;

function backupFolderId(): string {
  return process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID?.trim() || DEFAULT_BACKUP_DRIVE_ID;
}

type RawCheck = {
  id: string;
  checked_at: string;
  project_name: string | null;
  event_date: string | null;
  item_name: string | null;
  pass: "out" | "back";
  qty: number | string;
  flag: "none" | "damaged" | "missing";
  note: string | null;
  photo_path: string | null;
  profiles: { full_name?: string } | { full_name?: string }[] | null;
};

function toRow(r: RawCheck): ArchiveCheckRow {
  const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
  return {
    id: r.id,
    checked_at: r.checked_at,
    project_name: r.project_name ?? "",
    event_date: r.event_date,
    item_name: r.item_name ?? "",
    pass: r.pass,
    qty: Number(r.qty),
    flag: r.flag,
    note: r.note ?? "",
    checked_by_name: prof?.full_name || "Staff",
    photo_path: r.photo_path,
  };
}

async function notifyAdmins(title: string, body: string) {
  const supabase = createServiceClient();
  const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin");
  await insertNotifications(
    supabase,
    (admins ?? []).map((a) => ({
      userId: a.id as string,
      kind: "gear_checklist",
      title,
      body,
      href: "/event-checklist",
    })),
  );
}

/** Zip one batch (spreadsheet + photos), upload it, check the upload, then mark the rows archived. */
async function archiveBatch(now: Date, cutoff: Date, part: number, folderId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("event_checklist_checks")
    .select(
      "id, checked_at, project_name, event_date, item_name, pass, qty, flag, note, photo_path, profiles:checked_by(full_name)",
    )
    .is("archived_at", null)
    .lt("checked_at", cutoff.toISOString())
    .order("checked_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(MAX_ROWS_PER_ZIP);
  if (error) throw new Error(error.message);
  const candidates = ((data ?? []) as unknown as RawCheck[]).map(toRow);
  if (!candidates.length) return null;

  const zip = new JSZip();
  const photoNames = new Map<string, string>();
  const rows: ArchiveCheckRow[] = [];
  let photoBytes = 0;
  for (const row of candidates) {
    if (row.photo_path) {
      const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(row.photo_path);
      if (dlError || !blob) {
        // Missing from storage (already gone): archive the row, just without a photo file.
        rows.push(row);
        continue;
      }
      const bytes = Buffer.from(await blob.arrayBuffer());
      if (rows.length > 0 && photoBytes + bytes.length > MAX_ZIP_BYTES) break;
      const name = photoFileName(row);
      zip.file(name, bytes);
      photoNames.set(row.id, name);
      photoBytes += bytes.length;
    }
    rows.push(row);
  }

  zip.file("history.csv", buildCsv(rows, photoNames));
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        archivedAt: now.toISOString(),
        rows: rows.length,
        photos: photoNames.size,
        firstCheckedAt: rows[0].checked_at,
        lastCheckedAt: rows[rows.length - 1].checked_at,
      },
      null,
      2,
    ),
  );
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  const fileName = archiveFileName(now, part);
  const driveFileId = await uploadFileToFolder({
    parentId: folderId,
    fileName,
    mimeType: "application/zip",
    bytes: buffer,
  });

  // Confirm Drive really holds the whole file before anything is marked archived.
  const { drive } = await getDriveClient();
  const meta = await drive.files.get({ fileId: driveFileId, fields: "id,size", supportsAllDrives: true });
  if (Number(meta.data.size ?? 0) !== buffer.length) {
    throw new Error(`Drive copy of ${fileName} is ${meta.data.size} bytes, expected ${buffer.length}.`);
  }

  const { data: archive, error: archiveError } = await supabase
    .from("event_checklist_archives")
    .insert({
      file_name: fileName,
      drive_file_id: driveFileId,
      drive_folder_id: folderId,
      row_count: rows.length,
      photo_count: photoNames.size,
      bytes: buffer.length,
      first_checked_at: rows[0].checked_at,
      last_checked_at: rows[rows.length - 1].checked_at,
    })
    .select("id")
    .single();
  if (archiveError || !archive) throw new Error(archiveError?.message ?? "Could not record the archive.");

  const ids = rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 100) {
    const { error: markError } = await supabase
      .from("event_checklist_checks")
      .update({ archived_at: now.toISOString(), archive_id: archive.id })
      .in("id", ids.slice(i, i + 100));
    if (markError) throw new Error(markError.message);
  }

  return { rows: rows.length, photos: photoNames.size };
}

/** Remove photos that are safely archived and older than the live window. */
export async function purgeArchivedPhotos(now: Date): Promise<number> {
  const supabase = createServiceClient();
  const before = liveWindowCutoff(now).toISOString();
  let purged = 0;
  for (let i = 0; i < 20; i += 1) {
    const { data, error } = await supabase
      .from("event_checklist_checks")
      .select("id, photo_path")
      .not("archived_at", "is", null)
      .not("photo_path", "is", null)
      .lt("checked_at", before)
      .limit(100);
    if (error || !data?.length) break;
    const paths = data.map((r) => r.photo_path as string);
    const { error: rmError } = await supabase.storage.from(BUCKET).remove(paths);
    if (rmError) break;
    for (const r of data) {
      await supabase
        .from("event_checklist_checks")
        .update({ photo_archived_path: r.photo_path, photo_path: null })
        .eq("id", r.id as string);
    }
    purged += data.length;
  }
  return purged;
}

/**
 * Daily cron entry point. Archives on Dec 31 (and the first week of January as a catch-up), and
 * every day removes photos that are archived and past the 90-day live window.
 */
export async function runChecklistArchive(
  now: Date = new Date(),
  opts: { force?: boolean } = {},
): Promise<ArchiveRunResult> {
  const result: ArchiveRunResult = { archivedZips: 0, archivedRows: 0, archivedPhotos: 0, purgedPhotos: 0 };
  const cutoff = archiveCutoff(now, opts.force);

  if (!cutoff) {
    result.skipped = "Not archive time; only cleaning up old photos.";
  } else if (!(await isDriveConfigured())) {
    result.error = "Google Drive is not configured.";
  } else {
    try {
      const folderId = await ensureChildFolder(backupFolderId(), ARCHIVE_FOLDER_NAME);
      for (let part = 1; part <= MAX_ZIPS_PER_RUN; part += 1) {
        const done = await archiveBatch(now, cutoff, part, folderId);
        if (!done) break;
        result.archivedZips += 1;
        result.archivedRows += done.rows;
        result.archivedPhotos += done.photos;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      result.error = /not found|permission|forbidden|insufficient/i.test(message)
        ? `${message} Check that the Drive service account is a Content manager on the LRE Hub Backup shared drive.`
        : message;
    }
    try {
      if (result.error) {
        await notifyAdmins("Checklist history archive failed", result.error);
      } else if (result.archivedRows > 0) {
        await notifyAdmins(
          "Checklist history archived",
          `${result.archivedRows} checks and ${result.archivedPhotos} photos were saved to the LRE Hub Backup drive (${result.archivedZips} zip${result.archivedZips === 1 ? "" : "s"}).`,
        );
      }
    } catch {
      // The notice is best effort.
    }
  }

  result.purgedPhotos = await purgeArchivedPhotos(now);
  return result;
}
