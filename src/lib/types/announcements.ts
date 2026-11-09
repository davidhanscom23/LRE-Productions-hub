export type Announcement = {
  id: string;
  title: string;
  body: string;
  requires_ack: boolean;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  /** Joined for display. */
  author_name?: string;
  ack_count?: number;
  acked?: boolean;
};

export function isAnnouncementActive(a: Announcement, todayKey: string): boolean {
  return !a.expires_at || a.expires_at >= todayKey;
}
