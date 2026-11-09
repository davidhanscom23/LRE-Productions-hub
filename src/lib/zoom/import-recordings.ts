import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  downloadZoomText,
  listZoomRecordings,
  pickRecordingFiles,
  type ZoomRecordingMeeting,
} from "@/lib/zoom/recordings";
import { extractChatUrls, parseZoomChat } from "@/lib/zoom/parse-chat";

export type ZoomImportResult = {
  listed: number;
  imported: number;
  skipped: number;
  chatLines: number;
  assets: number;
  error: string | null;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Import the host's recent Zoom cloud recordings into Video Archives.
 * Creates one video per meeting (deduped by zoom_recording_id = meeting UUID),
 * parses the saved chat into a timestamped replay, and turns links shared in
 * chat into Shared Assets.
 */
export async function importZoomRecordings(
  supabase: SupabaseClient,
  opts: { days?: number; createdBy?: string | null },
): Promise<ZoomImportResult> {
  const result: ZoomImportResult = {
    listed: 0,
    imported: 0,
    skipped: 0,
    chatLines: 0,
    assets: 0,
    error: null,
  };

  const days = Math.min(Math.max(opts.days ?? 30, 1), 30);
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);

  let meetings: ZoomRecordingMeeting[];
  try {
    meetings = await listZoomRecordings({ from: ymd(from), to: ymd(to) });
  } catch (err) {
    result.error = err instanceof Error ? err.message : "Zoom list failed.";
    return result;
  }
  result.listed = meetings.length;
  if (meetings.length === 0) return result;

  // Dedupe against already-imported recordings.
  const uuids = meetings.map((m) => m.uuid).filter(Boolean);
  const { data: existing } = await supabase
    .from("archive_videos")
    .select("zoom_recording_id")
    .in("zoom_recording_id", uuids);
  const already = new Set(
    (existing ?? []).map((r) => r.zoom_recording_id as string),
  );

  for (const meeting of meetings) {
    if (!meeting.uuid || already.has(meeting.uuid)) {
      result.skipped += 1;
      continue;
    }
    const { video, chat } = pickRecordingFiles(meeting);
    const videoUrl =
      meeting.share_url || video?.play_url || video?.download_url || "";
    if (!videoUrl) {
      result.skipped += 1;
      continue;
    }
    const year = meeting.start_time
      ? new Date(meeting.start_time).getFullYear()
      : new Date().getFullYear();

    const { data: inserted, error: insertErr } = await supabase
      .from("archive_videos")
      .insert({
        title: meeting.topic || "Zoom Meeting",
        description: "",
        video_url: videoUrl,
        category: "Zoom Meetings",
        year,
        presenter: meeting.host_email ?? "",
        zoom_recording_id: meeting.uuid,
        created_by: opts.createdBy ?? null,
      })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      result.skipped += 1;
      continue;
    }
    const videoId = inserted.id as string;
    result.imported += 1;

    // Chat replay + shared-link assets.
    if (chat?.download_url) {
      try {
        const text = await downloadZoomText(chat.download_url);
        const lines = parseZoomChat(text);
        if (lines.length) {
          const chatRows = lines.slice(0, 2000).map((l) => ({
            video_id: videoId,
            ts_seconds: l.ts_seconds,
            speaker: l.speaker,
            message: l.message,
          }));
          await supabase.from("archive_video_chat").insert(chatRows);
          result.chatLines += chatRows.length;

          const urls = extractChatUrls(lines).slice(0, 50);
          if (urls.length) {
            await supabase.from("archive_video_assets").insert(
              urls.map((u) => ({
                video_id: videoId,
                title: u,
                url: u,
                created_by: opts.createdBy ?? null,
              })),
            );
            result.assets += urls.length;
          }
        }
      } catch {
        // Chat parse/download failure is non-fatal — the video still imports.
      }
    }
  }

  return result;
}
