import {
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/lib/social/platforms";
import type { SupabaseClient } from "@supabase/supabase-js";

const LOCKED_DRAFT_STATUSES = new Set(["posted", "skipped"]);

/**
 * Copy Social Studio captions into Marketing Queue drafts.
 * By default only fills drafts whose caption is still empty (won’t clobber edits).
 */
export async function syncStudioCaptionsIntoDrafts(options: {
  supabase: SupabaseClient;
  packetId: string;
  /** When false, overwrites non-locked draft captions from Studio. Default true. */
  onlyEmpty?: boolean;
}): Promise<{ updated: number; error: string | null }> {
  const { supabase, packetId, onlyEmpty = true } = options;

  const { data: captions, error: captionError } = await supabase
    .from("social_captions")
    .select("platform, caption")
    .eq("packet_id", packetId);

  if (captionError) return { updated: 0, error: captionError.message };

  const captionMap = new Map(
    (captions ?? []).map((row) => [
      row.platform as SocialPlatform,
      String(row.caption ?? "").trim(),
    ]),
  );

  const { data: drafts, error: draftError } = await supabase
    .from("social_post_drafts")
    .select("id, platform, caption, status")
    .eq("packet_id", packetId);

  if (draftError) return { updated: 0, error: draftError.message };

  const now = new Date().toISOString();
  let updated = 0;

  for (const draft of drafts ?? []) {
    const platform = draft.platform as SocialPlatform;
    const studioCaption = captionMap.get(platform) ?? "";
    if (!studioCaption) continue;
    if (LOCKED_DRAFT_STATUSES.has(String(draft.status ?? ""))) continue;

    const current = String(draft.caption ?? "").trim();
    if (onlyEmpty && current) continue;
    if (current === studioCaption) continue;

    const { error: updateError } = await supabase
      .from("social_post_drafts")
      .update({ caption: studioCaption, updated_at: now })
      .eq("id", draft.id);

    if (!updateError) updated += 1;
  }

  return { updated, error: null };
}

export async function queuePacketDrafts(options: {
  supabase: SupabaseClient;
  packetId: string;
  userId: string;
  /** Hours from now to set scheduled_for on new ready drafts. Null = unscheduled. */
  scheduleInHours?: number | null;
}): Promise<{ created: number; updated: number; error: string | null }> {
  const { supabase, packetId, userId, scheduleInHours = null } = options;

  const { data: packet } = await supabase
    .from("event_packets")
    .select("id, social_consent, status")
    .eq("id", packetId)
    .maybeSingle();

  if (!packet) return { created: 0, updated: 0, error: "Packet not found." };
  if (packet.status !== "completed") {
    return { created: 0, updated: 0, error: "Only completed packets can be queued." };
  }

  const { data: captions } = await supabase
    .from("social_captions")
    .select("platform, caption")
    .eq("packet_id", packetId);

  const captionMap = new Map(
    (captions ?? []).map((row) => [
      row.platform as SocialPlatform,
      String(row.caption ?? ""),
    ]),
  );

  const { data: media } = await supabase
    .from("event_media")
    .select("id, content_type, file_name")
    .eq("packet_id", packetId)
    .order("sequence_number", { ascending: true });

  const mediaRows = media ?? [];
  const firstVideo = mediaRows.find((m) =>
    String(m.content_type ?? "").startsWith("video/"),
  );
  const firstImage = mediaRows.find((m) =>
    String(m.content_type ?? "").startsWith("image/"),
  );
  const firstAny = mediaRows[0];

  const now = new Date();
  let scheduledFor: string | null = null;
  if (typeof scheduleInHours === "number" && scheduleInHours > 0) {
    scheduledFor = new Date(
      now.getTime() + scheduleInHours * 60 * 60 * 1000,
    ).toISOString();
  }

  let created = 0;
  for (const platform of SOCIAL_PLATFORMS) {
    const { data: existing } = await supabase
      .from("social_post_drafts")
      .select("id")
      .eq("packet_id", packetId)
      .eq("platform", platform)
      .maybeSingle();
    if (existing?.id) continue;

    const pick =
      platform === "youtube"
        ? firstVideo ?? null
        : firstImage ?? firstAny ?? null;
    const mediaId = (pick?.id as string | undefined) ?? null;
    const mediaIds = mediaId ? [mediaId] : [];

    const consent = Boolean(packet.social_consent);
    const insertRow: Record<string, unknown> = {
      packet_id: packetId,
      media_id: mediaId,
      platform,
      caption: captionMap.get(platform) ?? "",
      status: consent ? "ready" : "draft",
      scheduled_for: consent ? scheduledFor : null,
      created_by: userId,
      updated_at: now.toISOString(),
      notes: consent
        ? platform === "youtube"
          ? "YouTube: upload in YouTube Studio, then Mark posted."
          : ""
        : "Missing social consent on packet.",
    };
    // media_ids added in 046 — include when available; ignore if column missing.
    insertRow.media_ids = mediaIds;

    let { error: insertError } = await supabase
      .from("social_post_drafts")
      .insert(insertRow);
    if (insertError?.message?.includes("media_ids")) {
      delete insertRow.media_ids;
      ({ error: insertError } = await supabase
        .from("social_post_drafts")
        .insert(insertRow));
    }
    if (!insertError) created += 1;
  }

  // Pull Studio captions into any drafts that were created earlier while empty.
  const sync = await syncStudioCaptionsIntoDrafts({
    supabase,
    packetId,
    onlyEmpty: true,
  });

  return { created, updated: sync.updated, error: sync.error };
}
