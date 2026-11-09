"use client";

import type { AttentionItem } from "@/lib/event-checklist/offline/store";

const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/** Offline banner, "waiting to sync" chip with Sync now, and the Needs attention list. */
export function SyncStatus({
  online,
  syncing,
  pendingCount,
  lastSyncedAt,
  attention,
  onSync,
  onDismiss,
}: {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
  attention: AttentionItem[];
  onSync: () => void;
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="space-y-2">
      {!online ? (
        <p
          className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          Offline: your changes are saved on this device and will sync when the signal is back.
        </p>
      ) : null}
      {pendingCount > 0 || lastSyncedAt ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          {pendingCount > 0 ? (
            <>
              <span className="rounded-full border border-amber-400 px-2 py-0.5 font-medium text-amber-800 dark:text-amber-200">
                {pendingCount} waiting to sync
              </span>
              <button
                type="button"
                onClick={onSync}
                disabled={syncing}
                className="font-medium text-[var(--brand)] hover:underline disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            </>
          ) : (
            <span>All changes synced{lastSyncedAt ? ` at ${TIME.format(new Date(lastSyncedAt))}` : ""}.</span>
          )}
        </div>
      ) : null}
      {attention.length > 0 ? (
        <div
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          <p className="font-semibold">Needs attention</p>
          <ul className="mt-1 space-y-1">
            {attention.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3">
                <span>{a.message}</span>
                <button type="button" onClick={() => a.id !== undefined && onDismiss(a.id)} className="shrink-0 underline">
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
