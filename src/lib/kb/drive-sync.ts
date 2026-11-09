import "server-only";

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/admin";
import { getDriveClient } from "@/lib/drive/client";
import {
  DRIVE_KB_INDEXABLE_MIMES,
  driveKbKindForMime,
  exportDriveFileAsText,
} from "@/lib/drive/export-text";
import { chunkText, embedTexts, isAiConfigured } from "@/lib/kb";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const LIST_FIELDS =
  "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink, trashed)";

/** Folder name prefixes / exact names we skip while crawling (media noise). */
const SKIP_FOLDER_NAMES = [
  "event packets",
  "event packet",
  "social studio",
  "image studio",
  "marketing queue",
  "media backup",
  "backups",
];

export type DriveKbSyncResult = {
  ran: boolean;
  listed: number;
  upserted: number;
  skipped: number;
  deleted: number;
  error: string | null;
};

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function shouldSkipFolder(name: string): boolean {
  const n = name.trim().toLowerCase();
  return SKIP_FOLDER_NAMES.some((s) => n === s || n.startsWith(`${s} `));
}

async function reindexDocument(
  supabase: SupabaseClient,
  documentId: string,
  content: string,
): Promise<number> {
  await supabase.from("kb_chunks").delete().eq("document_id", documentId);
  const parts = chunkText(content);
  if (parts.length === 0 || !isAiConfigured()) return 0;
  const embeddings = await embedTexts(parts);
  const rows = parts.map((chunk, i) => ({
    document_id: documentId,
    content: chunk,
    embedding: embeddings[i],
  }));
  await supabase.from("kb_chunks").insert(rows);
  return rows.length;
}

type CrawlFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string | null;
  path: string;
};

/**
 * BFS crawl under the Hub Drive root. Collects indexable files (Docs/Sheets/PDF/DOCX).
 */
async function crawlIndexableFiles(opts: {
  maxFiles: number;
}): Promise<{ files: CrawlFile[]; listed: number; error: string | null }> {
  let drive;
  let rootFolderId: string;
  try {
    const client = await getDriveClient();
    drive = client.drive;
    rootFolderId = client.rootFolderId;
  } catch (error) {
    return {
      files: [],
      listed: 0,
      error:
        error instanceof Error
          ? error.message
          : "Google Drive is not configured.",
    };
  }

  const queue: { id: string; path: string }[] = [
    { id: rootFolderId, path: "" },
  ];
  const seenFolders = new Set<string>();
  const files: CrawlFile[] = [];
  let listed = 0;

  while (queue.length > 0 && files.length < opts.maxFiles) {
    const folder = queue.shift()!;
    if (seenFolders.has(folder.id)) continue;
    seenFolders.add(folder.id);

    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: `'${folder.id}' in parents and trashed = false`,
        fields: LIST_FIELDS,
        pageSize: 200,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      pageToken = res.data.nextPageToken ?? undefined;

      for (const f of res.data.files ?? []) {
        listed += 1;
        const id = f.id ?? "";
        const name = f.name ?? "Untitled";
        const mimeType = f.mimeType ?? "";
        if (!id) continue;

        if (mimeType === FOLDER_MIME) {
          if (shouldSkipFolder(name)) continue;
          const childPath = folder.path ? `${folder.path}/${name}` : name;
          queue.push({ id, path: childPath });
          continue;
        }

        if (!driveKbKindForMime(mimeType)) continue;
        if (files.length >= opts.maxFiles) break;

        files.push({
          id,
          name,
          mimeType,
          modifiedTime: f.modifiedTime ?? "",
          webViewLink: f.webViewLink ?? null,
          path: folder.path,
        });
      }
    } while (pageToken && files.length < opts.maxFiles);
  }

  return { files, listed, error: null };
}

/**
 * Crawl the Hub Drive root and upsert Docs / Sheets / PDF / DOCX into Ask KB
 * (`source_type: drive`). Incremental via kb_drive_file_state.modified_time + content hash.
 */
export async function syncDriveKnowledgeBase(opts?: {
  maxFiles?: number;
  force?: boolean;
  client?: SupabaseClient;
}): Promise<DriveKbSyncResult> {
  const maxFiles = Math.min(Math.max(opts?.maxFiles ?? 80, 1), 250);
  const force = opts?.force === true;
  const supabase = opts?.client ?? createServiceClient();

  if (!isAiConfigured()) {
    return {
      ran: false,
      listed: 0,
      upserted: 0,
      skipped: 0,
      deleted: 0,
      error: "OPENAI_API_KEY is not configured — cannot embed Drive files.",
    };
  }

  const crawled = await crawlIndexableFiles({ maxFiles });
  if (crawled.error) {
    return {
      ran: false,
      listed: crawled.listed,
      upserted: 0,
      skipped: 0,
      deleted: 0,
      error: crawled.error,
    };
  }

  let drive;
  try {
    drive = (await getDriveClient()).drive;
  } catch (error) {
    return {
      ran: false,
      listed: crawled.listed,
      upserted: 0,
      skipped: 0,
      deleted: 0,
      error:
        error instanceof Error
          ? error.message
          : "Google Drive is not configured.",
    };
  }

  const fileIds = crawled.files.map((f) => f.id);
  const { data: priorRows } = await supabase
    .from("kb_drive_file_state")
    .select("file_id, modified_time, content_sha, document_id")
    .in("file_id", fileIds.length ? fileIds : ["__none__"]);

  const prior = new Map(
    (priorRows ?? []).map((r) => [
      String(r.file_id),
      {
        modified_time: String(r.modified_time ?? ""),
        content_sha: String(r.content_sha ?? ""),
        document_id: r.document_id ? String(r.document_id) : null,
      },
    ]),
  );

  let upserted = 0;
  let skipped = 0;

  for (const file of crawled.files) {
    const prev = prior.get(file.id);
    if (
      !force &&
      prev &&
      prev.modified_time &&
      prev.modified_time === file.modifiedTime &&
      prev.document_id
    ) {
      skipped += 1;
      continue;
    }

    const exported = await exportDriveFileAsText(
      drive,
      file.id,
      file.mimeType,
    );
    if (!exported.ok) {
      await supabase.from("kb_drive_file_state").upsert(
        {
          file_id: file.id,
          name: file.name,
          mime_type: file.mimeType,
          modified_time: file.modifiedTime,
          content_sha: "",
          document_id: prev?.document_id ?? null,
          skip_reason: exported.error.slice(0, 500),
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "file_id" },
      );
      skipped += 1;
      continue;
    }

    const pathLabel = file.path ? `${file.path}/` : "";
    const title = `${pathLabel}${file.name}`.slice(0, 300);
    const content = [
      title,
      file.webViewLink ? `Drive: ${file.webViewLink}` : "",
      "",
      exported.text,
    ]
      .filter(Boolean)
      .join("\n");
    const hash = sha256(content);

    if (!force && prev?.content_sha === hash && prev.document_id) {
      await supabase.from("kb_drive_file_state").upsert(
        {
          file_id: file.id,
          name: file.name,
          mime_type: file.mimeType,
          modified_time: file.modifiedTime,
          content_sha: hash,
          document_id: prev.document_id,
          skip_reason: "",
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "file_id" },
      );
      skipped += 1;
      continue;
    }

    let documentId = prev?.document_id ?? null;
    if (documentId) {
      const { error } = await supabase
        .from("kb_documents")
        .update({
          title,
          content,
          source_type: "drive",
          source_id: file.id,
        })
        .eq("id", documentId);
      if (error) {
        skipped += 1;
        continue;
      }
    } else {
      const { data: existing } = await supabase
        .from("kb_documents")
        .select("id")
        .eq("source_type", "drive")
        .eq("source_id", file.id)
        .maybeSingle();
      if (existing?.id) {
        documentId = String(existing.id);
        await supabase
          .from("kb_documents")
          .update({ title, content })
          .eq("id", documentId);
      } else {
        const { data: inserted, error } = await supabase
          .from("kb_documents")
          .insert({
            title,
            source_type: "drive",
            source_id: file.id,
            content,
          })
          .select("id")
          .single();
        if (error || !inserted?.id) {
          skipped += 1;
          continue;
        }
        documentId = String(inserted.id);
      }
    }

    await reindexDocument(supabase, documentId, content);
    await supabase.from("kb_drive_file_state").upsert(
      {
        file_id: file.id,
        name: file.name,
        mime_type: file.mimeType,
        modified_time: file.modifiedTime,
        content_sha: hash,
        document_id: documentId,
        skip_reason: "",
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "file_id" },
    );
    upserted += 1;
  }

  // Drop KB drive docs that are no longer under the crawl set (best-effort for this run's max).
  let deleted = 0;
  if (crawled.files.length > 0 && crawled.files.length < maxFiles) {
    // Only purge when we believe the crawl finished within the cap.
    const keep = new Set(crawled.files.map((f) => f.id));
    const { data: allDriveDocs } = await supabase
      .from("kb_documents")
      .select("id, source_id")
      .eq("source_type", "drive");
    for (const doc of allDriveDocs ?? []) {
      const sid = String(doc.source_id ?? "");
      if (sid && !keep.has(sid)) {
        await supabase.from("kb_chunks").delete().eq("document_id", doc.id);
        await supabase.from("kb_documents").delete().eq("id", doc.id);
        await supabase.from("kb_drive_file_state").delete().eq("file_id", sid);
        deleted += 1;
      }
    }
  }

  return {
    ran: true,
    listed: crawled.listed,
    upserted,
    skipped,
    deleted,
    error: null,
  };
}

/** MIME allowlist exported for tests / docs. */
export const DRIVE_KB_MIME_ALLOWLIST = DRIVE_KB_INDEXABLE_MIMES;
