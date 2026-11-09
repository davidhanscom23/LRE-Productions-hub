import type { ChatChannel, ChatChannelPreview } from "@/lib/types/chat";

type MessageRow = {
  id: string;
  channel_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type AuthorRow = {
  id: string;
  full_name: string;
  email: string;
};

/** Fold newest-first message rows into one preview per channel. */
export function buildChannelPreviews(
  rows: MessageRow[],
  authorsById: Record<string, AuthorRow | undefined>,
): Record<string, ChatChannelPreview> {
  const previews: Record<string, ChatChannelPreview> = {};
  for (const row of rows) {
    if (previews[row.channel_id]) continue;
    const author = authorsById[row.user_id];
    const authorName =
      author?.full_name?.trim() || author?.email?.trim() || "Teammate";
    previews[row.channel_id] = {
      messageId: row.id,
      body: row.body,
      createdAt: row.created_at,
      authorName,
      userId: row.user_id,
    };
  }
  return previews;
}

/** Most recently active channels first; never-messaged keep name order at end. */
export function sortChannelsByPreview(
  channels: ChatChannel[],
  previews: Record<string, ChatChannelPreview | undefined>,
): ChatChannel[] {
  return [...channels].sort((a, b) => {
    const aAt = previews[a.id]?.createdAt ?? "";
    const bAt = previews[b.id]?.createdAt ?? "";
    if (aAt && bAt) return bAt.localeCompare(aAt);
    if (aAt && !bAt) return -1;
    if (!aAt && bAt) return 1;
    return a.name.localeCompare(b.name);
  });
}
