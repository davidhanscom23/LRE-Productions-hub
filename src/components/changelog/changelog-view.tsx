"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Rocket, Sparkles, Wrench, ArrowUpCircle, MinusCircle } from "lucide-react";
import {
  CHANGELOG,
  CHANGELOG_SEEN_KEY,
  CHANGELOG_STAMP,
  type ChangelogCategory,
  type ChangelogEntry,
} from "@/lib/changelog";
import { audienceLabel, monthKey, type ChangelogVideo } from "@/lib/changelog-videos/visibility";

const CATEGORY_META: Record<
  ChangelogCategory,
  { label: string; classes: string; icon: React.ComponentType<{ className?: string }> }
> = {
  new: {
    label: "New",
    classes:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    icon: Sparkles,
  },
  improved: {
    label: "Improved",
    classes: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
    icon: ArrowUpCircle,
  },
  fixed: {
    label: "Fixed",
    classes:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    icon: Wrench,
  },
  removed: {
    label: "Removed",
    classes: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
    icon: MinusCircle,
  },
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function EntryCard({ entry }: { entry: ChangelogEntry }) {
  const meta = CATEGORY_META[entry.category];
  const Icon = meta.icon;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.classes}`}
        >
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </span>
        <span className="text-xs font-medium text-[var(--muted)]">
          {entry.area}
        </span>
      </div>
      <h3 className="mt-2 text-sm font-semibold">{entry.title}</h3>
      <p className="mt-1 text-sm text-[var(--foreground)]/80">
        {entry.description}
      </p>
      {entry.howTo ? (
        <p className="mt-2 rounded-lg bg-[var(--surface-hover)] px-3 py-2 text-xs text-[var(--muted)]">
          <span className="font-semibold text-[var(--foreground)]/70">
            How to use it:{" "}
          </span>
          {entry.howTo}
        </p>
      ) : null}
    </div>
  );
}

export function ChangelogView({ videos = [] }: { videos?: ChangelogVideo[] }) {
  // Mark the changelog as seen so the sidebar NEW badge clears.
  useEffect(() => {
    try {
      window.localStorage.setItem(CHANGELOG_SEEN_KEY, CHANGELOG_STAMP);
      window.dispatchEvent(new Event("vident-changelog-seen"));
    } catch {
      // ignore
    }
  }, []);

  const byDate = new Map<string, ChangelogEntry[]>();
  for (const entry of CHANGELOG) {
    const list = byDate.get(entry.date) ?? [];
    list.push(entry);
    byDate.set(entry.date, list);
  }

  const videosByMonth = new Map<string, ChangelogVideo[]>();
  for (const v of videos) {
    const key = monthKey(v.period_end);
    const list = videosByMonth.get(key) ?? [];
    list.push(v);
    videosByMonth.set(key, list);
  }
  const shownMonths = new Set<string>();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[var(--brand-soft)] p-2.5">
            <Rocket className="h-6 w-6 text-[var(--brand)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">What&apos;s New</h1>
            <p className="text-sm text-[var(--muted)]">
              Every change, fix, and new feature in the hub — updated
              automatically whenever something ships.
            </p>
          </div>
        </div>
        <Link
          href="/changelog/videos"
          className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-hover)]"
        >
          Change Log Videos
        </Link>
      </div>
      {[...byDate.entries()].map(([date, entries]) => {
        const month = monthKey(date);
        const monthVideos = shownMonths.has(month)
          ? []
          : (videosByMonth.get(month) ?? []);
        shownMonths.add(month);
        return (
        <section key={date}>
          {monthVideos.map((video) => (
            <div
              key={video.id}
              className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
            >
              <h2 className="text-sm font-semibold">
                {video.title}
                {audienceLabel(video.audience) ? (
                  <span className="ml-2 rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                    {audienceLabel(video.audience)}
                  </span>
                ) : null}
              </h2>
              <p className="mt-1 mb-3 text-xs text-[var(--muted)]">
                Watch first, then read the details below.
              </p>
              <video
                controls
                playsInline
                preload="metadata"
                src={video.src}
                aria-label={video.title}
                className="aspect-video w-full rounded-xl bg-black"
              />
            </div>
          ))}
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
            {formatDate(date)}
          </h2>
          <div className="flex flex-col gap-3">
            {entries.map((entry) => (
              <EntryCard key={`${entry.date}-${entry.title}`} entry={entry} />
            ))}
          </div>
        </section>
        );
      })}
    </div>
  );
}
