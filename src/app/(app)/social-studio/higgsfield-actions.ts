"use server";

import { revalidatePath } from "next/cache";
import { generateNanoBananaProImage } from "@/lib/gemini/nano-banana";
import { isGeminiConfigured } from "@/lib/gemini/credentials";
import {
  downloadHiggsfieldImage,
  getHiggsfieldRequestStatus,
  submitHiggsfieldImage,
} from "@/lib/higgsfield/client";
import { isHiggsfieldConfigured } from "@/lib/higgsfield/credentials";
import type { HiggsfieldImageModelId } from "@/lib/higgsfield/models";
import {
  buildEventFolderName,
  buildFolderPath,
  buildMediaFileName,
  extensionFromFileName,
  folderSlugFromName,
  sanitizeNamePart,
} from "@/lib/event-packets/naming";
import {
  DEFAULT_HIGGSFIELD_FALLBACK_MODEL,
  getStudioImageModel,
  resolveStudioImageModelId,
  type StudioImageAspectRatio,
  type StudioImageModelId,
} from "@/lib/social/image-gen-models";
import {
  getEventMediaStorageProvider,
  uploadEventMediaObject,
} from "@/lib/storage/event-media";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

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
    return { error: "Only admins can generate Social Studio images." as const };
  }

  return { supabase, user, profile, error: null as null };
}

type AdminAuth = Exclude<Awaited<ReturnType<typeof requireAdmin>>, { error: string }>;

async function saveGeneratedImageBytes(input: {
  auth: AdminAuth;
  packetId: string;
  bytes: Buffer;
  contentType: string;
  extension: string;
  modelId: StudioImageModelId;
  originalLabel: string;
}): Promise<{ error: string | null; mediaId?: string; fileName?: string }> {
  const { auth, packetId } = input;

  const { data: packet } = await auth.supabase
    .from("event_packets")
    .select(
      `
      id, assignee_id, venue_id, client_name, event_date, event_type, dj_name, venue_raw,
      venue:venues!event_packets_venue_id_fkey ( name )
    `,
    )
    .eq("id", packetId)
    .maybeSingle();

  if (!packet) return { error: "Packet not found." };

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
    extension: input.extension,
  });
  const finalName = fileName.includes(".")
    ? fileName
    : `${fileName}.${input.extension}`;
  const storagePath = `${auth.user.id}/${packetId}/${finalName}`;
  const provider = getEventMediaStorageProvider();

  const upload = await uploadEventMediaObject({
    supabase: auth.supabase as SupabaseClient,
    path: storagePath,
    bytes: input.bytes,
    contentType: input.contentType,
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
      original_file_name: `${input.originalLabel}.${extensionFromFileName(finalName)}`,
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

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath(`/social-studio/${packetId}`);
  revalidatePath("/social-studio");
  revalidatePath(`/event-packets/${packetId}`);
  revalidatePath("/event-packets");
  revalidatePath("/marketing");

  return {
    error: null,
    mediaId: inserted.id as string,
    fileName: String(inserted.file_name ?? finalName),
  };
}

function resolveAspectRatio(
  modelId: StudioImageModelId,
  requested?: string,
): StudioImageAspectRatio {
  const model = getStudioImageModel(modelId);
  if (!model) return "4:5";
  if (
    requested &&
    model.aspectRatios.includes(requested as StudioImageAspectRatio)
  ) {
    return requested as StudioImageAspectRatio;
  }
  return model.defaultAspectRatio;
}

async function startHiggsfieldGeneration(input: {
  auth: AdminAuth;
  packetId: string;
  prompt: string;
  modelId: StudioImageModelId;
  aspectRatio: StudioImageAspectRatio;
  notice?: string;
}): Promise<{
  error: string | null;
  provider?: "higgsfield";
  requestId?: string;
  modelId?: StudioImageModelId;
  notice?: string;
}> {
  if (!isHiggsfieldConfigured()) {
    return {
      error:
        "Higgsfield is not configured. Add HF_API_KEY and HF_API_SECRET in Vercel / .env.local.",
    };
  }

  const model = getStudioImageModel(input.modelId);
  if (!model || model.provider !== "higgsfield") {
    return { error: "Unknown Higgsfield model." };
  }

  try {
    const { requestId } = await submitHiggsfieldImage({
      modelId: input.modelId as HiggsfieldImageModelId,
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
    });
    return {
      error: null,
      provider: "higgsfield",
      requestId,
      modelId: input.modelId,
      notice: input.notice,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not start generation.",
    };
  }
}

/**
 * Start (Higgsfield) or complete (Gemini) a Social Studio image generation.
 * Nano Banana Pro is sync; Higgsfield returns a requestId for polling.
 * If Nano Banana Pro is selected but GEMINI_API_KEY is missing, falls back to Soul.
 */
export async function submitHiggsfieldPacketImageAction(input: {
  packetId: string;
  prompt: string;
  modelId?: string;
  aspectRatio?: string;
}): Promise<{
  error: string | null;
  provider?: "gemini" | "higgsfield";
  requestId?: string;
  modelId?: StudioImageModelId;
  mediaId?: string;
  fileName?: string;
  previewDataUrl?: string;
  notice?: string;
}> {
  const auth = await requireAdmin();
  if (auth.error || !auth.user || !auth.profile) {
    return { error: auth.error ?? "Unauthorized" };
  }

  const packetId = input.packetId.trim();
  if (!packetId) return { error: "Packet is required." };

  const { data: packet } = await auth.supabase
    .from("event_packets")
    .select("id")
    .eq("id", packetId)
    .maybeSingle();
  if (!packet) return { error: "Packet not found." };

  let modelId = resolveStudioImageModelId(input.modelId);
  let model = getStudioImageModel(modelId);
  if (!model) return { error: "Unknown model." };

  let notice: string | undefined;

  if (model.provider === "gemini" && !isGeminiConfigured()) {
    if (!isHiggsfieldConfigured()) {
      return {
        error:
          "Nano Banana Pro not configured (set GEMINI_API_KEY). Higgsfield fallback is also unavailable — add HF_API_KEY + HF_API_SECRET.",
      };
    }
    notice =
      "Nano Banana Pro not configured (set GEMINI_API_KEY). Falling back to Soul Standard.";
    modelId = DEFAULT_HIGGSFIELD_FALLBACK_MODEL;
    model = getStudioImageModel(modelId);
    if (!model) return { error: "Fallback model unavailable." };
  }

  const aspectRatio = resolveAspectRatio(modelId, input.aspectRatio);

  if (model.provider === "gemini") {
    try {
      const generated = await generateNanoBananaProImage({
        prompt: input.prompt,
        aspectRatio,
        imageSize: "2K",
      });
      const saved = await saveGeneratedImageBytes({
        auth,
        packetId,
        bytes: generated.bytes,
        contentType: generated.contentType,
        extension: generated.extension,
        modelId,
        originalLabel: "gemini-nano-banana-pro",
      });
      if (saved.error) return { error: saved.error };

      const previewDataUrl = `data:${generated.contentType};base64,${generated.bytes.toString("base64")}`;
      return {
        error: null,
        provider: "gemini",
        modelId,
        mediaId: saved.mediaId,
        fileName: saved.fileName,
        previewDataUrl,
        notice,
      };
    } catch (err) {
      return {
        error:
          err instanceof Error ? err.message : "Gemini image generation failed.",
      };
    }
  }

  return startHiggsfieldGeneration({
    auth,
    packetId,
    prompt: input.prompt,
    modelId,
    aspectRatio,
    notice,
  });
}

export async function pollHiggsfieldPacketImageAction(
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

export async function saveHiggsfieldPacketImageAction(input: {
  packetId: string;
  imageUrl: string;
  prompt: string;
  modelId?: string;
}): Promise<{ error: string | null; mediaId?: string; fileName?: string }> {
  const auth = await requireAdmin();
  if (auth.error || !auth.user || !auth.profile) {
    return { error: auth.error ?? "Unauthorized" };
  }
  if (!isHiggsfieldConfigured()) {
    return { error: "Higgsfield is not configured." };
  }

  const packetId = input.packetId.trim();
  const imageUrl = input.imageUrl.trim();
  if (!packetId || !imageUrl.startsWith("http")) {
    return { error: "Packet and image URL are required." };
  }

  try {
    const downloaded = await downloadHiggsfieldImage(imageUrl);
    const modelId = resolveStudioImageModelId(input.modelId);
    return saveGeneratedImageBytes({
      auth,
      packetId,
      bytes: downloaded.bytes,
      contentType: downloaded.contentType,
      extension: downloaded.extension,
      modelId,
      originalLabel: `higgsfield-${String(modelId).replace(/\//g, "-")}`,
    });
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Could not save generated image.",
    };
  }
}
