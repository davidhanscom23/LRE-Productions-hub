"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { acknowledgeAnnouncementAction } from "@/app/(app)/announcements/actions";
import type { Announcement } from "@/lib/types/announcements";

export function AnnouncementsBanner({
  announcements,
}: {
  announcements: Announcement[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!announcements.length) return null;

  function acknowledge(id: string) {
    startTransition(async () => {
      await acknowledgeAnnouncementAction(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {announcements.map((a) => (
        <div
          key={a.id}
          className="rounded-[var(--panel-radius)] border border-[var(--brand)]/30 bg-[var(--brand-soft)] p-4"
        >
          <div className="flex items-start gap-3">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-[var(--foreground)]">{a.title}</p>
                <Link
                  href="/announcements"
                  className="text-xs font-medium text-[var(--brand)] hover:underline"
                >
                  All announcements
                </Link>
              </div>
              {a.body ? (
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-[var(--foreground)]/90">
                  {a.body}
                </p>
              ) : null}
              {a.requires_ack ? (
                a.acked ? (
                  <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    ✓ Acknowledged
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => acknowledge(a.id)}
                    className="mt-2 inline-flex h-8 items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                )
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
