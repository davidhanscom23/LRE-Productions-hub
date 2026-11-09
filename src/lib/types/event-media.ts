import { isImageFile, isVideoFile } from "@/lib/media/file-kind";

export type EventMediaType = "image" | "video" | "other";

export type EventMediaUploader = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
};

export type EventMedia = {
  id: string;
  uploader_id: string;
  event_name: string;
  event_date: string;
  storage_path: string;
  storage_provider?: "supabase" | "bunny";
  file_name: string;
  media_type: string;
  created_at: string;
  folder_path?: string;
  location_name?: string;
  dj_name?: string;
  client_name?: string;
  uploader: EventMediaUploader | null;
  signed_url?: string | null;
  /** Small grid thumbnail URL; galleries fall back to signed_url when null. */
  thumb_url?: string | null;
};

export function mediaTypeFromFile(file: File): EventMediaType {
  if (isImageFile(file)) return "image";
  if (isVideoFile(file)) return "video";
  return "other";
}

export function eventMediaGroupKey(item: {
  event_name: string;
  event_date: string;
}) {
  return `${item.event_date}::${item.event_name}`;
}
