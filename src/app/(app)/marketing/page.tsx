import {
  MarketingQueueClient,
  type DraftStatus,
} from "@/components/marketing/marketing-queue-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { syncStudioCaptionsIntoDrafts } from "@/lib/marketing/queue-packet";
import { isImageMediaItem, isVideoMediaItem } from "@/lib/media/file-kind";
import { apiPublishablePlatforms } from "@/lib/social/publishable-platforms";
import {
  defaultPinterestBoardId,
  listPinterestBoards,
} from "@/lib/social/pinterest-boards";
import { listPostForMeAccounts } from "@/lib/social/postforme";
import type { SocialPlatform } from "@/lib/social/platforms";
import { getEventMediaAccessUrl } from "@/lib/storage/event-media";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type MarketingPageProps = {
  searchParams?: Promise<{ filter?: string }>;
};

export default async function MarketingPage({
  searchParams,
}: MarketingPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "trainer") {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const supabase = await createClient();

  const { data: packets, error } = await supabase
    .from("event_packets")
    .select(
      `
      id, client_name, event_date, dj_name, venue_raw, social_consent, status,
      venue:venues!event_packets_venue_id_fkey ( name )
    `,
    )
    .eq("status", "completed")
    .order("event_date", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Marketing Queue needs a database update</p>
        <p className="mt-2">
          Run migration <code>029_marketing_queue.sql</code> in Supabase, then
          refresh. ({error.message})
        </p>
      </div>
    );
  }

  const ids = (packets ?? []).map((row) => row.id as string);
  const captionCounts = new Map<string, number>();
  const mediaCounts = new Map<string, number>();
  const draftCounts = new Map<string, number>();

  if (ids.length) {
    const { data: captions } = await supabase
      .from("social_captions")
      .select("packet_id")
      .in("packet_id", ids);
    for (const row of captions ?? []) {
      const key = row.packet_id as string;
      captionCounts.set(key, (captionCounts.get(key) ?? 0) + 1);
    }

    const { data: media } = await supabase
      .from("event_media")
      .select("packet_id")
      .in("packet_id", ids);
    for (const row of media ?? []) {
      const key = row.packet_id as string;
      mediaCounts.set(key, (mediaCounts.get(key) ?? 0) + 1);
    }

    const { data: draftsCountRows } = await supabase
      .from("social_post_drafts")
      .select("packet_id")
      .in("packet_id", ids);
    for (const row of draftsCountRows ?? []) {
      const key = row.packet_id as string;
      draftCounts.set(key, (draftCounts.get(key) ?? 0) + 1);
    }
  }

  const packetRows = (packets ?? []).map((packet) => {
    const venueRel = packet.venue as
      | { name?: string }
      | { name?: string }[]
      | null;
    const venueName = Array.isArray(venueRel)
      ? venueRel[0]?.name
      : venueRel?.name;
    return {
      id: packet.id as string,
      client_name: String(packet.client_name ?? ""),
      event_date: String(packet.event_date ?? ""),
      venue_label: venueName || String(packet.venue_raw ?? "Venue"),
      dj_name: String(packet.dj_name ?? ""),
      social_consent: Boolean(packet.social_consent),
      caption_count: captionCounts.get(packet.id as string) ?? 0,
      media_count: mediaCounts.get(packet.id as string) ?? 0,
      draft_count: draftCounts.get(packet.id as string) ?? 0,
    };
  });

  type DraftSelectRow = {
    id: string;
    packet_id: string;
    platform: string;
    caption: string | null;
    status: string;
    notes: string | null;
    scheduled_for: string | null;
    media_id?: string | null;
    media_ids?: string[] | null;
    external_post_id?: string | null;
    publish_error?: string | null;
    rejection_reason?: string | null;
    ig_collaborators?: string[] | null;
    target_social_account_id?: string | null;
    target_pinterest_board_id?: string | null;
    packet:
      | {
          client_name?: string;
          event_date?: string;
          venue_raw?: string;
          venue?: { name?: string } | { name?: string }[] | null;
        }
      | {
          client_name?: string;
          event_date?: string;
          venue_raw?: string;
          venue?: { name?: string } | { name?: string }[] | null;
        }[]
      | null;
  };

  const packetJoin = `
      packet:event_packets!social_post_drafts_packet_id_fkey (
        client_name, event_date, venue_raw,
        venue:venues!event_packets_venue_id_fkey ( name )
      )
    `;

  const draftSelectFull = `
      id, packet_id, platform, caption, status, notes, scheduled_for, media_id, media_ids,
      external_post_id, publish_error, rejection_reason, ig_collaborators,
      target_social_account_id, target_pinterest_board_id,
      ${packetJoin}
    `;
  const draftSelectNoBoard = `
      id, packet_id, platform, caption, status, notes, scheduled_for, media_id, media_ids,
      external_post_id, publish_error, rejection_reason, ig_collaborators,
      target_social_account_id,
      ${packetJoin}
    `;
  const draftSelectNoTarget = `
      id, packet_id, platform, caption, status, notes, scheduled_for, media_id, media_ids,
      external_post_id, publish_error, rejection_reason, ig_collaborators,
      ${packetJoin}
    `;
  const draftSelectNoMediaIds = `
      id, packet_id, platform, caption, status, notes, scheduled_for, media_id,
      external_post_id, publish_error, rejection_reason, ig_collaborators,
      ${packetJoin}
    `;
  const draftSelectApproval = `
      id, packet_id, platform, caption, status, notes, scheduled_for, media_id,
      external_post_id, publish_error, rejection_reason,
      ${packetJoin}
    `;
  const draftSelectPublish = `
      id, packet_id, platform, caption, status, notes, scheduled_for, media_id,
      external_post_id, publish_error,
      ${packetJoin}
    `;
  const draftSelectBase = `
      id, packet_id, platform, caption, status, notes, scheduled_for, media_id,
      ${packetJoin}
    `;

  const draftFull = await supabase
    .from("social_post_drafts")
    .select(draftSelectFull)
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(200);

  let draftRows: DraftSelectRow[] = [];
  if (draftFull.error?.message?.includes("target_pinterest_board_id")) {
    const withoutBoard = await supabase
      .from("social_post_drafts")
      .select(draftSelectNoBoard)
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(200);
    if (withoutBoard.error?.message?.includes("target_social_account_id")) {
      Object.assign(draftFull, withoutBoard);
    } else if (withoutBoard.error?.message?.includes("media_ids")) {
      Object.assign(draftFull, withoutBoard);
    } else {
      draftRows = ((withoutBoard.data ?? []) as DraftSelectRow[]).map(
        (row) => ({ ...row, target_pinterest_board_id: null }),
      );
    }
  }
  if (
    draftRows.length === 0 &&
    draftFull.error?.message?.includes("target_social_account_id")
  ) {
    const withoutTarget = await supabase
      .from("social_post_drafts")
      .select(draftSelectNoTarget)
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(200);
    if (withoutTarget.error?.message?.includes("media_ids")) {
      Object.assign(draftFull, withoutTarget);
    } else {
      draftRows = ((withoutTarget.data ?? []) as DraftSelectRow[]).map(
        (row) => ({
          ...row,
          target_social_account_id: null,
          target_pinterest_board_id: null,
        }),
      );
    }
  }

  if (draftRows.length === 0) {
    if (draftFull.error?.message?.includes("media_ids")) {
      const withoutMediaIds = await supabase
        .from("social_post_drafts")
        .select(draftSelectNoMediaIds)
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(200);
      draftRows = (withoutMediaIds.data ?? []) as DraftSelectRow[];
    } else if (draftFull.error?.message?.includes("ig_collaborators")) {
      const draftApproval = await supabase
        .from("social_post_drafts")
        .select(draftSelectApproval)
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(200);
      if (draftApproval.error?.message?.includes("rejection_reason")) {
        const draftPublish = await supabase
          .from("social_post_drafts")
          .select(draftSelectPublish)
          .order("scheduled_for", { ascending: true, nullsFirst: false })
          .order("updated_at", { ascending: false })
          .limit(200);
        if (draftPublish.error?.message?.includes("external_post_id")) {
          const draftBase = await supabase
            .from("social_post_drafts")
            .select(draftSelectBase)
            .order("scheduled_for", { ascending: true, nullsFirst: false })
            .order("updated_at", { ascending: false })
            .limit(200);
          draftRows = (draftBase.data ?? []) as DraftSelectRow[];
        } else {
          draftRows = (draftPublish.data ?? []) as DraftSelectRow[];
        }
      } else {
        draftRows = (draftApproval.data ?? []) as DraftSelectRow[];
      }
    } else if (draftFull.error?.message?.includes("rejection_reason")) {
      const draftPublish = await supabase
        .from("social_post_drafts")
        .select(draftSelectPublish)
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(200);
      if (draftPublish.error?.message?.includes("external_post_id")) {
        const draftBase = await supabase
          .from("social_post_drafts")
          .select(draftSelectBase)
          .order("scheduled_for", { ascending: true, nullsFirst: false })
          .order("updated_at", { ascending: false })
          .limit(200);
        draftRows = (draftBase.data ?? []) as DraftSelectRow[];
      } else {
        draftRows = (draftPublish.data ?? []) as DraftSelectRow[];
      }
    } else {
      draftRows = (draftFull.data ?? []) as DraftSelectRow[];
    }
  }

  const draftPacketIds = Array.from(
    new Set(draftRows.map((row) => row.packet_id).filter(Boolean)),
  );

  // Backfill empty draft captions from Social Studio before rendering.
  if (draftPacketIds.length) {
    await Promise.all(
      draftPacketIds.map((packetId) =>
        syncStudioCaptionsIntoDrafts({
          supabase,
          packetId,
          onlyEmpty: true,
        }),
      ),
    );

    // Reload captions after sync so the UI shows Studio copy immediately.
    const refreshed = await supabase
      .from("social_post_drafts")
      .select("id, caption")
      .in("id", draftRows.map((row) => row.id));
    const captionById = new Map(
      (refreshed.data ?? []).map((row) => [
        row.id as string,
        String(row.caption ?? ""),
      ]),
    );
    for (const row of draftRows) {
      const next = captionById.get(row.id);
      if (typeof next === "string") row.caption = next;
    }
  }

  const drafts = draftRows.map((row) => {
    const packet = row.packet;
    const packetObj = Array.isArray(packet) ? packet[0] : packet;
    const venueRel = packetObj?.venue ?? null;
    const venueName = Array.isArray(venueRel)
      ? venueRel[0]?.name
      : venueRel?.name;

    const mediaIds = Array.isArray(row.media_ids)
      ? row.media_ids.map(String).filter(Boolean)
      : row.media_id
        ? [String(row.media_id)]
        : [];

    return {
      id: row.id,
      packet_id: row.packet_id,
      platform: row.platform as SocialPlatform,
      caption: String(row.caption ?? ""),
      status: row.status as DraftStatus,
      notes: String(row.notes ?? ""),
      scheduled_for: row.scheduled_for ?? null,
      media_id: mediaIds[0] ?? row.media_id ?? null,
      media_ids: mediaIds,
      external_post_id: row.external_post_id ?? null,
      publish_error: row.publish_error ?? null,
      rejection_reason: row.rejection_reason ?? null,
      ig_collaborators: Array.isArray(row.ig_collaborators)
        ? row.ig_collaborators
        : [],
      target_social_account_id: row.target_social_account_id ?? null,
      target_pinterest_board_id: row.target_pinterest_board_id ?? null,
      client_name: String(packetObj?.client_name ?? ""),
      event_date: String(packetObj?.event_date ?? ""),
      venue_label: venueName || String(packetObj?.venue_raw ?? "Venue"),
    };
  });

  const mediaByPacketId: Record<
    string,
    {
      id: string;
      file_name: string;
      media_type: string;
      signed_url: string | null;
    }[]
  > = {};

  if (draftPacketIds.length) {
    const { data: mediaRows } = await supabase
      .from("event_media")
      .select("id, packet_id, file_name, media_type, storage_path, storage_provider")
      .in("packet_id", draftPacketIds)
      .order("sequence_number", { ascending: true });

    await Promise.all(
      (mediaRows ?? []).map(async (row) => {
        const packetId = row.packet_id as string;
        const item = {
          id: row.id as string,
          file_name: String(row.file_name ?? "media"),
          media_type: String(row.media_type ?? "other"),
        };
        if (!isImageMediaItem(item) && !isVideoMediaItem(item)) return;

        const provider =
          row.storage_provider === "bunny" ||
          row.storage_provider === "supabase"
            ? row.storage_provider
            : "supabase";
        const access = await getEventMediaAccessUrl({
          supabase,
          path: String(row.storage_path ?? ""),
          provider,
          expiresIn: 3600,
        });

        const list = mediaByPacketId[packetId] ?? [];
        list.push({
          ...item,
          signed_url: access.url,
        });
        mediaByPacketId[packetId] = list;
      }),
    );
  }

  const socialAccounts = await listPostForMeAccounts();
  const pinterestBoards = await listPinterestBoards(supabase);

  return (
    <MarketingQueueClient
      packets={packetRows}
      drafts={drafts}
      mediaByPacketId={mediaByPacketId}
      apiPlatforms={apiPublishablePlatforms()}
      socialAccounts={socialAccounts}
      pinterestBoards={pinterestBoards}
      pinterestDefaultBoardId={defaultPinterestBoardId(pinterestBoards)}
      isAdmin={profile.role === "admin"}
      initialFilter={params.filter ?? null}
    />
  );
}
