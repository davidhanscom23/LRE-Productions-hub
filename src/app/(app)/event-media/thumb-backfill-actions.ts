"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { EVENT_MEDIA_BUCKET } from "@/lib/storage/event-media";
import { eventMediaThumbPath, EVENT_MEDIA_THUMB_SUFFIX } from "@/lib/storage/thumb-path";

/**
 * Admin-only, one-time backfill: generate grid thumbnails for event media
 * uploaded before thumbnails existed. Thumbnail bytes are produced in the
 * admin's browser (no server-side image pipeline), then uploaded here with
 * the service role so the admin can write into other uploaders' folders.
 */

export type ThumbBackfillCandidate = {
  id: string;
  storage_path: string;
  file_name: string;
  /** Short-lived signed URL for the original, used to render the thumbnail. */
  signed_url: string;
};

const MAX_THUMB_BYTES = 1_000_000; // thumbnails are ~20-80KB; 1MB is generous

async function requireAdmin(): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return "Admin access required.";
  }
  if (!isServiceRoleConfigured()) {
    return "SUPABASE_SERVICE_ROLE_KEY is not configured.";
  }
  return null;
}

export async function listThumbBackfillCandidatesAction(): Promise<{
  error: string | null;
  candidates: ThumbBackfillCandidate[];
  total_images: number;
}> {
  const denied = await requireAdmin();
  if (denied) return { error: denied, candidates: [], total_images: 0 };

  const service = createServiceClient();
  const { data: rows, error } = await service
    .from("event_media")
    .select("id, storage_path, file_name, media_type, storage_provider")
    .or("media_type.eq.image,media_type.like.image/%")
    .limit(2000);
  if (error) return { error: error.message, candidates: [], total_images: 0 };

  const images = (rows ?? []).filter(
    (row) =>
      row.storage_provider !== "bunny" &&
      typeof row.storage_path === "string" &&
      row.storage_path.length > 0 &&
      !row.storage_path.endsWith(EVENT_MEDIA_THUMB_SUFFIX),
  );
  if (images.length === 0) return { error: null, candidates: [], total_images: 0 };

  // Which already have thumbnails?
  const thumbPaths = images.map((row) => eventMediaThumbPath(row.storage_path));
  const { data: thumbChecks } = await service.storage
    .from(EVENT_MEDIA_BUCKET)
    .createSignedUrls(thumbPaths, 60);
  const hasThumb = new Set(
    (thumbChecks ?? [])
      .filter((item) => !item.error && item.signedUrl)
      .map((item) => item.path ?? ""),
  );

  const missing = images.filter(
    (row) => !hasThumb.has(eventMediaThumbPath(row.storage_path)),
  );
  if (missing.length === 0) {
    return { error: null, candidates: [], total_images: images.length };
  }

  const { data: originals, error: signError } = await service.storage
    .from(EVENT_MEDIA_BUCKET)
    .createSignedUrls(missing.map((row) => row.storage_path), 1800);
  if (signError) {
    return { error: signError.message, candidates: [], total_images: images.length };
  }

  const urlByPath = new Map(
    (originals ?? [])
      .filter((item) => !item.error && item.signedUrl)
      .map((item) => [item.path ?? "", item.signedUrl] as const),
  );

  const candidates: ThumbBackfillCandidate[] = [];
  for (const row of missing) {
    const url = urlByPath.get(row.storage_path);
    if (!url) continue;
    candidates.push({
      id: String(row.id),
      storage_path: row.storage_path,
      file_name: String(row.file_name ?? row.storage_path),
      signed_url: url,
    });
  }
  return { error: null, candidates, total_images: images.length };
}

export async function uploadThumbBackfillAction(formData: FormData): Promise<{
  error: string | null;
}> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const storagePath = String(formData.get("storage_path") ?? "").trim().replace(/^\//, "");
  const file = formData.get("file");
  if (!storagePath || !(file instanceof File)) {
    return { error: "Missing thumbnail or storage path." };
  }
  if (file.size === 0 || file.size > MAX_THUMB_BYTES) {
    return { error: "Thumbnail must be between 1 byte and 1MB." };
  }

  const service = createServiceClient();
  // Only allow thumbnails beside a real event_media original.
  const { data: row } = await service
    .from("event_media")
    .select("id")
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (!row) return { error: "No event media row matches that storage path." };

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await service.storage
    .from(EVENT_MEDIA_BUCKET)
    .upload(eventMediaThumbPath(storagePath), bytes, {
      upsert: true,
      contentType: "image/jpeg",
      cacheControl: "31536000",
    });
  return { error: error?.message ?? null };
}
