"use client";

/**
 * Client-side image optimization.
 *
 * The hub has no server-side image pipeline (no sharp; Supabase image
 * transformations are a paid add-on), so oversized camera originals were
 * uploaded — and re-downloaded by every gallery view — at full resolution.
 * That burned through the Supabase egress quota.
 *
 * - compressImageFile: caps very large originals (default 2560px long edge,
 *   JPEG q0.85) before upload.
 * - makeThumbnailFile: small JPEG (default 512px) used for gallery grids.
 *
 * Both are best-effort: on any failure the caller gets the original file
 * (or null for thumbnails) and the upload proceeds unchanged.
 */

type OptimizeOptions = {
  maxEdge?: number;
  quality?: number;
};

const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function isCompressibleImage(file: File): boolean {
  return COMPRESSIBLE_TYPES.has(file.type.toLowerCase());
}

async function renderScaled(
  file: File,
  maxEdge: number,
  quality: number,
  outputType: "image/jpeg" | "image/png",
): Promise<File | null> {
  if (typeof document === "undefined") return null;

  let source: CanvasImageSource;
  let width = 0;
  let height = 0;
  let cleanup: () => void = () => {};

  try {
    const bitmap = await createImageBitmap(file);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    cleanup = () => bitmap.close();
  } catch {
    // Fallback decode via <img> for browsers/files createImageBitmap rejects.
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not decode image."));
        el.src = url;
      });
      source = img;
      width = img.naturalWidth;
      height = img.naturalHeight;
      cleanup = () => URL.revokeObjectURL(url);
    } catch {
      URL.revokeObjectURL(url);
      return null;
    }
  }

  try {
    if (!width || !height) return null;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, quality),
    );
    if (!blob || blob.size === 0) return null;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    const ext = outputType === "image/png" ? "png" : "jpg";
    return new File([blob], `${base}.${ext}`, {
      type: outputType,
      lastModified: Date.now(),
    });
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

/**
 * Shrink an oversized image before upload. Returns the original file when it
 * is not a resizable image, already smaller than the re-encoded result, or
 * anything goes wrong. PNGs stay PNG so transparency survives.
 */
export async function compressImageFile(
  file: File,
  options: OptimizeOptions = {},
): Promise<File> {
  if (!isCompressibleImage(file)) return file;
  const outputType =
    file.type.toLowerCase() === "image/png" ? "image/png" : "image/jpeg";
  const result = await renderScaled(
    file,
    options.maxEdge ?? 2560,
    options.quality ?? 0.85,
    outputType,
  );
  if (!result || result.size >= file.size) return file;
  return result;
}

/** Small JPEG for gallery grids; null when the file can't be thumbnailed. */
export async function makeThumbnailFile(
  file: File,
  options: OptimizeOptions = {},
): Promise<File | null> {
  if (!isCompressibleImage(file)) return null;
  return renderScaled(
    file,
    options.maxEdge ?? 512,
    options.quality ?? 0.75,
    "image/jpeg",
  );
}
