/**
 * Staff-facing changes that shipped without an updated how-to video.
 *
 * When a staff-facing Hub change ships and no HeyGen browser is available to
 * record the video, add an entry here and tell David "video owed: <route>".
 * A daily cron (/api/cron/how-to-pending) notifies admins while this list is
 * non-empty. When David says "make the pending videos", record them, update
 * HOW_TO_VIDEOS, then remove the entries from this list.
 */
export type PendingHowToVideo = {
  /** Hub route the video covers, e.g. "/event-packets". */
  route: string;
  /** What changed, in plain words. */
  reason: string;
  /** YYYY-MM-DD the change shipped. */
  since: string;
};

export const PENDING_HOW_TO_VIDEOS: PendingHowToVideo[] = [];
