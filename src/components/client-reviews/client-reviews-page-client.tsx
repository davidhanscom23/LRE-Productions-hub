"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ExternalLink,
  MessageSquareQuote,
  Search,
  Star,
  Trophy,
} from "lucide-react";
import type { ClientReviewListItem } from "@/lib/reviews/load-client-reviews";
import type { ReviewStaffProfile } from "@/lib/reviews/attribution";
import {
  CLIENT_REVIEW_MILESTONES,
  earnedClientReviewMilestones,
  nextClientReviewMilestone,
} from "@/lib/reviews/milestones";
import { syncSheetReviewsAction } from "@/app/(app)/event-packets/actions";

type ClientReviewsPageClientProps = {
  reviews: ClientReviewListItem[];
  staffOptions: ReviewStaffProfile[];
  countsByStaffId: Record<string, number>;
  canViewAll: boolean;
  canSync: boolean;
  selectedStaffId: string | null;
  focusCount: number;
  focusName: string;
};

function Stars({ rating }: { rating: number | null }) {
  if (rating == null) return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-300"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={[
            "h-3.5 w-3.5",
            i < rating ? "fill-current" : "opacity-25",
          ].join(" ")}
        />
      ))}
    </span>
  );
}

export function ClientReviewsPageClient({
  reviews,
  staffOptions,
  countsByStaffId,
  canViewAll,
  canSync,
  selectedStaffId,
  focusCount,
  focusName,
}: ClientReviewsPageClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const earned = earnedClientReviewMilestones(focusCount);
  const next = nextClientReviewMilestone(focusCount);
  const progressMax = next?.count ?? CLIENT_REVIEW_MILESTONES.at(-1)?.count ?? 1;
  const progressPct = Math.min(100, Math.round((focusCount / progressMax) * 100));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((review) => {
      const hay = [
        review.reviewer_name,
        review.comment,
        review.event_type,
        review.services,
        review.staff_members,
        review.review_date,
        ...review.creditedStaff.map((p) => p.full_name),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [reviews, query]);

  function setStaffFilter(value: string) {
    const params = new URLSearchParams();
    if (value) params.set("staff", value);
    const qs = params.toString();
    router.push(qs ? `/client-reviews?${qs}` : "/client-reviews");
  }

  function handleSync() {
    setSyncMessage(null);
    startTransition(async () => {
      const result = await syncSheetReviewsAction();
      if (result.error) {
        setSyncMessage(result.error);
        return;
      }
      setSyncMessage(
        `Synced ${result.upserted ?? 0} reviews${
          result.pruned ? ` · removed ${result.pruned} outdated` : ""
        }.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
          Field tools
        </p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          <MessageSquareQuote className="h-6 w-6 text-[var(--brand)]" />
          Client Reviews
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {canViewAll
            ? "Website testimonials credited to the team. Admins and trainers can browse anyone’s reviews."
            : "Website testimonials credited to you."}
        </p>
      </header>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
              <Trophy className="h-4 w-4 text-[var(--brand)]" />
              Review milestones
              {focusName ? (
                <span className="font-normal text-[var(--muted)]">
                  · {focusName}
                </span>
              ) : null}
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Hub points at 1, 3, 5, 10, 25, 50, and 100 attributed reviews.
            </p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-[var(--foreground)]">
            {focusCount}
            <span className="ml-1 text-sm font-normal text-[var(--muted)]">
              reviews
            </span>
          </p>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--background)]">
          <div
            className="h-full rounded-full bg-[var(--brand)] transition-[width]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          {next
            ? `${next.count - focusCount} more to unlock “${next.title}” (+${next.points} pts)`
            : focusCount > 0
              ? "All review milestones unlocked."
              : "Attributed reviews will show progress here."}
        </p>

        <ul className="mt-3 flex flex-wrap gap-2">
          {CLIENT_REVIEW_MILESTONES.map((m) => {
            const unlocked = earned.some((e) => e.key === m.key);
            return (
              <li
                key={m.key}
                className={[
                  "rounded-md border px-2 py-1 text-[11px] font-medium",
                  unlocked
                    ? "border-[var(--brand)]/40 bg-[var(--brand-soft)] text-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--muted)]",
                ].join(" ")}
              >
                {m.count} · {m.points} pts
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search client, quote, staff, date…"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pr-3 pl-9 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
            aria-label="Search client reviews"
          />
        </div>
        {canViewAll ? (
          <label className="flex shrink-0 items-center gap-2 text-sm text-[var(--muted)]">
            <span className="sr-only">Filter by staff</span>
            <select
              value={selectedStaffId ?? ""}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="h-10 min-w-[12rem] rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            >
              <option value="">Everyone</option>
              {staffOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name.trim() || person.email} (
                  {countsByStaffId[person.id] ?? 0})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {canSync ? (
          <button
            type="button"
            disabled={pending}
            onClick={handleSync}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            {pending ? "Syncing…" : "Sync"}
          </button>
        ) : null}
      </div>

      {syncMessage ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]">
          {syncMessage}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          {reviews.length === 0
            ? canViewAll
              ? "No client reviews synced yet."
              : "No reviews credited to you yet."
            : "No reviews match that search."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((review) => (
            <li
              key={review.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {review.reviewer_name.trim() || "Client"}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {[review.review_date, review.event_type, review.services]
                      .filter((v) => v && String(v).trim())
                      .join(" · ")}
                  </p>
                </div>
                <Stars rating={review.rating} />
              </div>

              <blockquote className="mt-3 border-l-2 border-[var(--brand)]/50 pl-3 text-sm leading-relaxed text-[var(--foreground)]">
                “{review.comment.trim()}”
              </blockquote>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                {review.creditedStaff.length ? (
                  <span>
                    Credited:{" "}
                    {review.creditedStaff
                      .map((p) => p.full_name.trim() || p.email)
                      .join(", ")}
                  </span>
                ) : review.staff_members.trim() ? (
                  <span>Sheet staff: {review.staff_members.trim()}</span>
                ) : (
                  <span>Unattributed</span>
                )}
                {review.show_on_site === false ? (
                  <span className="font-medium">Not shown on website</span>
                ) : null}
                {review.packetIds[0] ? (
                  <Link
                    href={`/event-packets/${review.packetIds[0]}`}
                    className="inline-flex items-center gap-1 font-medium text-[var(--brand)] hover:underline"
                  >
                    Open packet
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
