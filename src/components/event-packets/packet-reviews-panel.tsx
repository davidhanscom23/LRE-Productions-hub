"use client";

import { MessageSquareQuote, Star } from "lucide-react";
import type { EventExternalReview } from "@/lib/types/event-reviews";

type PacketReviewsPanelProps = {
  reviews: EventExternalReview[];
};

export function PacketReviewsPanel({ reviews }: PacketReviewsPanelProps) {
  if (!reviews.length) return null;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
        <MessageSquareQuote className="h-4 w-4 text-[var(--brand)]" />
        Website reviews
        <span className="font-normal text-[var(--muted)]">
          ({reviews.length})
        </span>
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Synced from the testimonials spreadsheet by Event ID. Used when
        generating Social Studio captions.
      </p>
      <ul className="mt-3 space-y-3">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)]/60 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-[var(--foreground)]">
                {review.reviewer_name.trim() || "Client"}
              </p>
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                {review.rating != null ? (
                  <span className="inline-flex items-center gap-0.5 font-medium text-amber-700 dark:text-amber-300">
                    <Star className="h-3 w-3 fill-current" />
                    {review.rating}/5
                  </span>
                ) : null}
                {review.review_date ? <span>{review.review_date}</span> : null}
              </div>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
              {review.comment}
            </p>
            {review.show_on_site === false ? (
              <p className="mt-1 text-[11px] font-medium text-[var(--muted)]">
                Marked not for site — captions will skip this quote.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
