"use client";

import { convertHeicToJpegAction } from "@/app/(app)/event-media/convert-heic-action";
import { errorDetail } from "@/lib/media/error-detail";
import { isHeicFileName, isHeicMimeType } from "@/lib/media/file-kind";
import {
  isBrowserDisplayableImageKind,
  sniffImageKind,
} from "@/lib/media/image-bytes";

async function convertBlobHeicInBrowser(blob: Blob): Promise<string> {
  const { heicTo } = await import("heic-to");
  const out = await heicTo({
    blob,
    type: "image/jpeg",
    quality: 0.92,
  });
  if (!(out instanceof Blob)) {
    throw new Error("Browser HEIC conversion returned an unexpected result.");
  }
  return URL.createObjectURL(out);
}

async function convertBlobHeicOnServer(
  blob: Blob,
  fileName: string,
): Promise<string> {
  const file = new File([blob], fileName, {
    type: blob.type || "image/heic",
  });
  const formData = new FormData();
  formData.set("file", file);
  const result = await convertHeicToJpegAction(formData);
  if (result.error || !result.base64) {
    throw new Error(result.error ?? "Server HEIC conversion failed.");
  }
  const binary = atob(result.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
}

/**
 * Resolve a displayable URL for Social Studio previews/exports.
 * Converts real HEIC/HEIF blobs; skips conversion when bytes are already JPEG/PNG
 * (common when uploads were converted but the DB filename still ends in .heic).
 */
export async function resolveDisplayableImageUrl(input: {
  url: string;
  fileName: string;
}): Promise<string> {
  const contentTypeHint = input.fileName;
  const maybeHeicName = isHeicFileName(contentTypeHint);

  // Fast path for normal files.
  if (!maybeHeicName) return input.url;

  const response = await fetch(input.url);
  if (!response.ok) {
    throw new Error("Could not load image for preview.");
  }

  const contentType = response.headers.get("content-type");
  const blob = await response.blob();
  const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const kind = sniffImageKind(header);

  // Misnamed JPEG/PNG/WebP stored with a .heic filename — show as-is.
  if (isBrowserDisplayableImageKind(kind)) {
    return input.url;
  }

  // Content-Type already says it's a normal raster (some CDNs omit magic sniff).
  if (
    contentType?.startsWith("image/") &&
    !isHeicMimeType(contentType) &&
    !isHeicMimeType(blob.type) &&
    kind !== "heic"
  ) {
    return input.url;
  }

  // Not HEIC bytes either — don't pretend conversion will work.
  if (kind !== "heic" && kind !== "unknown") {
    return input.url;
  }

  // Unknown: still try convert if filename/MIME claim HEIC; otherwise pass through.
  if (kind === "unknown" && !isHeicMimeType(contentType) && !isHeicMimeType(blob.type)) {
    // Attempt image element load via original URL (may still work).
    return input.url;
  }

  let browserError: string | null = null;
  try {
    return await convertBlobHeicInBrowser(blob);
  } catch (error) {
    browserError = errorDetail(error);
  }

  try {
    return await convertBlobHeicOnServer(blob, input.fileName);
  } catch (error) {
    // Last resort: if conversion failed because bytes weren't HEIC, show raw URL.
    const detail = errorDetail(error);
    if (/not a HEIC|HEIF image not found|input buffer is not/i.test(detail)) {
      return input.url;
    }
    throw new Error(
      `Could not preview HEIC “${input.fileName}”. Browser: ${browserError}. Server: ${detail}`,
    );
  }
}
