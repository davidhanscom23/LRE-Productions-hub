"use server";

import { convertHeicBufferToJpeg } from "@/lib/media/convert-heic-server";
import { isHeicFile } from "@/lib/media/file-kind";
import { sniffImageKind } from "@/lib/media/image-bytes";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Convert a HEIC/HEIF upload to JPEG on the server (Chrome-safe fallback).
 * Also accepts misnamed JPEG/PNG files that still have a .heic filename.
 */
export async function convertHeicToJpegAction(formData: FormData): Promise<{
  error: string | null;
  base64?: string;
  fileName?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Missing HEIC file." };
  }
  if (file.size > MAX_BYTES) {
    return {
      error:
        "This HEIC file is too large to convert in the Hub (max 12 MB). Export it as JPEG from Photos, then upload.",
    };
  }

  try {
    const input = Buffer.from(await file.arrayBuffer());
    const kind = sniffImageKind(input);
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";

    // Already a normal image mislabeled as HEIC — pass through.
    if (kind === "jpeg" || kind === "png" || kind === "webp" || kind === "gif") {
      const ext = kind === "jpeg" ? "jpg" : kind;
      return {
        error: null,
        base64: input.toString("base64"),
        fileName: `${base}.${ext}`,
      };
    }

    if (!isHeicFile(file) && kind !== "heic") {
      return { error: "File is not HEIC/HEIF." };
    }

    const jpeg = await convertHeicBufferToJpeg(input, 0.92);
    return {
      error: null,
      base64: jpeg.toString("base64"),
      fileName: `${base}.jpg`,
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "HEIC decode failed on server.";
    return {
      error: `Could not convert “${file.name}” from HEIC on the server. (${detail})`,
    };
  }
}
