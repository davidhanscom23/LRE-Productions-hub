/**
 * Grid thumbnail convention for event media.
 * A thumbnail lives beside its original at `<storage_path>.thumb.jpg`.
 * Shared by client code (upload, backfill) and server code (signing, deletion).
 */
export const EVENT_MEDIA_THUMB_SUFFIX = ".thumb.jpg";

export function eventMediaThumbPath(storagePath: string): string {
  return `${storagePath.replace(/^\//, "")}${EVENT_MEDIA_THUMB_SUFFIX}`;
}
