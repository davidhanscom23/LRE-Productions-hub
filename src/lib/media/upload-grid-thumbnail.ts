"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { makeThumbnailFile } from "@/lib/media/optimize-image";
import { eventMediaThumbPath } from "@/lib/storage/thumb-path";

/**
 * Best-effort: create and upload the small grid thumbnail beside an original
 * that was just uploaded to Supabase storage. Failures are swallowed — the
 * grid simply falls back to the full-size image.
 */
export async function uploadGridThumbnail(
  supabase: SupabaseClient,
  storagePath: string,
  file: File,
): Promise<boolean> {
  try {
    const thumb = await makeThumbnailFile(file);
    if (!thumb) return false;
    const { error } = await supabase.storage
      .from("event-media")
      .upload(eventMediaThumbPath(storagePath), thumb, {
        upsert: true,
        contentType: "image/jpeg",
        cacheControl: "31536000",
      });
    return !error;
  } catch {
    return false;
  }
}
