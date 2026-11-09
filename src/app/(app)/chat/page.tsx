import { ChatPageClient } from "@/components/chat/chat-page-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { buildChannelPreviews } from "@/lib/chat/channel-previews";
import { createClient } from "@/lib/supabase/server";
import type {
  ChatAuthor,
  ChatChannel,
  ChatChannelPreview,
  ChatMessage,
  ChatPersonOption,
} from "@/lib/types/chat";

type ChatPageProps = {
  searchParams: Promise<{ channel?: string }>;
};

function mapChannel(row: Record<string, unknown>): ChatChannel {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    description: (row.description as string) ?? "",
    created_at: (row.created_at as string) ?? "",
    created_by: (row.created_by as string | null) ?? null,
    is_private: Boolean(row.is_private),
  };
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const params = await searchParams;
  const isAdmin = profile?.role === "admin";

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        Sign in to use Chat.
      </div>
    );
  }

  let { data: channelRows, error: channelsError } = await supabase
    .from("channels")
    .select("id, name, description, created_at, created_by, is_private")
    .order("name", { ascending: true });

  // Before migration 021: is_private may not exist yet.
  if (channelsError && /is_private/i.test(channelsError.message)) {
    const fallback = await supabase
      .from("channels")
      .select("id, name, description, created_at, created_by")
      .order("name", { ascending: true });
    channelRows = (fallback.data ?? []).map((row) => ({
      ...row,
      is_private: false,
    }));
    channelsError = fallback.error;
  }

  if (channelsError) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
        Couldn’t load chat yet. If you just set this up, make sure the Chat SQL
        has been run in Supabase.
        <p className="mt-2 text-xs opacity-80">{channelsError.message}</p>
      </div>
    );
  }

  const channels = (channelRows ?? []).map((row) =>
    mapChannel(row as Record<string, unknown>),
  );
  const requestedId = params.channel ?? null;
  const activeChannel =
    channels.find((c) => c.id === requestedId) ?? channels[0] ?? null;

  let initialMessages: ChatMessage[] = [];
  const authorsById: Record<string, ChatAuthor> = {};
  const membersByChannelId: Record<string, string[]> = {};
  let people: ChatPersonOption[] = [];
  let channelPreviews: Record<string, ChatChannelPreview> = {};

  if (isAdmin) {
    const { data: peopleRows } = await supabase
      .from("profiles")
      .select("id, full_name, email, is_active")
      .order("full_name", { ascending: true });

    people = (peopleRows ?? []).map((row) => ({
      id: row.id as string,
      full_name: (row.full_name as string) ?? "",
      email: (row.email as string) ?? "",
      is_active: Boolean(row.is_active),
    }));

    const privateIds = channels.filter((c) => c.is_private).map((c) => c.id);
    if (privateIds.length > 0) {
      const { data: memberRows } = await supabase
        .from("channel_members")
        .select("channel_id, user_id")
        .in("channel_id", privateIds);

      for (const row of memberRows ?? []) {
        const channelId = row.channel_id as string;
        const userId = row.user_id as string;
        if (!membersByChannelId[channelId]) membersByChannelId[channelId] = [];
        membersByChannelId[channelId].push(userId);
      }
    }
  }

  if (channels.length > 0) {
    const channelIds = channels.map((channel) => channel.id);
    const { data: recentRows } = await supabase
      .from("messages")
      .select("id, channel_id, user_id, body, created_at")
      .in("channel_id", channelIds)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(channelIds.length * 4, 40), 200));

    const previewRows = (recentRows ?? []) as {
      id: string;
      channel_id: string;
      user_id: string;
      body: string;
      created_at: string;
    }[];
    const previewAuthorIds = [
      ...new Set(previewRows.map((row) => row.user_id)),
    ];
    const previewAuthors: Record<
      string,
      { id: string; full_name: string; email: string }
    > = {};

    if (previewAuthorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", previewAuthorIds);

      for (const p of profiles ?? []) {
        const author = {
          id: p.id as string,
          full_name: (p.full_name as string) ?? "",
          email: (p.email as string) ?? "",
          avatar_url: (p.avatar_url as string | null) ?? null,
        };
        authorsById[author.id] = author;
        previewAuthors[author.id] = author;
      }
    }

    channelPreviews = buildChannelPreviews(previewRows, previewAuthors);
  }

  if (activeChannel) {
    const { data: messageRows } = await supabase
      .from("messages")
      .select("id, channel_id, user_id, body, created_at")
      .eq("channel_id", activeChannel.id)
      .order("created_at", { ascending: true })
      .limit(200);

    const rows = (messageRows ?? []) as Omit<ChatMessage, "author">[];
    const userIds = [...new Set(rows.map((r) => r.user_id))];

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", userIds);

      for (const p of profiles ?? []) {
        authorsById[p.id as string] = {
          id: p.id as string,
          full_name: (p.full_name as string) ?? "",
          email: (p.email as string) ?? "",
          avatar_url: (p.avatar_url as string | null) ?? null,
        };
      }
    }

    authorsById[profile.id] = {
      id: profile.id,
      full_name: profile.full_name ?? "",
      email: profile.email ?? "",
      avatar_url: profile.avatar_url ?? null,
    };

    initialMessages = rows.map((row) => ({
      ...row,
      author: authorsById[row.user_id] ?? null,
    }));
  } else {
    authorsById[profile.id] = {
      id: profile.id,
      full_name: profile.full_name ?? "",
      email: profile.email ?? "",
      avatar_url: profile.avatar_url ?? null,
    };
  }

  return (
    <ChatPageClient
      channels={channels}
      initialChannelId={activeChannel?.id ?? null}
      initialMessages={initialMessages}
      authorsById={authorsById}
      currentUserId={profile.id}
      isAdmin={isAdmin}
      people={people}
      membersByChannelId={membersByChannelId}
      initialChannelPreviews={channelPreviews}
    />
  );
}
