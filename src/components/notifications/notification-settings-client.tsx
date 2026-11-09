"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { setNotificationMuteAction } from "@/app/(app)/notification-settings/actions";
import { NOTIFICATION_KINDS } from "@/lib/notifications/kinds";
import { PushToggle } from "@/components/notifications/push-toggle";

export function NotificationSettingsClient({
  mutedKinds,
  isAdmin,
}: {
  mutedKinds: string[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [muted, setMuted] = useState<Set<string>>(new Set(mutedKinds));

  function toggle(kind: string, receiving: boolean) {
    // receiving = true means the user wants notifications (not muted).
    const nextMuted = !receiving;
    setMuted((prev) => {
      const next = new Set(prev);
      if (nextMuted) next.add(kind);
      else next.delete(kind);
      return next;
    });
    startTransition(async () => {
      const r = await setNotificationMuteAction({ kind, muted: nextMuted });
      if (r.error) {
        alert(r.error);
        // revert on error
        setMuted((prev) => {
          const next = new Set(prev);
          if (nextMuted) next.delete(kind);
          else next.add(kind);
          return next;
        });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <header>
        <Link href="/notifications" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          <ArrowLeft className="h-4 w-4" /> Notifications
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
          Notification preferences
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Choose which in-app notifications you receive. Turning one off stops
          new alerts of that type from appearing in your bell. Notifications from
          admins are always on.
        </p>
      </header>

      <PushToggle />

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-sm">
        <ul className="divide-y divide-[var(--border)]">
          {NOTIFICATION_KINDS.filter((k) => isAdmin || !k.adminOnly).map((k) => {
            const locked = k.mandatory && !isAdmin;
            const receiving = locked ? true : !muted.has(k.kind);
            return (
              <li key={k.kind} className="flex items-center justify-between gap-4 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">{k.label}</p>
                  <p className="text-sm text-[var(--muted)]">{k.description}</p>
                </div>
                {locked ? (
                  <span className="shrink-0 rounded-full bg-[var(--surface-hover)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]" title="Notifications from admins can't be turned off">
                    Always on
                  </span>
                ) : (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={receiving}
                    disabled={pending}
                    onClick={() => toggle(k.kind, !receiving)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
                      receiving ? "bg-[var(--brand)]" : "bg-[var(--surface-hover)]"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        receiving ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-xs text-[var(--muted)]">
        Note: this controls in-app (bell) notifications. Email notifications, where enabled, are sent separately.
      </p>
    </div>
  );
}
