"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import {
  downloadHiggsfieldImage,
  getHiggsfieldRequestStatus,
} from "@/lib/higgsfield/client";
import { isHiggsfieldConfigured } from "@/lib/higgsfield/credentials";
import { isGeminiConfigured } from "@/lib/gemini/credentials";
import {
  buildEventFolderName,
  buildFolderPath,
  buildMediaFileName,
  extensionFromFileName,
  folderSlugFromName,
  sanitizeNamePart,
} from "@/lib/event-packets/naming";
import {
  getStudioImageModel,
  resolveStudioImageModelId,
  type StudioImageModelId,
} from "@/lib/social/image-gen-models";
import { runStudioImageGeneration } from "@/lib/social/run-image-generation";
import {
  getEventMediaAccessUrl,
  getEventMediaStorageProvider,
  uploadEventMediaObject,
  type StorageProvider,
} from "@/lib/storage/event-media";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { error: "Only admins can use Image Studio." as const };
  }

  return { supabase, user, profile, error: null as null };
}

function parseDataUrl(dataUrl: string): {
  bytes: Buffer;
  contentType: string;
  extension: string;
} | null {
  const trimmed = dataUrl.trim();
  const prefix = trimmed.match(/^data:([^;]+);base64,/);
  if (!prefix) return null;
  const contentType = prefix[1] || "image/png";
  const b64 = trimmed.slice(prefix[0].length);
  const bytes = Buffer.from(b64, "base64");
  if (bytes.length < 32) return null;
  let extension = "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    extension = "jpg";
  } else if (contentType.includes("webp")) {
    extension = "webp";
  }
  return { bytes, contentType, extension };
}

async function resolveImageBytes(input: {
  imageDataUrl?: string;
  imageUrl?: string;
}): Promise<{
  error: string | null;
  bytes?: Buffer;
  contentType?: string;
  extension?: string;
}> {
  if (input.imageDataUrl?.startsWith("data:")) {
    const parsed = parseDataUrl(input.imageDataUrl);
    if (!parsed) return { error: "Invalid image data." };
    return { error: null, ...parsed };
  }
  if (input.imageUrl?.startsWith("http")) {
    try {
      const downloaded = await downloadHiggsfieldImage(input.imageUrl);
      return { error: null, ...downloaded };
    } catch (err) {
      return {
        error:
          err instanceof Error ? err.message : "Could not download image.",
      };
    }
  }
  return { error: "Image data is required." };
}

export async function getImageStudioConfigAction(): Promise<{
  geminiConfigured: boolean;
  higgsfieldConfigured: boolean;
}> {
  return {
    geminiConfigured: isGeminiConfigured(),
    higgsfieldConfigured: isHiggsfieldConfigured(),
  };
}

export async function generateImageStudioAction(input: {
  prompt: string;
  modelId?: string;
  aspectRatio?: string;
  imageSize?: string;
}): Promise<{
  error: string | null;
  provider?: "gemini" | "higgsfield";
  modelId?: StudioImageModelId;
  aspectRatio?: string;
  imageSize?: string;
  requestId?: string;
  previewDataUrl?: string;
  notice?: string;
}> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const result = await runStudioImageGeneration(input);
  if (result.error !== null) return { error: result.error };

  if (result.provider === "gemini") {
    return {
      error: null,
      provider: "gemini",
      modelId: result.modelId,
      aspectRatio: result.aspectRatio,
      imageSize: result.imageSize,
      previewDataUrl: `data:${result.contentType};base64,${result.bytes.toString("base64")}`,
      notice: result.notice,
    };
  }

  return {
    error: null,
    provider: "higgsfield",
    modelId: result.modelId,
    aspectRatio: result.aspectRatio,
    requestId: result.requestId,
    notice: result.notice,
  };
}

export async function pollImageStudioHiggsfieldAction(
  requestId: string,
): Promise<{
  error: string | null;
  status?: string;
  imageUrl?: string | null;
  done?: boolean;
}> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };
  if (!isHiggsfieldConfigured()) {
    return { error: "Higgsfield is not configured." };
  }

  try {
    const result = await getHiggsfieldRequestStatus(requestId);
    const status = result.status.toLowerCase();
    const terminal =
      status === "completed" ||
      status === "failed" ||
      status === "nsfw" ||
      status === "canceled" ||
      status === "cancelled";

    if (status === "failed") {
      return {
        error: "Generation failed. Credits for this request are refunded.",
        status,
        done: true,
      };
    }
    if (status === "nsfw") {
      return {
        error:
          "Content was rejected by moderation. Credits for this request are refunded.",
        status,
        done: true,
      };
    }
    if (status === "canceled" || status === "cancelled") {
      return { error: "Generation was canceled.", status, done: true };
    }
    if (status === "completed" && !result.imageUrl) {
      return {
        error: "Generation completed but no image URL was returned.",
        status,
        done: true,
      };
    }

    return {
      error: null,
      status,
      imageUrl: result.imageUrl,
      done: terminal,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not check status.",
    };
  }
}

export async function saveImageStudioLibraryAction(input: {
  prompt: string;
  modelId?: string;
  aspectRatio?: string;
  imageSize?: string;
  imageDataUrl?: string;
  imageUrl?: string;
}): Promise<{
  error: string | null;
  id?: string;
  fileName?: string;
  previewUrl?: string | null;
}> {
  const auth = await requireAdmin();
  if (auth.error || !auth.user) return { error: auth.error ?? "Unauthorized" };

  const modelId = resolveStudioImageModelId(input.modelId);
  const model = getStudioImageModel(modelId);
  if (!model) return { error: "Unknown model." };

  const resolved = await resolveImageBytes(input);
  if (resolved.error || !resolved.bytes || !resolved.contentType || !resolved.extension) {
    return { error: resolved.error ?? "Invalid image data." };
  }
  const { bytes, contentType, extension } = resolved;

  const fileName = `image-studio-${Date.now()}.${extension}`;
  const storagePath = `${auth.user.id}/studio-library/${randomUUID()}.${extension}`;
  const provider = getEventMediaStorageProvider();

  const upload = await uploadEventMediaObject({
    supabase: auth.supabase,
    path: storagePath,
    bytes,
    contentType,
    provider,
  });
  if (upload.error) return { error: upload.error };

  const { data, error } = await auth.supabase
    .from("studio_images")
    .insert({
      created_by: auth.user.id,
      prompt: input.prompt.trim().slice(0, 4000),
      model_id: modelId,
      provider: model.provider,
      aspect_ratio: input.aspectRatio?.trim() || model.defaultAspectRatio,
      image_size:
        model.provider === "gemini"
          ? input.imageSize === "1K" ||
            input.imageSize === "2K" ||
            input.imageSize === "4K"
            ? input.imageSize
            : "2K"
          : null,
      storage_path: storagePath,
      storage_provider: upload.provider === "bunny" ? "bunny" : "supabase",
      file_name: fileName,
      media_type: "image",
      content_type: contentType,
    })
    .select("id, file_name, storage_path, storage_provider")
    .single();

  if (error) {
    return {
      error:
        error.message.includes("studio_images") ||
        error.message.includes("schema cache")
          ? "Image Studio library needs migration 047_studio_images.sql — run it in the Supabase SQL editor, then retry."
          : error.message,
    };
  }

  const access = await getEventMediaAccessUrl({
    supabase: auth.supabase,
    path: String(data.storage_path),
    provider: data.storage_provider as StorageProvider,
  });

  revalidatePath("/image-studio");
  return {
    error: null,
    id: data.id as string,
    fileName: String(data.file_name ?? fileName),
    previewUrl: access.url,
  };
}

export async function attachImageStudioToPacketAction(input: {
  packetId: string;
  prompt: string;
  modelId?: string;
  imageDataUrl?: string;
  imageUrl?: string;
  libraryImageId?: string;
}): Promise<{ error: string | null; mediaId?: string; fileName?: string }> {
  const auth = await requireAdmin();
  if (auth.error || !auth.user || !auth.profile) {
    return { error: auth.error ?? "Unauthorized" };
  }

  const packetId = input.packetId.trim();
  if (!packetId) return { error: "Pick a Social Studio packet." };

  const { data: packet } = await auth.supabase
    .from("event_packets")
    .select(
      `
      id, venue_id, client_name, event_date, event_type, dj_name, venue_raw,
      venue:venues!event_packets_venue_id_fkey ( name )
    `,
    )
    .eq("id", packetId)
    .maybeSingle();
  if (!packet) return { error: "Packet not found." };

  let bytes: Buffer;
  let contentType: string;
  let extension: string;
  let modelId = resolveStudioImageModelId(input.modelId);

  if (input.libraryImageId?.trim()) {
    const { data: library } = await auth.supabase
      .from("studio_images")
      .select(
        "id, model_id, storage_path, storage_provider, content_type, file_name",
      )
      .eq("id", input.libraryImageId.trim())
      .maybeSingle();
    if (!library) return { error: "Library image not found." };
    modelId = resolveStudioImageModelId(String(library.model_id));
    const access = await getEventMediaAccessUrl({
      supabase: auth.supabase,
      path: String(library.storage_path),
      provider: library.storage_provider as StorageProvider,
    });
    if (!access.url) {
      return { error: access.error ?? "Could not read library image." };
    }
    try {
      const downloaded = await downloadHiggsfieldImage(access.url);
      bytes = downloaded.bytes;
      contentType = downloaded.contentType;
      extension = downloaded.extension;
    } catch (err) {
      return {
        error:
          err instanceof Error ? err.message : "Could not read library image.",
      };
    }
  } else {
    const resolved = await resolveImageBytes(input);
    if (
      resolved.error ||
      !resolved.bytes ||
      !resolved.contentType ||
      !resolved.extension
    ) {
      return { error: resolved.error ?? "Invalid image data." };
    }
    bytes = resolved.bytes;
    contentType = resolved.contentType;
    extension = resolved.extension;
  }

  const venueRel = packet.venue as
    | { name?: string }
    | { name?: string }[]
    | null;
  const locationName = sanitizeNamePart(
    (Array.isArray(venueRel) ? venueRel[0]?.name : venueRel?.name) ||
      packet.venue_raw ||
      "Venue",
  );
  const djName = sanitizeNamePart(
    packet.dj_name ||
      auth.profile.full_name ||
      auth.profile.email ||
      "Staff",
  );
  const eventDate =
    String(packet.event_date ?? "").slice(0, 10) ||
    new Date().toISOString().slice(0, 10);

  const { data: seqRows } = await auth.supabase
    .from("event_media")
    .select("sequence_number")
    .eq("packet_id", packetId)
    .order("sequence_number", { ascending: false })
    .limit(1);
  const max = seqRows?.[0]?.sequence_number;
  const sequence = typeof max === "number" && max > 0 ? max + 1 : 1;

  const fileName = buildMediaFileName({
    locationName,
    djName,
    eventDate,
    sequence,
    extension,
  });
  const finalName = fileName.includes(".")
    ? fileName
    : `${fileName}.${extension}`;
  const storagePath = `${auth.user.id}/${packetId}/${finalName}`;
  const provider = getEventMediaStorageProvider();

  const upload = await uploadEventMediaObject({
    supabase: auth.supabase,
    path: storagePath,
    bytes,
    contentType,
    provider,
  });
  if (upload.error) return { error: upload.error };

  const eventFolder = buildEventFolderName({
    locationName,
    djName,
    eventDate,
  });
  const folderPath = buildFolderPath({
    venueFolderSlug: folderSlugFromName(locationName),
    eventFolderName: eventFolder,
  });

  const originalLabel =
    getStudioImageModel(modelId)?.provider === "gemini"
      ? "gemini-nano-banana-pro"
      : `higgsfield-${String(modelId).replace(/\//g, "-")}`;

  const { data: inserted, error: insertError } = await auth.supabase
    .from("event_media")
    .insert({
      uploader_id: auth.user.id,
      packet_id: packetId,
      venue_id: packet.venue_id,
      event_name: eventFolder,
      event_date: eventDate,
      storage_path: storagePath,
      storage_provider: upload.provider === "bunny" ? "bunny" : "supabase",
      file_name: finalName,
      original_file_name: `${originalLabel}.${extensionFromFileName(finalName)}`,
      media_type: "image",
      sequence_number: sequence,
      dj_name: djName,
      location_name: locationName,
      client_name: String(packet.client_name ?? "").trim(),
      event_type: String(packet.event_type ?? "").trim(),
      folder_path: folderPath,
    })
    .select("id, file_name")
    .single();

  if (insertError) return { error: insertError.message };

  revalidatePath(`/social-studio/${packetId}`);
  revalidatePath("/social-studio");
  revalidatePath(`/event-packets/${packetId}`);
  revalidatePath("/image-studio");

  return {
    error: null,
    mediaId: inserted.id as string,
    fileName: String(inserted.file_name ?? finalName),
  };
}

export async function deleteStudioLibraryImageAction(
  id: string,
): Promise<{ error: string | null }> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const clean = id.trim();
  if (!clean) return { error: "Missing image id." };

  const { error } = await auth.supabase
    .from("studio_images")
    .delete()
    .eq("id", clean);

  if (error) return { error: error.message };
  revalidatePath("/image-studio");
  return { error: null };
}

export async function getStudioLibraryAccessUrlAction(
  id: string,
): Promise<{ url: string | null; error: string | null }> {
  const auth = await requireAdmin();
  if (auth.error) return { url: null, error: auth.error };

  const { data } = await auth.supabase
    .from("studio_images")
    .select("storage_path, storage_provider")
    .eq("id", id.trim())
    .maybeSingle();
  if (!data) return { url: null, error: "Library image not found." };

  return getEventMediaAccessUrl({
    supabase: auth.supabase,
    path: String(data.storage_path),
    provider: data.storage_provider as StorageProvider,
  });
}
