import "server-only";

import { getZoomAccessToken } from "@/lib/zoom/client";

export type ZoomRecordingFile = {
  id?: string;
  file_type?: string; // MP4, CHAT, TRANSCRIPT, M4A, ...
  recording_type?: string;
  play_url?: string;
  download_url?: string;
  recording_start?: string;
  recording_end?: string;
};

export type ZoomRecordingMeeting = {
  uuid: string;
  id?: number;
  topic: string;
  start_time?: string;
  host_email?: string;
  share_url?: string;
  recording_files?: ZoomRecordingFile[];
};

/**
 * List the configured host's cloud recordings between two dates (YYYY-MM-DD).
 * The Zoom Server-to-Server app needs the
 * cloud_recording:read:list_user_recordings:admin scope.
 * Zoom limits a single query to ~1 month; the caller passes a sensible window.
 */
export async function listZoomRecordings(opts: {
  from: string;
  to: string;
}): Promise<ZoomRecordingMeeting[]> {
  const token = await getZoomAccessToken();
  const host = process.env.ZOOM_HOST_EMAIL?.trim() || "me";
  const headers = { Authorization: `Bearer ${token}` };

  const meetings: ZoomRecordingMeeting[] = [];
  let nextPageToken = "";
  let guard = 0;

  do {
    const params = new URLSearchParams({
      from: opts.from,
      to: opts.to,
      page_size: "100",
    });
    if (nextPageToken) params.set("next_page_token", nextPageToken);

    const res = await fetch(
      `https://api.zoom.us/v2/users/${encodeURIComponent(host)}/recordings?${params.toString()}`,
      { headers },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Zoom recordings request failed (${res.status}). ${
          res.status === 400 || res.status === 401
            ? "Add the cloud_recording:read:list_user_recordings:admin scope to your Zoom Server-to-Server app (Marketplace → your app → Scopes), then re-activate the app. Also confirm ZOOM_HOST_EMAIL is set."
            : ""
        } ${text.slice(0, 200)}`,
      );
    }
    const data = (await res.json()) as {
      meetings?: ZoomRecordingMeeting[];
      next_page_token?: string;
    };
    for (const m of data.meetings ?? []) meetings.push(m);
    nextPageToken = data.next_page_token ?? "";
    guard += 1;
  } while (nextPageToken && guard < 20);

  return meetings;
}

/** Download a Zoom recording file (chat/transcript) as text. */
export async function downloadZoomText(downloadUrl: string): Promise<string> {
  const token = await getZoomAccessToken();
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Zoom file download failed (${res.status}).`);
  return res.text();
}

/** Pick the best MP4 for playback and the chat file (if any). */
export function pickRecordingFiles(meeting: ZoomRecordingMeeting): {
  video: ZoomRecordingFile | null;
  chat: ZoomRecordingFile | null;
} {
  const files = meeting.recording_files ?? [];
  const videos = files.filter((f) => (f.file_type ?? "").toUpperCase() === "MP4");
  // Prefer the speaker/gallery view; otherwise the first MP4.
  const video =
    videos.find((f) =>
      ["shared_screen_with_speaker_view", "speaker_view", "gallery_view"].includes(
        (f.recording_type ?? "").toLowerCase(),
      ),
    ) ??
    videos[0] ??
    null;
  const chat =
    files.find((f) => (f.file_type ?? "").toUpperCase() === "CHAT") ?? null;
  return { video, chat };
}
