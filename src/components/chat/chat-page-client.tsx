"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Hash,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import {
  createChannelAction,
  deleteChannelAction,
  deleteMessageAction,
  renameChannelAction,
  sendMessageAction,
} from "@/app/(app)/chat/actions";
import { sortChannelsByPreview } from "@/lib/chat/channel-previews";
import {
  formatChatRelativeTime,
  truncateChatPreview,
} from "@/lib/chat/format-preview";
import { createClient } from "@/lib/supabase/client";
import type {
  ChatAuthor,
  ChatChannel,
  ChatChannelPreview,
  ChatMessage,
  ChatPersonOption,
} from "@/lib/types/chat";

type ChatPageClientProps = {
  channels: ChatChannel[];
  initialChannelId: string | null;
  initialMessages: ChatMessage[];
  authorsById: Record<string, ChatAuthor>;
  currentUserId: string;
  isAdmin: boolean;
  people: ChatPersonOption[];
  membersByChannelId: Record<string, string[]>;
  initialChannelPreviews?: Record<string, ChatChannelPreview>;
};

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function displayName(
  author: ChatAuthor | null | undefined,
): string {
  if (!author) return "Teammate";
  return author.full_name?.trim() || author.email || "Teammate";
}

function personLabel(person: ChatPersonOption): string {
  return person.full_name?.trim() || person.email || "Teammate";
}

export function ChatPageClient({
  channels,
  initialChannelId,
  initialMessages,
  authorsById: initialAuthors,
  currentUserId,
  isAdmin,
  people,
  membersByChannelId,
  initialChannelPreviews = {},
}: ChatPageClientProps) {
  const router = useRouter();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(
    initialChannelId,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [authorsById, setAuthorsById] =
    useState<Record<string, ChatAuthor>>(initialAuthors);
  const [channelPreviews, setChannelPreviews] = useState(initialChannelPreviews);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [pendingSend, startSend] = useTransition();
  const [pendingChannel, startChannel] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChatChannel | null>(
    null,
  );
  /** Mobile master-detail: list of channels vs full-width thread. */
  const [mobilePane, setMobilePane] = useState<"list" | "thread">(
    initialChannelId ? "thread" : "list",
  );
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const authorsRef = useRef(authorsById);
  const [authorsBaseline, setAuthorsBaseline] = useState(initialAuthors);
  const [previewsBaseline, setPreviewsBaseline] = useState(
    initialChannelPreviews,
  );
  const [messagesBaseline, setMessagesBaseline] = useState({
    activeChannelId: initialChannelId,
    initialChannelId,
    initialMessages,
  });

  // Keep realtime handler in sync without reading refs during render.
  useEffect(() => {
    authorsRef.current = authorsById;
  }, [authorsById]);

  // Adjust local caches when server props refresh (React-recommended pattern).
  if (initialAuthors !== authorsBaseline) {
    setAuthorsBaseline(initialAuthors);
    setAuthorsById(initialAuthors);
  }
  if (initialChannelPreviews !== previewsBaseline) {
    setPreviewsBaseline(initialChannelPreviews);
    setChannelPreviews(initialChannelPreviews);
  }
  if (
    activeChannelId === initialChannelId &&
    (messagesBaseline.activeChannelId !== activeChannelId ||
      messagesBaseline.initialChannelId !== initialChannelId ||
      messagesBaseline.initialMessages !== initialMessages)
  ) {
    setMessagesBaseline({
      activeChannelId,
      initialChannelId,
      initialMessages,
    });
    setMessages(initialMessages);
  }

  const orderedChannels = useMemo(
    () => sortChannelsByPreview(channels, channelPreviews),
    [channels, channelPreviews],
  );

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? null,
    [channels, activeChannelId],
  );

  function applyPreviewFromMessage(message: ChatMessage) {
    setChannelPreviews((prev) => ({
      ...prev,
      [message.channel_id]: {
        messageId: message.id,
        body: message.body,
        createdAt: message.created_at,
        authorName: displayName(message.author),
        userId: message.user_id,
      },
    }));
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeChannelId]);

  useEffect(() => {
    if (!activeChannelId) return;
    if (activeChannelId === initialChannelId) return;

    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, channel_id, user_id, body, created_at")
        .eq("channel_id", activeChannelId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (cancelled || error) return;

      const rows = (data ?? []) as Omit<ChatMessage, "author">[];
      const missing = rows
        .map((r) => r.user_id)
        .filter((id) => !authorsById[id]);

      let nextAuthors = authorsById;
      if (missing.length > 0) {
        const unique = [...new Set(missing)];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", unique);
        if (profiles) {
          nextAuthors = { ...authorsById };
          for (const p of profiles) {
            nextAuthors[p.id as string] = {
              id: p.id as string,
              full_name: (p.full_name as string) ?? "",
              email: (p.email as string) ?? "",
              avatar_url: (p.avatar_url as string | null) ?? null,
            };
          }
          setAuthorsById(nextAuthors);
        }
      }

      if (cancelled) return;
      const mapped = rows.map((row) => ({
        ...row,
        author: nextAuthors[row.user_id] ?? null,
      }));
      setMessages(mapped);
      const last = mapped[mapped.length - 1];
      if (last) {
        setChannelPreviews((prev) => ({
          ...prev,
          [last.channel_id]: {
            messageId: last.id,
            body: last.body,
            createdAt: last.created_at,
            authorName: displayName(last.author),
            userId: last.user_id,
          },
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId, initialChannelId]);

  useEffect(() => {
    if (!activeChannelId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`chat-messages:${activeChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${activeChannelId}`,
        },
        async (payload) => {
          const row = payload.new as Omit<ChatMessage, "author">;
          const known = authorsRef.current[row.user_id] ?? null;
          const nextMessage = { ...row, author: known };
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, nextMessage];
          });
          applyPreviewFromMessage(nextMessage);

          if (!known) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id, full_name, email, avatar_url")
              .eq("id", row.user_id)
              .maybeSingle();
            if (profile) {
              const author: ChatAuthor = {
                id: profile.id as string,
                full_name: (profile.full_name as string) ?? "",
                email: (profile.email as string) ?? "",
                avatar_url: (profile.avatar_url as string | null) ?? null,
              };
              setAuthorsById((prev) => ({ ...prev, [author.id]: author }));
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === row.id ? { ...m, author } : m,
                ),
              );
              applyPreviewFromMessage({ ...row, author });
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${activeChannelId}`,
        },
        (payload) => {
          const row = payload.old as { id?: string };
          if (!row.id) return;
          setMessages((prev) => prev.filter((m) => m.id !== row.id));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeChannelId]);

  function selectChannel(id: string) {
    setActiveChannelId(id);
    setMobilePane("thread");
    setSendError(null);
    setDraft("");
    router.replace(`/chat?channel=${id}`, { scroll: false });
  }

  function backToChannelList() {
    setMobilePane("list");
    setSendError(null);
  }

  function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!activeChannelId || !draft.trim()) return;
    const body = draft.trim();
    setSendError(null);
    setDraft("");

    startSend(async () => {
      const result = await sendMessageAction({
        channelId: activeChannelId,
        body,
      });
      if (result.error) {
        setSendError(result.error);
        setDraft(body);
        return;
      }
      if (result.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === result.message!.id)) return prev;
          return [...prev, result.message!];
        });
        applyPreviewFromMessage(result.message);
        if (result.message.author) {
          setAuthorsById((prev) => ({
            ...prev,
            [result.message!.author!.id]: result.message!.author!,
          }));
        }
      }
    });
  }

  const showMobileList = mobilePane === "list";
  const showMobileThread = mobilePane === "thread";

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm md:h-[calc(100dvh-9rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))]">
      <div
        className={[
          "shrink-0 border-b border-[var(--border)] px-4 py-3 md:px-5 md:py-4",
          // On phone, hide the page blurb while reading a thread to free space.
          showMobileThread ? "hidden md:block" : "",
        ].join(" ")}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
          Chat
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--foreground)] md:text-2xl">
          Team chat
        </h1>
        <p className="mt-1 hidden text-sm text-[var(--muted)] md:block">
          Channels for quick updates — you only see channels you’re allowed to
          join.
          {isAdmin
            ? " Admins can set who sees each channel when creating or editing it."
            : ""}
        </p>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          className={[
            "flex w-full flex-col bg-[var(--background)]/40 md:max-w-[19rem] md:shrink-0 md:border-r md:border-[var(--border)]",
            showMobileList ? "flex" : "hidden md:flex",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Channels
            </p>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-[var(--brand)] hover:bg-[var(--brand-soft)]"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {channels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] px-3 py-8 text-center">
                <Hash className="mx-auto h-5 w-5 text-[var(--muted)]/60" />
                <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
                  No channels yet
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {isAdmin
                    ? "Create the first channel to get talking."
                    : "Ask an admin to add you to a channel."}
                </p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {orderedChannels.map((channel) => {
                  const active = channel.id === activeChannelId;
                  const memberCount =
                    membersByChannelId[channel.id]?.length ?? 0;
                  const preview = channelPreviews[channel.id];
                  const when = preview
                    ? formatChatRelativeTime(preview.createdAt)
                    : "";
                  return (
                    <li key={channel.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => selectChannel(channel.id)}
                        className={[
                          "flex w-full items-start gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors md:pr-14",
                          isAdmin ? "pr-14" : "",
                          active
                            ? "bg-[var(--brand-soft)] font-medium text-[var(--brand)]"
                            : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
                        ].join(" ")}
                      >
                        {channel.is_private ? (
                          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                        ) : (
                          <Hash className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate">{channel.name}</span>
                            {when ? (
                              <time
                                dateTime={preview?.createdAt}
                                className="shrink-0 text-[10px] font-normal text-[var(--muted)]"
                              >
                                {when}
                              </time>
                            ) : null}
                          </span>
                          {preview ? (
                            <span
                              className={[
                                "mt-0.5 block truncate text-xs font-normal",
                                active
                                  ? "text-[var(--brand)]/80"
                                  : "text-[var(--muted)]",
                              ].join(" ")}
                            >
                              {preview.authorName.split(" ")[0] ?? "Teammate"}:{" "}
                              {truncateChatPreview(preview.body)}
                            </span>
                          ) : (
                            <span className="mt-0.5 block truncate text-xs font-normal text-[var(--muted)]">
                              No messages yet
                            </span>
                          )}
                        </span>
                      </button>
                      {isAdmin ? (
                        <div className="absolute top-2 right-1 flex gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                          <button
                            type="button"
                            title={
                              channel.is_private
                                ? `Edit access (${memberCount} people)`
                                : "Edit channel"
                            }
                            onClick={() => setEditingChannel(channel)}
                            className="rounded p-1.5 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                          >
                            {channel.is_private ? (
                              <Users className="h-3.5 w-3.5" />
                            ) : (
                              <Pencil className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            disabled={pendingChannel}
                            onClick={() => {
                              if (
                                !confirm(
                                  `Delete #${channel.name}? All messages in it will be removed.`,
                                )
                              ) {
                                return;
                              }
                              startChannel(async () => {
                                const result = await deleteChannelAction(
                                  channel.id,
                                );
                                if (result.error) {
                                  alert(result.error);
                                  return;
                                }
                                if (activeChannelId === channel.id) {
                                  setActiveChannelId(null);
                                  setMessages([]);
                                  setMobilePane("list");
                                  router.replace("/chat", { scroll: false });
                                }
                                router.refresh();
                              });
                            }}
                            className="rounded p-1.5 text-[var(--muted)] hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section
          className={[
            "min-w-0 flex-1 flex-col",
            showMobileThread ? "flex" : "hidden md:flex",
          ].join(" ")}
        >
          {!activeChannel ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <p className="mt-3 font-medium text-[var(--foreground)]">
                Pick a channel
              </p>
              <p className="mt-1 max-w-sm text-sm text-[var(--muted)]">
                Choose a channel to read and send messages.
              </p>
              <button
                type="button"
                onClick={backToChannelList}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] md:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to channels
              </button>
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-[var(--border)] px-3 py-3 sm:px-4">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={backToChannelList}
                    className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--foreground)] hover:bg-[var(--surface-hover)] md:hidden"
                    aria-label="Back to channels"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {activeChannel.is_private ? (
                        <Lock className="h-4 w-4 shrink-0 text-[var(--brand)]" />
                      ) : (
                        <Hash className="h-4 w-4 shrink-0 text-[var(--brand)]" />
                      )}
                      <h2 className="truncate font-semibold text-[var(--foreground)]">
                        {activeChannel.name}
                      </h2>
                      {activeChannel.is_private ? (
                        <span className="rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--brand)] uppercase">
                          Restricted
                        </span>
                      ) : (
                        <span className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                          Everyone
                        </span>
                      )}
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => setEditingChannel(activeChannel)}
                          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                        >
                          <Users className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Manage access</span>
                          <span className="sm:hidden">Access</span>
                        </button>
                      ) : null}
                    </div>
                    {activeChannel.description ? (
                      <p className="mt-0.5 line-clamp-2 text-sm text-[var(--muted)]">
                        {activeChannel.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.length === 0 ? (
                  <div className="flex h-full min-h-[12rem] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)]/50 px-4 text-center">
                    <p className="font-medium text-[var(--foreground)]">
                      No messages yet
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Say hello — your note will show up live for everyone in
                      this channel.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const author =
                      message.author ?? authorsById[message.user_id] ?? null;
                    const name = displayName(author);
                    const initial = (author?.full_name?.trim() || author?.email || "T").charAt(0).toUpperCase();
                    const canDelete =
                      isAdmin || message.user_id === currentUserId;

                    return (
                      <article
                        key={message.id}
                        className="group flex gap-3 rounded-xl px-1 py-1 hover:bg-[var(--surface-hover)]/50"
                      >
                        {author?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={author.avatar_url}
                            alt=""
                            className="mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-sm font-semibold text-[var(--brand)]">
                            {initial}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-sm font-semibold text-[var(--foreground)]">
                              {name}
                            </span>
                            <time
                              dateTime={message.created_at}
                              className="text-xs text-[var(--muted)]"
                            >
                              {formatMessageTime(message.created_at)}
                            </time>
                            {canDelete ? (
                              <button
                                type="button"
                                title="Delete message"
                                onClick={() => {
                                  if (!confirm("Delete this message?")) return;
                                  startSend(async () => {
                                    const result = await deleteMessageAction(
                                      message.id,
                                    );
                                    if (result.error) {
                                      alert(result.error);
                                      return;
                                    }
                                    setMessages((prev) =>
                                      prev.filter((m) => m.id !== message.id),
                                    );
                                  });
                                }}
                                className="ml-auto hidden rounded p-1 text-[var(--muted)] hover:bg-red-50 hover:text-red-700 group-hover:inline-flex dark:hover:bg-red-950/40 dark:hover:text-red-300"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--foreground)]">
                            {message.body}
                          </p>
                        </div>
                      </article>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={handleSend}
                className="shrink-0 border-t border-[var(--border)] p-3 sm:p-4"
              >
                {sendError ? (
                  <p className="mb-2 text-sm text-red-700 dark:text-red-300">
                    {sendError}
                  </p>
                ) : null}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={2}
                    placeholder={`Message #${activeChannel.name}`}
                    className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)] sm:text-sm"
                  />
                  <button
                    type="submit"
                    disabled={pendingSend || !draft.trim()}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 sm:px-4"
                  >
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </div>
                <p className="mt-1.5 hidden text-xs text-[var(--muted)] sm:block">
                  Enter to send · Shift+Enter for a new line
                </p>
              </form>
            </>
          )}
        </section>
      </div>

      {showCreate ? (
        <ChannelFormModal
          title="New channel"
          submitLabel="Create"
          pending={pendingChannel}
          people={people}
          onClose={() => setShowCreate(false)}
          onSubmit={(values) => {
            startChannel(async () => {
              const result = await createChannelAction(values);
              if (result.error) {
                alert(result.error);
                return;
              }
              setShowCreate(false);
              if (result.channel) {
                setActiveChannelId(result.channel.id);
                setMobilePane("thread");
                setMessages([]);
                router.replace(`/chat?channel=${result.channel.id}`, {
                  scroll: false,
                });
              }
              router.refresh();
            });
          }}
        />
      ) : null}

      {editingChannel ? (
        <ChannelFormModal
          title="Edit channel"
          submitLabel="Save"
          pending={pendingChannel}
          people={people}
          initialName={editingChannel.name}
          initialDescription={editingChannel.description}
          initialIsPrivate={editingChannel.is_private}
          initialMemberIds={membersByChannelId[editingChannel.id] ?? []}
          onClose={() => setEditingChannel(null)}
          onSubmit={(values) => {
            startChannel(async () => {
              const result = await renameChannelAction({
                id: editingChannel.id,
                ...values,
              });
              if (result.error) {
                alert(result.error);
                return;
              }
              setEditingChannel(null);
              router.refresh();
            });
          }}
        />
      ) : null}
    </div>
  );
}

function ChannelFormModal({
  title,
  submitLabel,
  pending,
  people,
  initialName = "",
  initialDescription = "",
  initialIsPrivate = false,
  initialMemberIds = [],
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  pending: boolean;
  people: ChatPersonOption[];
  initialName?: string;
  initialDescription?: string;
  initialIsPrivate?: boolean;
  initialMemberIds?: string[];
  onClose: () => void;
  onSubmit: (values: {
    name: string;
    description: string;
    isPrivate: boolean;
    memberIds: string[];
  }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
  const [memberIds, setMemberIds] = useState<string[]>(initialMemberIds);
  const [peopleQuery, setPeopleQuery] = useState("");

  const activePeople = useMemo(
    () => people.filter((p) => p.is_active),
    [people],
  );

  const filteredPeople = useMemo(() => {
    const q = peopleQuery.trim().toLowerCase();
    if (!q) return activePeople;
    return activePeople.filter((p) => {
      const haystack = `${p.full_name} ${p.email}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [activePeople, peopleQuery]);

  function toggleMember(id: string) {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[min(40rem,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
      >
        <div className="shrink-0 border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            {title}
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Choose whether everyone can join, or only selected people.
          </p>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              name,
              description,
              isPrivate,
              memberIds: isPrivate ? memberIds : [],
            });
          }}
        >
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="general"
                autoFocus
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Description</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this channel is for"
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
              />
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm text-[var(--muted)]">Who can access</legend>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5 hover:bg-[var(--surface-hover)]">
                <input
                  type="radio"
                  name="access"
                  checked={!isPrivate}
                  onChange={() => setIsPrivate(false)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--foreground)]">
                    Everyone
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    All signed-in staff can see and post.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5 hover:bg-[var(--surface-hover)]">
                <input
                  type="radio"
                  name="access"
                  checked={isPrivate}
                  onChange={() => setIsPrivate(true)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--foreground)]">
                    Selected people
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    Only the people you pick (plus admins) can see and post.
                  </span>
                </span>
              </label>
            </fieldset>

            {isPrivate ? (
              <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)]/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
                    People ({memberIds.length} selected)
                  </p>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setMemberIds(activePeople.map((p) => p.id))
                      }
                      className="text-[var(--brand)] hover:underline"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberIds([])}
                      className="text-[var(--muted)] hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <input
                  value={peopleQuery}
                  onChange={(e) => setPeopleQuery(e.target.value)}
                  placeholder="Search people…"
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                />
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {filteredPeople.length === 0 ? (
                    <li className="px-1 py-3 text-center text-xs text-[var(--muted)]">
                      No matching people.
                    </li>
                  ) : (
                    filteredPeople.map((person) => {
                      const checked = memberIds.includes(person.id);
                      return (
                        <li key={person.id}>
                          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--surface-hover)]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMember(person.id)}
                            />
                            <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">
                              {personLabel(person)}
                            </span>
                            <span className="truncate text-xs text-[var(--muted)]">
                              {person.email}
                            </span>
                          </label>
                        </li>
                      );
                    })
                  )}
                </ul>
                {memberIds.length === 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    No one selected yet — only admins will see this channel until
                    you add people.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg px-3 text-sm text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
