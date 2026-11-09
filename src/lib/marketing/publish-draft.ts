import "server-only";

import {
  canPublishWithLinkedIn,
  publishToLinkedIn,
} from "@/lib/social/linkedin-publish";
import {
  canPublishWithMeta,
  publishToMeta,
} from "@/lib/social/meta-publish";
import {
  canPublishWithPinterest,
  publishToPinterest,
} from "@/lib/social/pinterest-publish";
import {
  canPublishWithThreads,
  publishToThreads,
} from "@/lib/social/threads-publish";
import {
  canPublishWithTikTok,
  publishToTikTok,
} from "@/lib/social/tiktok-publish";
import { canPublishWithX, publishToX } from "@/lib/social/x-publish";
import {
  canPublishWithYouTube,
  publishToYouTube,
} from "@/lib/social/youtube-publish";
import { normalizeMediaIds } from "@/lib/social/draft-media";
import {
  PLATFORM_MAX_MEDIA,
  type SocialPlatform,
} from "@/lib/social/platforms";
import { getEventMediaAccessUrl } from "@/lib/storage/event-media";
import type { SupabaseClient } from "@supabase/supabase-js";

async function storePublishError(
  supabase: SupabaseClient,
  draftId: string,
  error: string,
) {
  await supabase
    .from("social_post_drafts")
    .update({
      publish_error: error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId);
}

function isImageMedia(mediaType: string, fileName: string): boolean {
  const type = mediaType.toLowerCase();
  const name = fileName.toLowerCase();
  if (type.includes("video")) return false;
  if (/\.(mp4|mov|webm|m4v)$/i.test(name)) return false;
  return (
    type.includes("image") ||
    /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name)
  );
}

function isVideoMedia(mediaType: string, fileName: string): boolean {
  const type = mediaType.toLowerCase();
  const name = fileName.toLowerCase();
  return (
    type.includes("video") || /\.(mp4|mov|webm|m4v)$/i.test(name)
  );
}

export async function resolveDraftVideo(
  supabase: SupabaseClient,
  packetId: string,
  mediaIds: string[] | null,
): Promise<{
  mediaId: string | null;
  videoUrl: string | null;
  error: string | null;
}> {
  const orderedIds = normalizeMediaIds(mediaIds).slice(0, 1);

  type MediaRow = {
    id: string;
    storage_path: string;
    storage_provider: string | null;
    media_type: string;
    file_name: string;
  };

  let row: MediaRow | null = null;

  if (orderedIds.length) {
    const { data: selectedRows } = await supabase
      .from("event_media")
      .select("id, storage_path, storage_provider, media_type, file_name")
      .in("id", orderedIds);
    const byId = new Map(
      (selectedRows ?? []).map((r) => [r.id as string, r]),
    );
    const pick = orderedIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((r) => ({
        id: r!.id as string,
        storage_path: String(r!.storage_path ?? ""),
        storage_provider: (r!.storage_provider as string | null) ?? null,
        media_type: String(r!.media_type ?? ""),
        file_name: String(r!.file_name ?? ""),
      }))
      .find((r) => isVideoMedia(r.media_type, r.file_name));
    row = pick ?? null;
  }

  if (!row) {
    const { data: fallbackMedia } = await supabase
      .from("event_media")
      .select("id, storage_path, storage_provider, media_type, file_name")
      .eq("packet_id", packetId)
      .order("sequence_number", { ascending: true })
      .limit(20);
    row =
      (fallbackMedia ?? [])
        .map((r) => ({
          id: r.id as string,
          storage_path: String(r.storage_path ?? ""),
          storage_provider: (r.storage_provider as string | null) ?? null,
          media_type: String(r.media_type ?? ""),
          file_name: String(r.file_name ?? ""),
        }))
        .find((r) => isVideoMedia(r.media_type, r.file_name)) ?? null;
  }

  if (!row?.storage_path) {
    return {
      mediaId: null,
      videoUrl: null,
      error: "YouTube drafts need a video on the packet.",
    };
  }

  const access = await getEventMediaAccessUrl({
    supabase,
    path: row.storage_path,
    provider: row.storage_provider === "bunny" ? "bunny" : "supabase",
    expiresIn: 3600,
  });
  if (!access.url) {
    return {
      mediaId: row.id,
      videoUrl: null,
      error: access.error ?? "Could not create a video access URL.",
    };
  }

  return { mediaId: row.id, videoUrl: access.url, error: null };
}

export async function resolveDraftImages(
  supabase: SupabaseClient,
  packetId: string,
  mediaIds: string[] | null,
  platform: SocialPlatform,
): Promise<{
  mediaIds: string[];
  imageUrls: string[];
  error: string | null;
}> {
  const max = PLATFORM_MAX_MEDIA[platform] ?? 1;
  let orderedIds = normalizeMediaIds(mediaIds).slice(0, max);

  const { data: selectedRows } = orderedIds.length
    ? await supabase
        .from("event_media")
        .select("id, storage_path, storage_provider, media_type, file_name")
        .in("id", orderedIds)
    : { data: [] as const };

  const byId = new Map(
    (selectedRows ?? []).map((row) => [row.id as string, row]),
  );

  type MediaRow = {
    id: string;
    storage_path: string;
    storage_provider: string | null;
    media_type: string;
    file_name: string;
  };

  let rows: MediaRow[] = orderedIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((row) => ({
      id: row!.id as string,
      storage_path: String(row!.storage_path ?? ""),
      storage_provider: (row!.storage_provider as string | null) ?? null,
      media_type: String(row!.media_type ?? ""),
      file_name: String(row!.file_name ?? ""),
    }))
    .filter((row) => isImageMedia(row.media_type, row.file_name));

  if (rows.length === 0) {
    const { data: fallbackMedia } = await supabase
      .from("event_media")
      .select("id, storage_path, storage_provider, media_type, file_name")
      .eq("packet_id", packetId)
      .order("sequence_number", { ascending: true })
      .limit(max);

    rows = (fallbackMedia ?? [])
      .map((row) => ({
        id: row.id as string,
        storage_path: String(row.storage_path ?? ""),
        storage_provider: (row.storage_provider as string | null) ?? null,
        media_type: String(row.media_type ?? ""),
        file_name: String(row.file_name ?? ""),
      }))
      .filter((row) => isImageMedia(row.media_type, row.file_name))
      .slice(0, max);
    orderedIds = rows.map((row) => row.id);
  }

  const imageUrls: string[] = [];
  const resolvedIds: string[] = [];
  for (const row of rows) {
    if (!row.storage_path) continue;
    const access = await getEventMediaAccessUrl({
      supabase,
      path: row.storage_path,
      provider: row.storage_provider === "bunny" ? "bunny" : "supabase",
      expiresIn: 3600,
    });
    if (!access.url) {
      return {
        mediaIds: orderedIds,
        imageUrls: [],
        error: access.error ?? "Could not create a media access URL.",
      };
    }
    imageUrls.push(access.url);
    resolvedIds.push(row.id);
  }

  return { mediaIds: resolvedIds, imageUrls, error: null };
}

/** @deprecated Use resolveDraftImages */
export async function resolveDraftImage(
  supabase: SupabaseClient,
  packetId: string,
  mediaId: string | null,
): Promise<{
  mediaId: string | null;
  imageUrl: string | null;
  error: string | null;
}> {
  const resolved = await resolveDraftImages(
    supabase,
    packetId,
    mediaId ? [mediaId] : [],
    "facebook",
  );
  return {
    mediaId: resolved.mediaIds[0] ?? null,
    imageUrl: resolved.imageUrls[0] ?? null,
    error: resolved.error,
  };
}

export type PublishDraftResult = {
  error: string | null;
  externalPostId?: string | null;
};

/**
 * Publish a marketing draft (Meta / LinkedIn when requested) and mark posted.
 * Used by Marketing Queue actions and the due-posts cron.
 */
export async function executeDraftPublish(options: {
  supabase: SupabaseClient;
  draftId: string;
  reviewerId?: string | null;
  /** Attempt API publish for supported platforms (Meta / LinkedIn). */
  useApiPublish: boolean;
  /** @deprecated Use useApiPublish */
  useMetaApi?: boolean;
  notesPrefix?: string;
  /** Allow publishing a draft that is currently pending_approval (admin Approve). */
  allowPendingApproval?: boolean;
}): Promise<PublishDraftResult> {
  const {
    supabase,
    draftId,
    reviewerId = null,
    notesPrefix = "",
    allowPendingApproval = false,
  } = options;
  const useApiPublish = options.useApiPublish ?? options.useMetaApi ?? false;

  const draftFull = await supabase
    .from("social_post_drafts")
    .select(
      `
      id, packet_id, platform, caption, status, media_id, media_ids, ig_collaborators,
      target_social_account_id, target_pinterest_board_id,
      packet:event_packets!social_post_drafts_packet_id_fkey (
        social_consent, client_name
      )
    `,
    )
    .eq("id", draftId)
    .maybeSingle();

  type DraftPublishRow = {
    id: string;
    packet_id: string;
    platform: string;
    caption: string | null;
    status: string;
    media_id: string | null;
    media_ids?: string[] | null;
    ig_collaborators?: string[] | null;
    target_social_account_id?: string | null;
    target_pinterest_board_id?: string | null;
    packet:
      | { social_consent?: boolean; client_name?: string }
      | { social_consent?: boolean; client_name?: string }[]
      | null;
  };

  let draftData: DraftPublishRow | null = null;
  if (draftFull.error?.message?.includes("target_pinterest_board_id")) {
    const withoutBoard = await supabase
      .from("social_post_drafts")
      .select(
        `
      id, packet_id, platform, caption, status, media_id, media_ids, ig_collaborators,
      target_social_account_id,
      packet:event_packets!social_post_drafts_packet_id_fkey (
        social_consent, client_name
      )
    `,
      )
      .eq("id", draftId)
      .maybeSingle();
    if (!withoutBoard.error && withoutBoard.data) {
      draftData = {
        ...(withoutBoard.data as DraftPublishRow),
        target_pinterest_board_id: null,
      };
    } else {
      Object.assign(draftFull, {
        error: withoutBoard.error ?? draftFull.error,
        data: withoutBoard.data,
      });
    }
  }
  if (
    !draftData &&
    draftFull.error?.message?.includes("target_social_account_id")
  ) {
    const withoutTarget = await supabase
      .from("social_post_drafts")
      .select(
        `
      id, packet_id, platform, caption, status, media_id, media_ids, ig_collaborators,
      packet:event_packets!social_post_drafts_packet_id_fkey (
        social_consent, client_name
      )
    `,
      )
      .eq("id", draftId)
      .maybeSingle();
    if (!withoutTarget.error && withoutTarget.data) {
      draftData = {
        ...(withoutTarget.data as DraftPublishRow),
        target_social_account_id: null,
        target_pinterest_board_id: null,
      };
    } else {
      // Preserve error for the media_ids / ig_collaborators fallbacks below.
      Object.assign(draftFull, {
        error: withoutTarget.error ?? draftFull.error,
        data: withoutTarget.data,
      });
    }
  }

  if (!draftData) {
    if (draftFull.error?.message?.includes("media_ids")) {
      const fallback = await supabase
        .from("social_post_drafts")
        .select(
          `
      id, packet_id, platform, caption, status, media_id, ig_collaborators,
      packet:event_packets!social_post_drafts_packet_id_fkey (
        social_consent, client_name
      )
    `,
        )
        .eq("id", draftId)
        .maybeSingle();
      if (fallback.error?.message?.includes("ig_collaborators")) {
        const base = await supabase
          .from("social_post_drafts")
          .select(
            `
      id, packet_id, platform, caption, status, media_id,
      packet:event_packets!social_post_drafts_packet_id_fkey (
        social_consent, client_name
      )
    `,
          )
          .eq("id", draftId)
          .maybeSingle();
        if (!base.data) return { error: "Draft not found." };
        draftData = {
          ...(base.data as DraftPublishRow),
          media_ids: null,
          ig_collaborators: [],
          target_social_account_id: null,
        };
      } else if (!fallback.data) {
        return { error: fallback.error?.message ?? "Draft not found." };
      } else {
        draftData = {
          ...(fallback.data as DraftPublishRow),
          media_ids: null,
          target_social_account_id: null,
        };
      }
    } else if (draftFull.error?.message?.includes("ig_collaborators")) {
      const fallback = await supabase
        .from("social_post_drafts")
        .select(
          `
      id, packet_id, platform, caption, status, media_id, media_ids,
      packet:event_packets!social_post_drafts_packet_id_fkey (
        social_consent, client_name
      )
    `,
        )
        .eq("id", draftId)
        .maybeSingle();
      if (!fallback.data) return { error: "Draft not found." };
      draftData = {
        ...(fallback.data as DraftPublishRow),
        ig_collaborators: [],
        target_social_account_id: null,
      };
    } else if (draftFull.error || !draftFull.data) {
      return { error: draftFull.error?.message ?? "Draft not found." };
    } else {
      draftData = draftFull.data as DraftPublishRow;
    }
  }

  if (draftData.status === "posted") {
    return { error: "This draft is already marked posted." };
  }
  if (draftData.status === "skipped") {
    return { error: "Skipped drafts cannot be published." };
  }
  if (draftData.status === "pending_approval" && !allowPendingApproval) {
    return { error: "Draft is awaiting admin approval." };
  }
  if (draftData.status === "rejected") {
    return { error: "Rejected drafts cannot be published." };
  }

  const packetRel = draftData.packet;
  const packet = Array.isArray(packetRel) ? packetRel[0] : packetRel;
  if (!packet?.social_consent) {
    return {
      error: "Social consent is required before publishing this packet.",
    };
  }

  const platform = draftData.platform as SocialPlatform;
  const selectedIds = normalizeMediaIds(
    draftData.media_ids?.length
      ? draftData.media_ids
      : draftData.media_id
        ? [draftData.media_id]
        : [],
  );
  const images = await resolveDraftImages(
    supabase,
    draftData.packet_id,
    selectedIds,
    platform,
  );
  if (images.error) return { error: images.error };

  let externalPostId: string | null = null;
  let notes = `${notesPrefix}Marked posted.`.trim();
  const igCollaborators = Array.isArray(draftData.ig_collaborators)
    ? draftData.ig_collaborators
    : [];

  if (
    useApiPublish &&
    (platform === "facebook" || platform === "instagram") &&
    canPublishWithMeta(platform)
  ) {
    if (platform === "instagram" && images.imageUrls.length === 0) {
      return {
        error: "Add an image to this packet before publishing to Instagram.",
      };
    }

    const result = await publishToMeta({
      platform,
      caption: String(draftData.caption ?? ""),
      imageUrls: images.imageUrls,
      imageUrl: images.imageUrls[0] ?? null,
      collaborators: platform === "instagram" ? igCollaborators : undefined,
    });

    if (result.error) {
      await storePublishError(supabase, draftId, result.error);
      return { error: result.error };
    }

    externalPostId = result.externalPostId;
    const collabNote =
      platform === "instagram" && igCollaborators.length > 0
        ? ` Collaborator invite(s) sent to @${igCollaborators.join(", @")} — they must accept in Instagram.`
        : "";
    const countNote =
      images.imageUrls.length > 1
        ? ` (${images.imageUrls.length} photos)`
        : "";
    notes = externalPostId
      ? `${notesPrefix}Published via Meta (${externalPostId})${countNote}.${collabNote}`.trim()
      : `${notesPrefix}Published via Meta${countNote}.${collabNote}`.trim();
  } else if (
    useApiPublish &&
    (platform === "facebook" || platform === "instagram")
  ) {
    return {
      error:
        platform === "instagram"
          ? "Instagram needs META_PAGE_ID, META_PAGE_ACCESS_TOKEN, and META_IG_USER_ID."
          : "Facebook needs META_PAGE_ID and META_PAGE_ACCESS_TOKEN.",
    };
  } else if (
    useApiPublish &&
    platform === "linkedin" &&
    canPublishWithLinkedIn(platform)
  ) {
    const result = await publishToLinkedIn({
      caption: String(draftData.caption ?? ""),
      imageUrls: images.imageUrls,
      imageUrl: images.imageUrls[0] ?? null,
      accountId: draftData.target_social_account_id ?? undefined,
    });

    if (result.error) {
      await storePublishError(supabase, draftId, result.error);
      return { error: result.error };
    }

    externalPostId = result.externalPostId;
    notes = externalPostId
      ? `${notesPrefix}Published via LinkedIn (${externalPostId}).`.trim()
      : `${notesPrefix}Published via LinkedIn.`.trim();
  } else if (useApiPublish && platform === "linkedin") {
    return {
      error:
        "LinkedIn needs POSTFORME_API_KEY (and a brand/page on the draft or POSTFORME_LINKEDIN_ACCOUNT_ID).",
    };
  } else if (
    useApiPublish &&
    platform === "tiktok" &&
    canPublishWithTikTok(platform)
  ) {
    const tiktokVideo = await resolveDraftVideo(
      supabase,
      draftData.packet_id,
      selectedIds,
    );
    const result = await publishToTikTok({
      caption: String(draftData.caption ?? ""),
      videoUrl: tiktokVideo.videoUrl,
      imageUrls: images.imageUrls,
      imageUrl: images.imageUrls[0] ?? null,
      accountId: draftData.target_social_account_id ?? undefined,
    });

    if (result.error) {
      await storePublishError(supabase, draftId, result.error);
      return { error: result.error };
    }

    externalPostId = result.externalPostId;
    notes = externalPostId
      ? `${notesPrefix}Published via TikTok (${externalPostId}).`.trim()
      : `${notesPrefix}Published via TikTok.`.trim();
    if (tiktokVideo.videoUrl && tiktokVideo.mediaId) {
      // Posted the video — make it the draft's primary media.
      selectedIds.splice(0, selectedIds.length, tiktokVideo.mediaId);
    }
  } else if (useApiPublish && platform === "tiktok") {
    return {
      error:
        "TikTok needs POSTFORME_API_KEY and POSTFORME_TIKTOK_ACCOUNT_ID.",
    };
  } else if (
    useApiPublish &&
    platform === "threads" &&
    canPublishWithThreads(platform)
  ) {
    const threadsVideo = await resolveDraftVideo(
      supabase,
      draftData.packet_id,
      selectedIds,
    );
    const result = await publishToThreads({
      caption: String(draftData.caption ?? ""),
      imageUrls: images.imageUrls,
      videoUrl: threadsVideo.videoUrl,
      accountId: draftData.target_social_account_id ?? undefined,
    });

    if (result.error) {
      await storePublishError(supabase, draftId, result.error);
      return { error: result.error };
    }

    externalPostId = result.externalPostId;
    notes = externalPostId
      ? `${notesPrefix}Published via Threads (${externalPostId}).`.trim()
      : `${notesPrefix}Published via Threads.`.trim();
    if (threadsVideo.videoUrl && threadsVideo.mediaId) {
      selectedIds.splice(0, selectedIds.length, threadsVideo.mediaId);
    }
  } else if (useApiPublish && platform === "threads") {
    return {
      error:
        "Threads needs POSTFORME_API_KEY (and a brand on the draft or POSTFORME_THREADS_ACCOUNT_ID).",
    };
  } else if (
    useApiPublish &&
    platform === "pinterest" &&
    canPublishWithPinterest(platform)
  ) {
    if (images.imageUrls.length === 0) {
      const err = "Pinterest requires at least one image on the draft.";
      await storePublishError(supabase, draftId, err);
      return { error: err };
    }
    const boardId =
      draftData.target_pinterest_board_id?.trim() ||
      process.env.POSTFORME_PINTEREST_DEFAULT_BOARD_ID?.trim() ||
      "";
    const result = await publishToPinterest({
      caption: String(draftData.caption ?? ""),
      imageUrls: images.imageUrls,
      accountId: draftData.target_social_account_id ?? undefined,
      boardIds: boardId ? [boardId] : undefined,
    });

    if (result.error) {
      await storePublishError(supabase, draftId, result.error);
      return { error: result.error };
    }

    externalPostId = result.externalPostId;
    notes = externalPostId
      ? `${notesPrefix}Published via Pinterest (${externalPostId}).`.trim()
      : `${notesPrefix}Published via Pinterest.`.trim();
  } else if (useApiPublish && platform === "pinterest") {
    return {
      error:
        "Pinterest needs POSTFORME_API_KEY (and a brand on the draft or POSTFORME_PINTEREST_ACCOUNT_ID).",
    };
  } else if (
    useApiPublish &&
    platform === "twitter" &&
    canPublishWithX(platform)
  ) {
    const result = await publishToX({
      caption: String(draftData.caption ?? ""),
      imageUrls: images.imageUrls,
      imageUrl: images.imageUrls[0] ?? null,
    });

    if (result.error) {
      await storePublishError(supabase, draftId, result.error);
      return { error: result.error };
    }

    externalPostId = result.externalPostId;
    notes = externalPostId
      ? `${notesPrefix}Published via X (${externalPostId}).`.trim()
      : `${notesPrefix}Published via X.`.trim();
  } else if (useApiPublish && platform === "twitter") {
    return {
      error:
        "X needs X_OAUTH2_ACCESS_TOKEN or X_API_KEY + X_API_SECRET + X_ACCESS_TOKEN + X_ACCESS_TOKEN_SECRET.",
    };
  } else if (
    useApiPublish &&
    platform === "youtube" &&
    canPublishWithYouTube(platform)
  ) {
    const video = await resolveDraftVideo(
      supabase,
      draftData.packet_id,
      selectedIds,
    );
    if (video.error || !video.videoUrl) {
      await storePublishError(
        supabase,
        draftId,
        video.error ?? "YouTube drafts need a video on the packet.",
      );
      return {
        error: video.error ?? "YouTube drafts need a video on the packet.",
      };
    }

    const result = await publishToYouTube({
      caption: String(draftData.caption ?? ""),
      videoUrl: video.videoUrl,
    });

    if (result.error) {
      await storePublishError(supabase, draftId, result.error);
      return { error: result.error };
    }

    externalPostId = result.externalPostId;
    notes = externalPostId
      ? `${notesPrefix}Published via YouTube (${externalPostId}).`.trim()
      : `${notesPrefix}Published via YouTube.`.trim();
    if (video.mediaId) {
      // Prefer the uploaded video as the draft's primary media.
      selectedIds.splice(0, selectedIds.length, video.mediaId);
    }
  } else if (useApiPublish && platform === "youtube") {
    return {
      error:
        "YouTube needs refresh-token OAuth (CLIENT_ID/SECRET/REFRESH_TOKEN + CHANNEL_ID) or YOUTUBE_ACCESS_TOKEN + CHANNEL_ID. Or upload in Studio and Mark posted.",
    };
  }

  const now = new Date().toISOString();
  const primaryId = images.mediaIds[0] ?? selectedIds[0] ?? null;
  const patch: Record<string, unknown> = {
    status: "posted",
    posted_at: now,
    media_id: primaryId,
    media_ids: images.mediaIds.length ? images.mediaIds : selectedIds,
    external_post_id: externalPostId,
    publish_error: null,
    notes,
    rejection_reason: "",
    updated_at: now,
  };
  if (reviewerId) {
    patch.reviewed_by = reviewerId;
    patch.reviewed_at = now;
  }

  let { error: updateError } = await supabase
    .from("social_post_drafts")
    .update(patch)
    .eq("id", draftId);

  if (updateError?.message?.includes("media_ids")) {
    delete patch.media_ids;
    ({ error: updateError } = await supabase
      .from("social_post_drafts")
      .update(patch)
      .eq("id", draftId));
  }

  if (updateError) return { error: updateError.message };
  return { error: null, externalPostId };
}
