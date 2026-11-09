/** Shared helpers for Event Packet / Social Studio media uploads. */

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "heic",
  "heif",
  "avif",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mov",
  "m4v",
  "webm",
  "avi",
  "mkv",
  "3gp",
]);

const HEIC_EXTENSIONS = new Set(["heic", "heif"]);

export const EVENT_MEDIA_FILE_ACCEPT =
  "image/*,video/*,.heic,.heif,image/heic,image/heif";

export function extensionFromName(fileName: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return match?.[1]?.toLowerCase() ?? "";
}

export function isHeicFileName(fileName: string): boolean {
  return HEIC_EXTENSIONS.has(extensionFromName(fileName));
}

export function isHeicMimeType(mimeType: string | null | undefined): boolean {
  const type = (mimeType ?? "").toLowerCase();
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    type === "image/heif-sequence"
  );
}

export function isHeicFile(file: Pick<File, "name" | "type">): boolean {
  return isHeicMimeType(file.type) || isHeicFileName(file.name);
}

export function isImageFile(file: Pick<File, "name" | "type">): boolean {
  if (file.type.startsWith("image/") || isHeicFile(file)) return true;
  return IMAGE_EXTENSIONS.has(extensionFromName(file.name));
}

export function isVideoFile(file: Pick<File, "name" | "type">): boolean {
  if (file.type.startsWith("video/")) return true;
  return VIDEO_EXTENSIONS.has(extensionFromName(file.name));
}

export function isAllowedEventMediaFile(
  file: Pick<File, "name" | "type">,
): boolean {
  return isImageFile(file) || isVideoFile(file);
}

export function isImageMediaItem(item: {
  media_type: string;
  file_name: string;
}): boolean {
  const type = item.media_type.toLowerCase();
  if (type === "image" || type.startsWith("image")) return true;
  return IMAGE_EXTENSIONS.has(extensionFromName(item.file_name));
}

export function isVideoMediaItem(item: {
  media_type: string;
  file_name: string;
}): boolean {
  const type = item.media_type.toLowerCase();
  if (type === "video" || type.startsWith("video")) return true;
  return VIDEO_EXTENSIONS.has(extensionFromName(item.file_name));
}
