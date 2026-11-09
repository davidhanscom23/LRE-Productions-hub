"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSelfAssessmentAction } from "@/app/(app)/reviews/actions";
import {
  GOAL_STATUSES,
  REVIEW_COMPETENCIES,
  emptyRatings,
  type MyReview,
  type RatingMap,
} from "@/lib/types/reviews";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ScorePicker({
  value,
  onChange,
  readOnly = false,
}: {
  value: number | null;
  onChange?: (n: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(n)}
            aria-label={`${n} of 5`}
            className={`h-8 w-8 rounded-md border text-sm font-semibold transition-colors ${
              on
                ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                : "border-[var(--border)] text-[var(--muted)]"
            } ${readOnly ? "cursor-default" : "hover:border-[var(--brand)]"}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

function goalStatusLabel(status: string): string {
  return GOAL_STATUSES.find((g) => g.value === status)?.label ?? "Not started";
}

function StaffReviewCard({ review }: { review: MyReview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ratings, setRatings] = useState<RatingMap>(() =>
    review.self_status === "submitted" || hasAny(review.self_ratings)
      ? review.self_ratings
      : emptyRatings(),
  );
  const [overall, setOverall] = useState(review.self_overall);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const editable =
    review.cycle_status === "open" && review.self_status !== "submitted";

  function setScore(key: string, score: number) {
    setRatings((prev) => ({ ...prev, [key]: { ...prev[key], score } }));
  }
  function setComment(key: string, comment: string) {
    setRatings((prev) => ({ ...prev, [key]: { ...prev[key], comment } }));
  }

  function save(submit: boolean) {
    if (submit && !confirm("Submit your self-assessment? You won't be able to edit it after.")) {
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveSelfAssessmentAction({
        reviewId: review.id,
        ratings,
        overall,
        submit,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(submit ? "Self-assessment submitted." : "Draft saved.");
      router.refresh();
    });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            {review.cycle_name}
          </h2>
          {review.due_date ? (
            <p className="text-sm text-[var(--muted)]">
              Due {fmtDate(review.due_date)}
            </p>
          ) : null}
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            review.self_status === "submitted"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
              : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
          }`}
        >
          {review.self_status === "submitted"
            ? "Self-assessment submitted"
            : "Self-assessment due"}
        </span>
      </div>

      {/* Self-assessment */}
      <div className="mt-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Your self-assessment
        </p>
        {REVIEW_COMPETENCIES.map((c) => (
          <div key={c.key} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-[var(--foreground)]">
                {c.label}
              </span>
              <ScorePicker
                value={ratings[c.key]?.score ?? null}
                onChange={(n) => setScore(c.key, n)}
                readOnly={!editable}
              />
            </div>
            {editable ? (
              <textarea
                value={ratings[c.key]?.comment ?? ""}
                onChange={(e) => setComment(c.key, e.target.value)}
                rows={2}
                placeholder="Optional comment"
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
              />
            ) : ratings[c.key]?.comment ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                {ratings[c.key].comment}
              </p>
            ) : null}
          </div>
        ))}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Overall notes
          </span>
          {editable ? (
            <textarea
              value={overall}
              onChange={(e) => setOverall(e.target.value)}
              rows={3}
              placeholder="Wins this period, challenges, what you want to focus on next…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
            />
          ) : (
            <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">
              {overall || "—"}
            </p>
          )}
        </label>

        {error ? (
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : null}
        {message ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            {message}
          </p>
        ) : null}

        {editable ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => save(false)}
              className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => save(true)}
              className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        ) : null}
      </div>

      {/* Manager feedback */}
      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Manager review
        </p>
        {!review.shared ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Your manager’s review isn’t ready yet. You’ll see it here once it’s
            shared.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {review.overall_rating ? (
              <p className="text-sm text-[var(--foreground)]">
                Overall rating:{" "}
                <span className="font-semibold text-[var(--brand)]">
                  {review.overall_rating} / 5
                </span>
              </p>
            ) : null}
            {REVIEW_COMPETENCIES.map((c) => {
              const r = review.manager_ratings[c.key];
              if (!r || (r.score == null && !r.comment)) return null;
              return (
                <div key={c.key} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {c.label}
                    </span>
                    <ScorePicker value={r.score} readOnly />
                  </div>
                  {r.comment ? (
                    <p className="mt-2 text-sm text-[var(--muted)]">{r.comment}</p>
                  ) : null}
                </div>
              );
            })}
            {review.manager_overall ? (
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Overall
                </p>
                <p className="mt-1 text-sm text-[var(--muted)] whitespace-pre-wrap">
                  {review.manager_overall}
                </p>
              </div>
            ) : null}
            {review.goals.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Goals
                </p>
                <ul className="mt-2 space-y-2">
                  {review.goals.map((g, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[var(--foreground)]">
                          {g.title}
                        </span>
                        <span className="text-xs text-[var(--muted)]">
                          {goalStatusLabel(g.status)}
                        </span>
                      </div>
                      {g.detail ? (
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {g.detail}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}

function hasAny(ratings: RatingMap): boolean {
  return Object.values(ratings).some((r) => r.score != null || r.comment);
}

export function ReviewsStaffClient({ reviews }: { reviews: MyReview[] }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Performance Reviews
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Complete your self-assessment and see your manager’s feedback here.
        </p>
      </header>

      {reviews.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            You don’t have any reviews yet. When an admin opens a review cycle,
            it’ll show up here.
          </p>
        </Card>
      ) : (
        reviews.map((r) => <StaffReviewCard key={r.id} review={r} />)
      )}
    </div>
  );
}
