"use server";

import { revalidatePath } from "next/cache";
import {
  buildEventFolderName,
  buildFolderPath,
  buildMediaFileName,
  extensionFromFileName,
  folderSlugFromName,
  sanitizeNamePart,
} from "@/lib/event-packets/naming";
import { ensureVenueForName } from "@/lib/event-packets/venues";
import {
  deleteEventMediaObject,
  getEventMediaAccessUrl,
  type StorageProvider,
} from "@/lib/storage/event-media";
import { createClient } from "@/lib/supabase/server";

export async function insertEventMediaAction(input: {
  event_name: string;
  event_date: string;
  storage_path: string;
  file_name: string;
  original_file_name?: string;
  media_type: string;
  dj_name?: string;
  location_name?: string;
  client_name?: string;
  event_type?: string;
  sequence_number?: number;
  storage_provider?: StorageProvider;
}): Promise<{ error: string | null; id?: string; file_name?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const locationName = sanitizeNamePart(
    input.location_name || input.event_name || "Venue",
  );
  const djName = sanitizeNamePart(
    input.dj_name || profile?.full_name || profile?.email || "Staff",
  );
  const eventDate = input.event_date;
  if (!eventDate) return { error: "Event date is required." };
  if (!input.storage_path.startsWith(`${user.id}/`)) {
    return { error: "Invalid storage path." };
  }

  const sequence = Math.max(1, input.sequence_number ?? 1);
  const original = input.original_file_name || input.file_name;
  // Prefer converted/uploaded name (e.g. .jpg) over iPhone original (.heic).
  const fileName = buildMediaFileName({
    locationName,
    djName,
    eventDate,
    sequence,
    extension: extensionFromFileName(input.file_name || original),
  });
  const eventFolder = buildEventFolderName({
    locationName,
    djName,
    eventDate,
  });
  const folderPath = buildFolderPath({
    venueFolderSlug: folderSlugFromName(locationName),
    eventFolderName: eventFolder,
  });

  let venueId: string | null = null;
  if (profile?.role === "admin") {
    const venue = await ensureVenueForName(locationName);
    venueId = venue?.id ?? null;
  } else {
    const { data: venues } = await supabase.from("venues").select("id, name");
    const match = (venues ?? []).find(
      (row) =>
        String(row.name).trim().toLowerCase() === locationName.toLowerCase(),
    );
    venueId = (match?.id as string | undefined) ?? null;
  }

  const { data, error } = await supabase
    .from("event_media")
    .insert({
      uploader_id: user.id,
      event_name: eventFolder,
      event_date: eventDate,
      storage_path: input.storage_path,
      storage_provider:
        input.storage_provider === "bunny" ? "bunny" : "supabase",
      file_name: fileName,
      original_file_name: original,
      media_type: input.media_type,
      sequence_number: sequence,
      dj_name: djName,
      location_name: locationName,
      client_name: (input.client_name ?? "").trim(),
      event_type: (input.event_type ?? "").trim(),
      folder_path: folderPath,
      venue_id: venueId,
    })
    .select("id, file_name")
    .single();

  if (error) return { error: error.message };

  try {
    const { awardAchievement } = await import("@/lib/points/hub-points");
    await awardAchievement(supabase, "manual_event_photos", {
      event_key: `${eventDate}|${eventFolder}`,
      media_id: data.id,
    });
  } catch {
    // non-critical
  }

  revalidatePath("/submit-event-photos");
  revalidatePath("/event-packets");
  return { error: null, id: data.id, file_name: data.file_name };
}

export async function nextGenericMediaSequenceAction(input: {
  location_name: string;
  dj_name: string;
  event_date: string;
}): Promise<{ sequence: number; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { sequence: 1, error: "You must be signed in." };

  const locationName = sanitizeNamePart(input.location_name || "Venue");
  const djName = sanitizeNamePart(input.dj_name || "Staff");
  const eventFolder = buildEventFolderName({
    locationName,
    djName,
    eventDate: input.event_date,
  });

  // Scope to this uploader — event_media RLS no longer lets staff see peers' rows.
  const { data } = await supabase
    .from("event_media")
    .select("sequence_number")
    .eq("event_name", eventFolder)
    .eq("uploader_id", user.id)
    .order("sequence_number", { ascending: false })
    .limit(1);

  const max = data?.[0]?.sequence_number;
  return {
    sequence: typeof max === "number" && max > 0 ? max + 1 : 1,
    error: null,
  };
}

export async function deleteEventMediaAction(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const { data: row, error: fetchError } = await supabase
    .from("event_media")
    .select("id, storage_path, storage_provider, uploader_id, packet_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!row) return { error: "Media not found." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";
  const isTrainer = profile?.role === "trainer";
  let isAssignee = false;
  if (row.packet_id) {
    const { data: packet } = await supabase
      .from("event_packets")
      .select("assignee_id")
      .eq("id", row.packet_id)
      .maybeSingle();
    isAssignee = packet?.assignee_id === user.id;
  }

  if (
    row.uploader_id !== user.id &&
    !isAdmin &&
    !isTrainer &&
    !isAssignee
  ) {
    return {
      error:
        "You can only delete your own uploads, or media on a packet assigned to you.",
    };
  }

  try {
    await deleteEventMediaObject({
      supabase,
      path: row.storage_path as string,
      provider:
        row.storage_provider === "bunny" || row.storage_provider === "supabase"
          ? row.storage_provider
          : "supabase",
    });
  } catch (err) {
    console.error(
      "Storage delete:",
      err instanceof Error ? err.message : err,
    );
  }

  const { error: deleteError } = await supabase
    .from("event_media")
    .delete()
    .eq("id", id);

  if (deleteError) return { error: deleteError.message };

  revalidatePath("/submit-event-photos");
  revalidatePath("/event-packets");
  if (row.packet_id) {
    revalidatePath(`/event-packets/${row.packet_id}`);
    revalidatePath(`/social-studio/${row.packet_id}`);
  }
  revalidatePath("/social-studio");
  return { error: null };
}

export async function createEventMediaSignedUrlAction(
  path: string,
  provider?: StorageProvider | null,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { url: null, error: "You must be signed in." };

  const clean = path.trim().replace(/^\//, "");
  const { canAccessEventMediaPath } = await import(
    "@/lib/storage/event-media-access"
  );
  if (!(await canAccessEventMediaPath(supabase, user.id, clean))) {
    return { url: null, error: "You do not have access to this media." };
  }

  // Prefer provider from the matching row when caller didn't pass one.
  let resolved: StorageProvider | null =
    provider === "bunny" || provider === "supabase" ? provider : null;
  if (!resolved) {
    const { data: row } = await supabase
      .from("event_media")
      .select("storage_provider")
      .eq("storage_path", clean)
      .maybeSingle();
    if (row?.storage_provider === "bunny" || row?.storage_provider === "supabase") {
      resolved = row.storage_provider;
    }
  }

  return getEventMediaAccessUrl({
    supabase,
    path: clean,
    provider: resolved ?? "supabase",
    expiresIn: 3600,
  });
}
