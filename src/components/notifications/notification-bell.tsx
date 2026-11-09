"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, Check, Settings, Trash2, Undo2 } from "lucide-react";
import {
  deleteNotificationAction,
  listMyNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  markNotificationUnreadAction,
  type HubNotificationRow,
} from "@/app/(app)/notifications/actions";
import { formatRelativeTime } from "@/lib/notifications/format-relative";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HubNotificationRow[]>([]);
  const [pending, startTransition] = useTransition();
  const [nowMs, setNowMs] = useState(() => Date.now());

  function refresh() {
    startTransition(async () => {
      const result = await listMyNotificationsAction(20);
      if (!result.error) {
        setNowMs(Date.now());
        setItems(result.notifications);
      }
    });
  }

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const unread = items.filter((item) => !item.read_at).length;

  // Mirror the unread count onto the app icon badge (and clear it at zero).
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (typeof nav.setAppBadge !== "function") return;
    void (unread > 0
      ? nav.setAppBadge(unread)
      : (nav.clearAppBadge?.() ?? Promise.resolve())
    ).catch(() => {});
  }, [unread]);

  function toggle() {
    setOpen((value) => !value);
    if (!open) {
      setNowMs(Date.now());
      refresh();
    }
  }

  function markOne(id: string) {
    startTransition(async () => {
      await markNotificationReadAction(id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, read_at: new Date().toISOString() }
            : item,
        ),
      );
    });
  }

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((item) => ({ ...item, read_at: item.read_at ?? now })));
    });
  }

  function toggleRead(item: HubNotificationRow) {
    const makeRead = !item.read_at;
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
    setItems((prev) => prev.filter((n) => n.id !== id));
    startTransition(async () => {
      const result = await deleteNotificationAction(id);
      if (result.error) setItems(snapshot);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Notifications
              </p>
              <div className="flex items-center gap-3">
                {unread > 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={markAll}
                    className="text-xs font-medium text-[var(--brand)] hover:underline disabled:opacity-50"
                  >
                    Mark all read
                  </button>
                ) : null}
                <Link
                  href="/notification-settings"
                  onClick={() => setOpen(false)}
                  title="Notification preferences"
                  aria-label="Notification preferences"
                  className="text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  <Settings className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-[var(--muted)]">
                  No notifications yet.
                </li>
              ) : (
                items.map((item) => {
                  const when = formatRelativeTime(item.created_at, nowMs);
                  const body = (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {item.title}
                        </p>
                        {when ? (
                          <time
                            dateTime={item.created_at}
                            className="shrink-0 text-[10px] text-[var(--muted)]"
                          >
                            {when}
                          </time>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {item.body}
                      </p>
                    </>
                  );

                  return (
                    <li
                      key={item.id}
                      className={[
                        "border-b border-[var(--border)] last:border-b-0",
                        item.read_at ? "" : "bg-[var(--brand-soft)]/40",
                      ].join(" ")}
                    >
                      <div className="flex items-start">
                        {item.href ? (
                          <Link
                            href={item.href}
                            onClick={() => {
                              markOne(item.id);
                              setOpen(false);
                            }}
                            className="block min-w-0 flex-1 px-3 py-2.5 hover:bg-[var(--surface-hover)]"
                          >
                            {body}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => markOne(item.id)}
                            className="block min-w-0 flex-1 px-3 py-2.5 text-left hover:bg-[var(--surface-hover)]"
                          >
                            {body}
                          </button>
                        )}
                        <div className="flex shrink-0 items-center gap-0.5 py-2 pr-1.5">
                          <button
                            type="button"
                            onClick={() => toggleRead(item)}
                            disabled={pending}
                            title={item.read_at ? "Mark as unread" : "Mark as read"}
                            aria-label={item.read_at ? "Mark as unread" : "Mark as read"}
                            className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
                          >
                            {item.read_at ? (
                              <Undo2 className="h-3.5 w-3.5" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
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
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
            <div className="border-t border-[var(--border)] px-3 py-2">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="block text-center text-xs font-medium text-[var(--brand)] hover:underline"
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
