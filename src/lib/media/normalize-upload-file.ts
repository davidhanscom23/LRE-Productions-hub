"use client";

import { convertHeicToJpegAction } from "@/app/(app)/event-media/convert-heic-action";
import { errorDetail } from "@/lib/media/error-detail";
import { isHeicFile } from "@/lib/media/file-kind";
import { compressImageFile } from "@/lib/media/optimize-image";

function jpegFileFromBlob(blob: Blob, originalName: string): File {
  const base = originalName.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function jpegFileFromBase64(base64: string, fileName: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

async function convertHeicInBrowser(file: File): Promise<File> {
  const { heicTo } = await import("heic-to");
  const blob = await heicTo({
    blob: file,
    type: "image/jpeg",
    quality: 0.92,
  });
  if (!(blob instanceof Blob)) {
    throw new Error("Browser HEIC conversion returned an unexpected result.");
  }
  return jpegFileFromBlob(blob, file.name);
}

async function convertHeicOnServer(file: File): Promise<File> {
  const formData = new FormData();
  formData.set("file", file);
  const result = await convertHeicToJpegAction(formData);
  if (result.error || !result.base64 || !result.fileName) {
    throw new Error(result.error ?? "Server HEIC conversion failed.");
  }
  return jpegFileFromBase64(result.base64, result.fileName);
}

/**
 * Normalize a selected file for upload.
 * Converts HEIC/HEIF to JPEG (browser first, server fallback) so Chrome works,
 * then shrinks oversized images (2560px long edge) to keep storage egress low.
 */
export async function normalizeUploadFile(file: File): Promise<File> {
  if (!isHeicFile(file)) return compressImageFile(file);

  let browserError: string | null = null;
  try {
    return await compressImageFile(await convertHeicInBrowser(file));
  } catch (error) {
    browserError = errorDetail(error);
  }

  try {
    return await compressImageFile(await convertHeicOnServer(file));
  } catch (error) {
    const serverError = errorDetail(error);
    throw new Error(
      `Could not convert “${file.name}” from HEIC. Browser: ${browserError}. Server: ${serverError}`,
    );
  }
}
