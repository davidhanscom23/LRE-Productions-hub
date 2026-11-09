"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Trash2, Undo2 } from "lucide-react";
import {
  deleteNotificationAction,
  deleteReadNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  markNotificationUnreadAction,
  type HubNotificationRow,
} from "@/app/(app)/notifications/actions";
import { formatRelativeTime } from "@/lib/notifications/format-relative";

type NotificationsPageClientProps = {
  initialNotifications: HubNotificationRow[];
};

export function NotificationsPageClient({
  initialNotifications,
}: NotificationsPageClientProps) {
  const [items, setItems] = useState(initialNotifications);
  const [pending, startTransition] = useTransition();
  const [nowMs] = useState(() => Date.now());
  const unread = items.filter((item) => !item.read_at).length;
  const readCount = items.length - unread;

  function markOne(id: string) {
    startTransition(async () => {
      await markNotificationReadAction(id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, read_at: item.read_at ?? new Date().toISOString() }
            : item,
        ),
      );
    });
  }

  function toggleRead(item: HubNotificationRow) {
    const makeRead = !item.read_at;
    // optimistic
    setItems((prev) =>
      prev.map((n) =>
        n.id === item.id
          ? { ...n, read_at: makeRead ? new Date().toISOString() : null }
          : n,
      ),
    );
    startTransition(async () => {
      const result = makeRead
        ? await markNotificationReadAction(item.id)
        : await markNotificationUnreadAction(item.id);
      if (result.error) {
        // revert on failure
        setItems((prev) =>
          prev.map((n) =>
            n.id === item.id ? { ...n, read_at: item.read_at } : n,
          ),
        );
      }
    });
  }

  function deleteOne(id: string) {
    const snapshot = items;
    setItems((prev) => prev.filter((n) => n.id !== id)); // optimistic
    startTransition(async () => {
      const result = await deleteNotificationAction(id);
      if (result.error) setItems(snapshot); // revert
    });
  }

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((item) => ({ ...item, read_at: item.read_at ?? now })),
      );
    });
  }

  function clearRead() {
    const snapshot = items;
    setItems((prev) => prev.filter((n) => !n.read_at)); // optimistic
    startTransition(async () => {
      const result = await deleteReadNotificationsAction();
      if (result.error) setItems(snapshot);
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
            Inbox
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Packet assignments, overdue reminders, and marketing approvals.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/notification-settings"
            className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Preferences
          </Link>
          {readCount > 0 ? (
            <button
              type="button"
              disabled={pending}
              onClick={clearRead}
              className="text-sm font-medium text-[var(--muted)] hover:text-red-600 hover:underline disabled:opacity-50"
            >
              Clear read
            </button>
          ) : null}
          {unread > 0 ? (
            <button
              type="button"
              disabled={pending}
              onClick={markAll}
              className="text-sm font-medium text-[var(--brand)] hover:underline disabled:opacity-50"
            >
              Mark all read
            </button>
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] px-5 py-10 text-center text-sm text-[var(--muted)]">
          No notifications yet. New packet assignments and reminders will show
          up here and in the top-bar bell.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {items.map((item) => {
            const when = formatRelativeTime(item.created_at, nowMs);
            const read = Boolean(item.read_at);
            const body = (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className={[
                      "text-sm text-[var(--foreground)]",
                      read ? "font-medium" : "font-semibold",
                    ].join(" ")}
                  >
                    {item.title}
                  </p>
                  {when ? (
                    <time
                      dateTime={item.created_at}
                      className="shrink-0 text-xs text-[var(--muted)]"
                    >
                      {when}
                    </time>
                  ) : null}
                </div>
                {item.body ? (
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    {item.body}
                  </p>
                ) : null}
              </>
            );

            return (
              <li
                key={item.id}
                className={read ? "" : "bg-[var(--brand-soft)]/35"}
              >
                <div className="flex items-start">
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={() => markOne(item.id)}
                      className="block min-w-0 flex-1 px-1 py-3.5 hover:bg-[var(--surface-hover)] sm:px-2"
                    >
                      {body}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => markOne(item.id)}
                      className="block min-w-0 flex-1 px-1 py-3.5 text-left hover:bg-[var(--surface-hover)] sm:px-2"
                    >
                      {body}
                    </button>
                  )}
                  <div className="flex shrink-0 items-center gap-0.5 py-3 pr-1 pl-1">
                    <button
                      type="button"
                      onClick={() => toggleRead(item)}
                      disabled={pending}
                      title={read ? "Mark as unread" : "Mark as read"}
                      aria-label={read ? "Mark as unread" : "Mark as read"}
                      className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
                    >
                      {read ? (
                        <Undo2 className="h-4 w-4" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteOne(item.id)}
                      disabled={pending}
                      title="Delete"
                      aria-label="Delete notification"
                      className="rounded-md p-1.5 text-[var(--muted)] hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
