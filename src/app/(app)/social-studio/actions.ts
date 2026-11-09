"use server";

import { revalidatePath } from "next/cache";
import { syncPacketMediaToDrive } from "@/lib/drive/sync-media";
import { isDriveConfigured } from "@/lib/drive/client";
import { syncStudioCaptionsIntoDrafts } from "@/lib/marketing/queue-packet";
import { generateSocialCaptions } from "@/lib/social/generate-captions";
import {
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/lib/social/platforms";
import { createClient } from "@/lib/supabase/server";
import { createEventMediaSignedUrlAction } from "@/app/(app)/submit-event-photos/actions";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, profile: null, error: "You must be signed in." };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, profile, error: null as string | null };
}

async function canAccessPacket(
  supabase: Awaited<ReturnType<typeof createClient>>,
  packetId: string,
  userId: string,
  role: string | undefined,
) {
  const { data } = await supabase
    .from("event_packets")
    .select(
      "id, assignee_id, calendar_uid, client_name, venue_raw, venue_id, event_date, event_type, event_type_other, dj_name, memorable_moment, client_feedback, issues, status, venue:venues!event_packets_venue_id_fkey(name)",
    )
    .eq("id", packetId)
    .maybeSingle();

  if (!data) return { packet: null, error: "Packet not found." };
  const allowed =
    data.assignee_id === userId ||
    role === "admin" ||
    role === "trainer";
  if (!allowed) return { packet: null, error: "You cannot access this packet." };
  return { packet: data, error: null };
}

export async function generateCaptionsForPacketAction(
  packetId: string,
): Promise<{
  error: string | null;
  captions?: Record<SocialPlatform, string>;
}> {
  const { supabase, user, profile, error } = await requireUser();
  if (error || !user || !profile) {
    return { error: error ?? "You must be signed in." };
  }

  const access = await canAccessPacket(
    supabase,
    packetId,
    user.id,
    profile.role,
  );
  if (access.error || !access.packet) return { error: access.error };

  const packet = access.packet;
  const venueRel = packet.venue as
    | { name?: string }
    | { name?: string }[]
    | null;
  const venueName =
    (Array.isArray(venueRel) ? venueRel[0]?.name : venueRel?.name) ||
    packet.venue_raw ||
    "";

  const { getReviewsForPacket, formatReviewsForCaptions } = await import(
    "@/lib/reviews/for-packet"
  );
  const reviews = await getReviewsForPacket(supabase, packet.calendar_uid);
  const websiteReviews = formatReviewsForCaptions(reviews);

  const generated = await generateSocialCaptions({
    clientName: packet.client_name ?? "",
    venue: venueName,
    eventDate: packet.event_date ?? "",
    eventType: packet.event_type ?? "",
    djName: packet.dj_name ?? "",
    memorableMoment: packet.memorable_moment ?? "",
    clientFeedback: packet.client_feedback ?? "",
    websiteReviews,
    issues: packet.issues ?? "",
  });

  if (generated.error || !generated.captions) {
    return { error: generated.error ?? "Generation failed." };
  }

  const now = new Date().toISOString();
  for (const platform of SOCIAL_PLATFORMS) {
    const caption = generated.captions[platform];
    if (!caption) continue;
    const { error: upsertError } = await supabase.from("social_captions").upsert(
      {
        packet_id: packetId,
        platform,
        caption,
        created_by: user.id,
        updated_at: now,
      },
      { onConflict: "packet_id,platform" },
    );
    if (upsertError) return { error: upsertError.message };
  }

  await syncStudioCaptionsIntoDrafts({
    supabase,
    packetId,
    onlyEmpty: true,
  });

  revalidatePath("/social-studio");
  revalidatePath(`/social-studio/${packetId}`);
  revalidatePath("/marketing");
  return { error: null, captions: generated.captions };
}

export async function saveCaptionsForPacketAction(
  packetId: string,
  captions: Partial<Record<SocialPlatform, string>>,
): Promise<{ error: string | null }> {
  const { supabase, user, profile, error } = await requireUser();
  if (error || !user || !profile) {
    return { error: error ?? "You must be signed in." };
  }

  const access = await canAccessPacket(
    supabase,
    packetId,
    user.id,
    profile.role,
  );
  if (access.error || !access.packet) return { error: access.error };

  const now = new Date().toISOString();
  for (const platform of SOCIAL_PLATFORMS) {
    const caption = captions[platform];
    if (typeof caption !== "string") continue;
    const { error: upsertError } = await supabase.from("social_captions").upsert(
      {
        packet_id: packetId,
        platform,
        caption: caption.trim(),
        created_by: user.id,
        updated_at: now,
      },
      { onConflict: "packet_id,platform" },
    );
    if (upsertError) return { error: upsertError.message };
  }

  await syncStudioCaptionsIntoDrafts({
    supabase,
    packetId,
    onlyEmpty: true,
  });

  revalidatePath("/social-studio");
  revalidatePath(`/social-studio/${packetId}`);
  revalidatePath("/marketing");
  return { error: null };
}

export async function syncPacketToDriveAction(
  packetId: string,
  options?: { force?: boolean },
): Promise<{ error: string | null; uploaded?: number; skipped?: number }> {
  const { supabase, user, profile, error } = await requireUser();
  if (error || !user || !profile) {
    return { error: error ?? "You must be signed in." };
  }

  const access = await canAccessPacket(
    supabase,
    packetId,
    user.id,
    profile.role,
  );
  if (access.error || !access.packet) return { error: access.error };

  // Assignees can backup their own packet; force re-upload stays admin-only.
  if (options?.force && profile.role !== "admin") {
    return { error: "Only admins can force re-upload to Drive." };
  }

  if (!(await isDriveConfigured())) {
    return {
      error:
        "Google Drive is not configured yet. Add the three GOOGLE_* env vars and share the Drive folder with the service account.",
    };
  }

  const result = await syncPacketMediaToDrive(packetId, {
    force: Boolean(options?.force),
  });
  revalidatePath("/social-studio");
  revalidatePath(`/social-studio/${packetId}`);
  revalidatePath("/event-packets");
  return {
    error: result.error,
    uploaded: result.uploaded,
    skipped: result.skipped,
  };
}

export async function getDriveConfiguredAction(): Promise<boolean> {
  return await isDriveConfigured();
}

export async function signedMediaUrlAction(path: string) {
  return createEventMediaSignedUrlAction(path);
}

function parseJpegDataUrl(dataUrl: string): {
  bytes: Buffer;
  contentType: string;
} | null {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(
    dataUrl.trim(),
  );
  if (!match) return null;
  const contentType = match[1]!.toLowerCase().replace("image/jpg", "image/jpeg");
  try {
    return { bytes: Buffer.from(match[2]!, "base64"), contentType };
  } catch {
    return null;
  }
}

/**
 * Save a client-side platform crop as a new packet image so Marketing Queue
 * can select it for posting (posts use packet media as-is).
 */
export async function saveCroppedPacketImageAction(input: {
  packetId: string;
  imageDataUrl: string;
  formatId: string;
  formatLabel?: string;
}): Promise<{ error: string | null; mediaId?: string; fileName?: string }> {
  const { supabase, user, profile, error } = await requireUser();
  if (error || !user || !profile) {
    return { error: error ?? "You must be signed in." };
  }

  const packetId = input.packetId.trim();
  if (!packetId) return { error: "Missing packet." };

  const access = await canAccessPacket(
    supabase,
    packetId,
    user.id,
    profile.role,
  );
  if (access.error || !access.packet) return { error: access.error };
  const packet = access.packet;

  const parsed = parseJpegDataUrl(input.imageDataUrl);
  if (!parsed) {
    return { error: "Invalid cropped image data." };
  }
  if (parsed.bytes.byteLength > 12 * 1024 * 1024) {
    return { error: "Cropped image is too large (max 12 MB)." };
  }

  const {
    buildEventFolderName,
    buildFolderPath,
    buildMediaFileName,
    folderSlugFromName,
    sanitizeNamePart,
  } = await import("@/lib/event-packets/naming");
  const { formatEventTypeLabel } = await import(
    "@/lib/event-packets/format-event-type"
  );
  const {
    getEventMediaStorageProvider,
    uploadEventMediaObject,
  } = await import("@/lib/storage/event-media");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

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
      profileRow?.full_name ||
      profileRow?.email ||
      "Staff",
  );
  const eventDate =
    String(packet.event_date ?? "").slice(0, 10) ||
    new Date().toISOString().slice(0, 10);

  const { data: seqRows } = await supabase
    .from("event_media")
    .select("sequence_number")
    .eq("packet_id", packetId)
    .order("sequence_number", { ascending: false })
    .limit(1);
  const max = seqRows?.[0]?.sequence_number;
  const sequence = typeof max === "number" && max > 0 ? max + 1 : 1;

  const extension = parsed.contentType.includes("png") ? "png" : "jpg";
  const fileName = buildMediaFileName({
    locationName,
    djName,
    eventDate,
    sequence,
    extension,
  });
  const formatSlug = sanitizeNamePart(input.formatId || "crop") || "crop";
  const finalName = fileName.includes(".")
    ? fileName.replace(/(\.[^.]+)$/, `-${formatSlug}$1`)
    : `${fileName}-${formatSlug}.${extension}`;
  const storagePath = `${user.id}/${packetId}/${finalName}`;
  const provider = getEventMediaStorageProvider();

  const upload = await uploadEventMediaObject({
    supabase,
    path: storagePath,
    bytes: parsed.bytes,
    contentType: parsed.contentType,
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

  const eventTypeLabel = formatEventTypeLabel({
    event_type: String(packet.event_type ?? ""),
    event_type_other: (packet as { event_type_other?: string }).event_type_other,
  });

  const { data: inserted, error: insertError } = await supabase
    .from("event_media")
    .insert({
      uploader_id: user.id,
      packet_id: packetId,
      venue_id: packet.venue_id,
      event_name: eventFolder,
      event_date: eventDate,
      storage_path: storagePath,
      storage_provider: upload.provider === "bunny" ? "bunny" : "supabase",
      file_name: finalName,
      original_file_name: `crop-${formatSlug}.${extension}`,
      media_type: "image",
      sequence_number: sequence,
      dj_name: djName,
      location_name: locationName,
      client_name: String(packet.client_name ?? "").trim(),
      event_type: eventTypeLabel,
      folder_path: folderPath,
    })
    .select("id, file_name")
    .single();

  if (insertError) return { error: insertError.message };

  revalidatePath(`/social-studio/${packetId}`);
  revalidatePath("/social-studio");
  revalidatePath(`/event-packets/${packetId}`);
  revalidatePath("/marketing");

  return {
    error: null,
    mediaId: inserted.id as string,
    fileName: String(inserted.file_name ?? finalName),
  };
}
