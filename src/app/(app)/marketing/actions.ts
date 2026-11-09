"use server";

import { revalidatePath } from "next/cache";
import { executeDraftPublish } from "@/lib/marketing/publish-draft";
import { queuePacketDrafts } from "@/lib/marketing/queue-packet";
import { notifyAdmins, insertNotifications } from "@/lib/notifications/notify";
import { canPublishViaApi } from "@/lib/social/publishable-platforms";
import { normalizeIgCollaborators } from "@/lib/social/ig-collaborators";
import {
  SOCIAL_PLATFORM_LABELS,
  type SocialPlatform,
} from "@/lib/social/platforms";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types/database";

type DraftStatus =
  | "draft"
  | "ready"
  | "pending_approval"
  | "posted"
  | "skipped"
  | "rejected";

async function requireMarketer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      supabase,
      user: null,
      role: null as UserRole | null,
      error: "You must be signed in." as const,
    };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "trainer") {
    return {
      supabase,
      user: null,
      role: null as UserRole | null,
      error: "Only admins and trainers can manage the marketing queue." as const,
    };
  }
  return {
    supabase,
    user,
    role: profile.role as UserRole,
    fullName: String(profile.full_name ?? profile.email ?? "Someone"),
    error: null,
  };
}

async function requireAdmin() {
  const result = await requireMarketer();
  if (result.error || !result.user) return result;
  if (result.role !== "admin") {
    return {
      ...result,
      user: null,
      error: "Only admins can approve or deny social posts." as const,
    };
  }
  return result;
}

export async function queuePacketForMarketingAction(
  packetId: string,
  options?: { scheduleInHours?: number | null },
): Promise<{ error: string | null; created?: number; updated?: number }> {
  const { supabase, user, error } = await requireMarketer();
  if (error || !user) return { error: error ?? "You must be signed in." };

  const result = await queuePacketDrafts({
    supabase,
    packetId,
    userId: user.id,
    scheduleInHours: options?.scheduleInHours ?? 24,
  });

  revalidatePath("/marketing");
  return {
    error: result.error,
    created: result.created,
    updated: result.updated,
  };
}

export async function updateDraftStatusAction(
  draftId: string,
  status: DraftStatus,
): Promise<{ error: string | null }> {
  const { supabase, role, error } = await requireMarketer();
  if (error) return { error };

  if (status === "posted" && role !== "admin") {
    return {
      error:
        "Non-admins must request approval before a post goes live on company accounts.",
    };
  }
  if (status === "pending_approval") {
    return {
      error: "Use Request approval instead of setting this status directly.",
    };
  }

  const { error: updateError } = await supabase
    .from("social_post_drafts")
    .update({
      status,
      posted_at: status === "posted" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  if (updateError) return { error: updateError.message };
  revalidatePath("/marketing");
  return { error: null };
}

export async function updateDraftCaptionAction(
  draftId: string,
  caption: string,
): Promise<{ error: string | null }> {
  const { supabase, error } = await requireMarketer();
  if (error) return { error };

  const { error: updateError } = await supabase
    .from("social_post_drafts")
    .update({
      caption: caption.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  if (updateError) return { error: updateError.message };
  revalidatePath("/marketing");
  return { error: null };
}

/** Set which Post for Me brand/page this draft publishes to (spc_…). */
export async function setDraftTargetAccountAction(
  draftId: string,
  accountId: string | null,
): Promise<{ error: string | null }> {
  const { supabase, error } = await requireMarketer();
  if (error) return { error };

  const id = draftId?.trim();
  if (!id) return { error: "Missing draft." };

  const value = accountId?.trim() || null;
  const { error: updateError } = await supabase
    .from("social_post_drafts")
    .update({
      target_social_account_id: value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    if (/target_social_account_id|column/i.test(updateError.message)) {
      return {
        error:
          "Run migration 071_social_post_draft_target_account.sql in Supabase, then try again.",
      };
    }
    return { error: updateError.message };
  }
  revalidatePath("/marketing");
  return { error: null };
}

/** Set which Pinterest board this draft pins to (numeric board id). */
export async function setDraftPinterestBoardAction(
  draftId: string,
  boardId: string | null,
): Promise<{ error: string | null }> {
  const { supabase, error } = await requireMarketer();
  if (error) return { error };

  const id = draftId?.trim();
  if (!id) return { error: "Missing draft." };

  const value = boardId?.trim() || null;
  const { error: updateError } = await supabase
    .from("social_post_drafts")
    .update({
      target_pinterest_board_id: value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    if (/target_pinterest_board_id|column/i.test(updateError.message)) {
      return {
        error:
          "Run migration 075_pinterest_boards.sql in Supabase, then try again.",
      };
    }
    return { error: updateError.message };
  }
  revalidatePath("/marketing");
  return { error: null };
}

export async function savePinterestBoardAction(input: {
  id?: string | null;
  label: string;
  boardId: string;
  sortOrder?: number;
}): Promise<{ error: string | null }> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };

  const label = input.label?.trim() ?? "";
  const boardId = input.boardId?.trim() ?? "";
  if (!label) return { error: "Board label is required." };
  if (!boardId) return { error: "Pinterest board id is required." };

  const sortOrder = Number.isFinite(input.sortOrder)
    ? Number(input.sortOrder)
    : 0;
  const row = {
    label,
    board_id: boardId,
    sort_order: sortOrder,
  };

  const existingId = input.id?.trim() || null;
  const { error: writeError } = existingId
    ? await supabase.from("pinterest_boards").update(row).eq("id", existingId)
    : await supabase.from("pinterest_boards").insert(row);

  if (writeError) {
    if (/pinterest_boards|relation|does not exist/i.test(writeError.message)) {
      return {
        error:
          "Run migration 075_pinterest_boards.sql in Supabase, then try again.",
      };
    }
    if (/unique|duplicate/i.test(writeError.message)) {
      return { error: "That Pinterest board id is already registered." };
    }
    return { error: writeError.message };
  }

  revalidatePath("/marketing");
  return { error: null };
}

export async function deletePinterestBoardAction(
  boardRowId: string,
): Promise<{ error: string | null }> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };

  const id = boardRowId?.trim();
  if (!id) return { error: "Missing board." };

  const { error: deleteError } = await supabase
    .from("pinterest_boards")
    .delete()
    .eq("id", id);

  if (deleteError) {
    if (/pinterest_boards|relation|does not exist/i.test(deleteError.message)) {
      return {
        error:
          "Run migration 075_pinterest_boards.sql in Supabase, then try again.",
      };
    }
    return { error: deleteError.message };
  }

  revalidatePath("/marketing");
  return { error: null };
}

export async function updateDraftScheduleAction(
  draftId: string,
  scheduledFor: string | null,
): Promise<{ error: string | null }> {
  const { supabase, error } = await requireMarketer();
  if (error) return { error };

  let value: string | null = null;
  if (scheduledFor?.trim()) {
    const parsed = Date.parse(scheduledFor);
    if (!Number.isFinite(parsed)) {
      return { error: "That schedule date/time looks invalid." };
    }
    value = new Date(parsed).toISOString();
  }

  const { data: existing } = await supabase
    .from("social_post_drafts")
    .select("status")
    .eq("id", draftId)
    .maybeSingle();

  const patch: Record<string, string | null> = {
    scheduled_for: value,
    updated_at: new Date().toISOString(),
  };
  // Don't yank drafts out of pending approval / posted / rejected via schedule edit.
  const locked = new Set([
    "pending_approval",
    "posted",
    "skipped",
    "rejected",
  ]);
  if (value && existing?.status && !locked.has(String(existing.status))) {
    patch.status = "ready";
  }

  const { error: updateError } = await supabase
    .from("social_post_drafts")
    .update(patch)
    .eq("id", draftId);

  if (updateError) return { error: updateError.message };
  revalidatePath("/marketing");
  return { error: null };
}

export async function updateDraftMediaAction(
  draftId: string,
  mediaIds: string[] | string,
): Promise<{ error: string | null }> {
  const { supabase, error } = await requireMarketer();
  if (error) return { error };

  const { normalizeMediaIds, validateDraftMediaSelection } = await import(
    "@/lib/social/draft-media"
  );

  const id = draftId.trim();
  const nextIds = normalizeMediaIds(
    Array.isArray(mediaIds) ? mediaIds : [mediaIds],
  );
  if (!id) return { error: "Missing draft." };

  const { data: draft, error: draftError } = await supabase
    .from("social_post_drafts")
    .select("id, packet_id, platform, status")
    .eq("id", id)
    .maybeSingle();

  if (draftError) return { error: draftError.message };
  if (!draft) return { error: "Draft not found." };

  const locked = new Set(["posted", "skipped", "pending_approval"]);
  if (locked.has(String(draft.status))) {
    return {
      error: "This draft’s media can’t be changed in its current status.",
    };
  }

  if (nextIds.length === 0) {
    const { error: clearError } = await supabase
      .from("social_post_drafts")
      .update({
        media_id: null,
        media_ids: [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (clearError?.message?.includes("media_ids")) {
      const retry = await supabase
        .from("social_post_drafts")
        .update({
          media_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (retry.error) return { error: retry.error.message };
    } else if (clearError) {
      return { error: clearError.message };
    }
    revalidatePath("/marketing");
    return { error: null };
  }

  const { data: mediaRows, error: mediaError } = await supabase
    .from("event_media")
    .select("id, packet_id, media_type, file_name")
    .in("id", nextIds);

  if (mediaError) return { error: mediaError.message };

  const byId = new Map(
    (mediaRows ?? []).map((row) => [
      row.id as string,
      {
        id: row.id as string,
        file_name: String(row.file_name ?? "media"),
        media_type: String(row.media_type ?? ""),
        packet_id: row.packet_id as string,
      },
    ]),
  );

  const ordered = nextIds.map((mediaId) => byId.get(mediaId)).filter(Boolean) as {
    id: string;
    file_name: string;
    media_type: string;
    packet_id: string;
  }[];

  if (ordered.length !== nextIds.length) {
    return { error: "One or more selected files weren’t found." };
  }
  if (ordered.some((row) => row.packet_id !== draft.packet_id)) {
    return { error: "That media isn’t on this event packet." };
  }

  const validation = validateDraftMediaSelection({
    platform: draft.platform as SocialPlatform,
    selected: ordered,
  });
  if (validation.error) return { error: validation.error };

  const primary = validation.mediaIds[0] ?? null;
  const { error: updateError } = await supabase
    .from("social_post_drafts")
    .update({
      media_id: primary,
      media_ids: validation.mediaIds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError?.message?.includes("media_ids")) {
    const retry = await supabase
      .from("social_post_drafts")
      .update({
        media_id: primary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (retry.error) return { error: retry.error.message };
    return {
      error:
        "Multi-select needs a database update. Run migration 046_social_post_draft_media_ids.sql, then try again.",
    };
  }
  if (updateError) return { error: updateError.message };

  revalidatePath("/marketing");
  return { error: null };
}

/**
 * Save Instagram Collabs usernames on a draft (max 3).
 * Applied when the draft is published via Meta.
 */
export async function updateDraftCollaboratorsAction(
  draftId: string,
  collaborators: string[] | string,
): Promise<{ error: string | null; usernames?: string[] }> {
  const { supabase, error } = await requireMarketer();
  if (error) return { error };

  const id = draftId.trim();
  if (!id) return { error: "Missing draft." };

  const normalized = normalizeIgCollaborators(collaborators);
  if (normalized.error) return { error: normalized.error };

  const { data: draft, error: draftError } = await supabase
    .from("social_post_drafts")
    .select("id, platform, status")
    .eq("id", id)
    .maybeSingle();

  if (draftError) return { error: draftError.message };
  if (!draft) return { error: "Draft not found." };
  if (draft.platform !== "instagram") {
    return { error: "Collaborators are only supported on Instagram drafts." };
  }

  const locked = new Set(["posted", "skipped", "rejected"]);
  if (locked.has(String(draft.status))) {
    return {
      error: "Collaborators can’t be changed after this draft is closed.",
    };
  }

  const { error: updateError } = await supabase
    .from("social_post_drafts")
    .update({
      ig_collaborators: normalized.usernames,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    if (updateError.message.includes("ig_collaborators")) {
      return {
        error:
          "Run migration 040_instagram_collaborators.sql in Supabase before saving collaborators.",
      };
    }
    return { error: updateError.message };
  }

  revalidatePath("/marketing");
  return { error: null, usernames: normalized.usernames };
}

async function executePublish(options: {
  supabase: SupabaseClient;
  draftId: string;
  reviewerId: string;
  useApiPublish: boolean;
  allowPendingApproval?: boolean;
}): Promise<{ error: string | null; externalPostId?: string | null }> {
  const result = await executeDraftPublish(options);
  revalidatePath("/marketing");
  return result;
}

/**
 * Non-admins: request admin approval (notifies all admins).
 * Admins: publish immediately when Meta / LinkedIn APIs are configured.
 */
export async function publishDraftAction(
  draftId: string,
): Promise<{
  error: string | null;
  externalPostId?: string | null;
  pendingApproval?: boolean;
}> {
  const { supabase, user, role, fullName, error } = await requireMarketer();
  if (error || !user) return { error: error ?? "You must be signed in." };

  if (role !== "admin") {
    return requestPublishApprovalInternal({
      supabase,
      draftId,
      requesterId: user.id,
      requesterName: fullName ?? "A marketer",
    });
  }

  return executePublish({
    supabase,
    draftId,
    reviewerId: user.id,
    useApiPublish: true,
  });
}

/**
 * Manually mark a draft posted (YouTube Studio upload, or any non-API path).
 * Still requires social consent on the packet.
 */
export async function markPostedAction(
  draftId: string,
): Promise<{ error: string | null; externalPostId?: string | null }> {
  const { supabase, user, role, error } = await requireMarketer();
  if (error || !user) return { error: error ?? "You must be signed in." };
  if (role !== "admin") {
    return {
      error:
        "Only admins can Mark posted. Request approval so an admin can finish the post.",
    };
  }

  return executePublish({
    supabase,
    draftId,
    reviewerId: user.id,
    useApiPublish: false,
  });
}

/** Explicit request-approval path (also used by Mark posted for non-admins). */
export async function requestPublishApprovalAction(
  draftId: string,
): Promise<{ error: string | null; pendingApproval?: boolean }> {
  const { supabase, user, fullName, error } = await requireMarketer();
  if (error || !user) return { error: error ?? "You must be signed in." };

  return requestPublishApprovalInternal({
    supabase,
    draftId,
    requesterId: user.id,
    requesterName: fullName ?? "A marketer",
  });
}

async function requestPublishApprovalInternal(options: {
  supabase: SupabaseClient;
  draftId: string;
  requesterId: string;
  requesterName: string;
}): Promise<{ error: string | null; pendingApproval?: boolean }> {
  const { supabase, draftId, requesterId, requesterName } = options;

  const { data: draft } = await supabase
    .from("social_post_drafts")
    .select(
      `
      id, platform, status, caption,
      packet:event_packets!social_post_drafts_packet_id_fkey (
        client_name, social_consent
      )
    `,
    )
    .eq("id", draftId)
    .maybeSingle();

  if (!draft) return { error: "Draft not found." };
  if (draft.status === "posted") {
    return { error: "This draft is already posted." };
  }
  if (draft.status === "skipped") {
    return { error: "Skipped drafts cannot be submitted." };
  }
  if (draft.status === "pending_approval") {
    return { error: null, pendingApproval: true };
  }

  const packetRel = draft.packet as
    | { client_name?: string; social_consent?: boolean }
    | { client_name?: string; social_consent?: boolean }[]
    | null;
  const packet = Array.isArray(packetRel) ? packetRel[0] : packetRel;
  if (!packet?.social_consent) {
    return {
      error: "Social consent is required before requesting publish approval.",
    };
  }

  const platform = draft.platform as SocialPlatform;
  const platformLabel = SOCIAL_PLATFORM_LABELS[platform] ?? platform;
  const clientName = String(packet.client_name ?? "Event");
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("social_post_drafts")
    .update({
      status: "pending_approval",
      requested_by: requesterId,
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: "",
      publish_error: null,
      notes: `Approval requested by ${requesterName}.`,
      updated_at: now,
    })
    .eq("id", draftId);

  if (updateError) return { error: updateError.message };

  await notifyAdmins(supabase, {
    kind: "marketing_approval",
    title: "Social post needs approval",
    body: `${requesterName} requested to post ${platformLabel} for ${clientName}.`,
    href: "/marketing?filter=pending",
  });

  revalidatePath("/marketing");
  revalidatePath("/", "layout");
  return { error: null, pendingApproval: true };
}

export async function approvePublishAction(
  draftId: string,
): Promise<{ error: string | null; externalPostId?: string | null }> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "You must be signed in." };

  const { data: draft } = await supabase
    .from("social_post_drafts")
    .select("id, status, platform, requested_by")
    .eq("id", draftId)
    .maybeSingle();

  if (!draft) return { error: "Draft not found." };
  if (draft.status !== "pending_approval" && draft.status !== "ready") {
    return {
      error: "Only pending or ready drafts can be approved for publish.",
    };
  }

  const platform = draft.platform as SocialPlatform;
  const useApiPublish = canPublishViaApi(platform);

  const result = await executePublish({
    supabase,
    draftId,
    reviewerId: user.id,
    useApiPublish,
    allowPendingApproval: draft.status === "pending_approval",
  });

  if (result.error) return result;

  const requesterId = draft.requested_by as string | null;
  if (requesterId) {
    await insertNotifications(supabase, [
      {
        userId: requesterId,
        kind: "marketing_approved",
        title: "Social post approved",
        body: `Your ${SOCIAL_PLATFORM_LABELS[platform] ?? platform} post was approved${
          useApiPublish ? " and published" : ""
        }.`,
        href: "/marketing?filter=posted",
      },
    ]);
  }

  revalidatePath("/", "layout");
  return result;
}

export async function denyPublishAction(
  draftId: string,
  reason?: string,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "You must be signed in." };

  const { data: draft } = await supabase
    .from("social_post_drafts")
    .select("id, status, platform, requested_by")
    .eq("id", draftId)
    .maybeSingle();

  if (!draft) return { error: "Draft not found." };
  if (draft.status !== "pending_approval") {
    return { error: "Only pending drafts can be denied." };
  }

  const trimmed = (reason ?? "").trim();
  const now = new Date().toISOString();
  const platform = draft.platform as SocialPlatform;

  const { error: updateError } = await supabase
    .from("social_post_drafts")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: now,
      rejection_reason: trimmed,
      notes: trimmed
        ? `Denied by admin: ${trimmed}`
        : "Denied by admin.",
      updated_at: now,
    })
    .eq("id", draftId);

  if (updateError) return { error: updateError.message };

  const requesterId = draft.requested_by as string | null;
  if (requesterId) {
    await insertNotifications(supabase, [
      {
        userId: requesterId,
        kind: "marketing_denied",
        title: "Social post denied",
        body: trimmed
          ? `Your ${SOCIAL_PLATFORM_LABELS[platform] ?? platform} post was denied: ${trimmed}`
          : `Your ${SOCIAL_PLATFORM_LABELS[platform] ?? platform} post was denied.`,
        href: "/marketing?filter=rejected",
      },
    ]);
  }

  revalidatePath("/marketing");
  revalidatePath("/", "layout");
  return { error: null };
}
