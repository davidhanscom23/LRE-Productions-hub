import "server-only";

import convert from "heic-convert";
import { sniffImageKind } from "@/lib/media/image-bytes";

/**
 * Server-side HEIC/HEIF → JPEG using libheif (works independent of the browser).
 * If the buffer is already JPEG/PNG/WebP/GIF, returns it unchanged.
 */
export async function convertHeicBufferToJpeg(
  input: Buffer,
  quality = 0.92,
): Promise<Buffer> {
  const kind = sniffImageKind(input);
  if (kind === "jpeg") return input;
  if (kind === "png" || kind === "webp" || kind === "gif") {
    // Already a browser-safe raster; callers treat output as JPEG filename,
    // but PNG/WebP bytes are fine for preview. Re-encode only HEIC.
    return input;
  }

  const output = await convert({
    buffer: input,
    format: "JPEG",
    quality,
  });
  return Buffer.from(output);
}
