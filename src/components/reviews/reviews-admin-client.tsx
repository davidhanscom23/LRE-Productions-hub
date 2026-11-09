"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCycleAction,
  generateReviewsAction,
  saveManagerReviewAction,
  setCycleStatusAction,
  shareReviewAction,
} from "@/app/(app)/reviews/actions";
import {
  GOAL_STATUSES,
  REVIEW_COMPETENCIES,
  emptyRatings,
  type PerformanceReview,
  type RatingMap,
  type ReviewCycle,
  type ReviewGoal,
} from "@/lib/types/reviews";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
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

function statusChip(label: string, tone: "gray" | "amber" | "green") {
  const styles =
    tone === "green"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
      : tone === "amber"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
        : "bg-[var(--surface-hover)] text-[var(--muted)]";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}

function AdminReviewEditor({ review }: { review: PerformanceReview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ratings, setRatings] = useState<RatingMap>(() =>
    Object.values(review.manager_ratings).some((r) => r.score != null || r.comment)
      ? review.manager_ratings
      : emptyRatings(),
  );
  const [overall, setOverall] = useState(review.manager_overall);
  const [overallRating, setOverallRating] = useState<number | null>(
    review.overall_rating,
  );
  const [goals, setGoals] = useState<ReviewGoal[]>(review.goals);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function setScore(key: string, score: number) {
    setRatings((prev) => ({ ...prev, [key]: { ...prev[key], score } }));
  }
  function setComment(key: string, comment: string) {
    setRatings((prev) => ({ ...prev, [key]: { ...prev[key], comment } }));
  }
  function addGoal() {
    setGoals((g) => [...g, { title: "", detail: "", status: "not_started" }]);
  }
  function updateGoal(i: number, patch: Partial<ReviewGoal>) {
    setGoals((g) => g.map((goal, idx) => (idx === i ? { ...goal, ...patch } : goal)));
  }
  function removeGoal(i: number) {
    setGoals((g) => g.filter((_, idx) => idx !== i));
  }

  function save() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveManagerReviewAction({
        reviewId: review.id,
        ratings,
        overall,
        overallRating,
        goals: goals.filter((g) => g.title.trim()),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Saved.");
      router.refresh();
    });
  }

  function share() {
    if (!confirm("Share this review with the staffer? They'll be able to read your feedback.")) {
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const save = await saveManagerReviewAction({
        reviewId: review.id,
        ratings,
        overall,
        overallRating,
        goals: goals.filter((g) => g.title.trim()),
      });
      if (save.error) {
        setError(save.error);
        return;
      }
      const result = await shareReviewAction(review.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Shared with the staffer.");
      router.refresh();
    });
  }

  const shared = review.manager_status === "shared";

  return (
    <div className="mt-3 space-y-5 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
      {/* Staffer's self-assessment (read-only) */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          {review.subject_name}’s self-assessment{" "}
          {review.self_status !== "submitted" ? "(not submitted yet)" : ""}
        </p>
        <div className="mt-2 space-y-2">
          {REVIEW_COMPETENCIES.map((c) => {
            const r = review.self_ratings[c.key];
            return (
              <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-[var(--muted)]">{c.label}</span>
                <span className="font-medium text-[var(--foreground)]">
                  {r?.score ? `${r.score}/5` : "—"}
                  {r?.comment ? ` · ${r.comment}` : ""}
                </span>
              </div>
            );
          })}
          {review.self_overall ? (
            <p className="mt-1 text-sm text-[var(--muted)] whitespace-pre-wrap">
              “{review.self_overall}”
            </p>
          ) : null}
        </div>
      </div>

      {/* Manager ratings */}
      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Your review
        </p>
        {REVIEW_COMPETENCIES.map((c) => (
          <div key={c.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-[var(--foreground)]">
                {c.label}
              </span>
              <ScorePicker
                value={ratings[c.key]?.score ?? null}
                onChange={(n) => setScore(c.key, n)}
              />
            </div>
            <textarea
              value={ratings[c.key]?.comment ?? ""}
              onChange={(e) => setComment(c.key, e.target.value)}
              rows={2}
              placeholder="Comment"
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
            />
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Overall rating
          </span>
          <ScorePicker value={overallRating} onChange={(n) => setOverallRating(n)} />
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Overall notes
          </span>
          <textarea
            value={overall}
            onChange={(e) => setOverall(e.target.value)}
            rows={3}
            placeholder="Summary of strengths and areas to grow…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
          />
        </label>
      </div>

      {/* Goals */}
      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Goals for next period
          </p>
          <button
            type="button"
            onClick={addGoal}
            className="text-xs font-medium text-[var(--brand)] hover:underline"
          >
            + Add goal
          </button>
        </div>
        {goals.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No goals set.</p>
        ) : (
          goals.map((g, i) => (
            <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={g.title}
                  onChange={(e) => updateGoal(i, { title: e.target.value })}
                  placeholder="Goal title"
                  className="h-9 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                />
                <select
                  value={g.status}
                  onChange={(e) => updateGoal(i, { status: e.target.value as ReviewGoal["status"] })}
                  className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                >
                  {GOAL_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeGoal(i)}
                  className="text-xs text-[var(--muted)] hover:text-red-600"
                  aria-label="Remove goal"
                >
                  Remove
                </button>
              </div>
              <textarea
                value={g.detail}
                onChange={(e) => updateGoal(i, { detail: e.target.value })}
                rows={2}
                placeholder="Detail (optional)"
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              />
            </div>
          ))
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={share}
          className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {shared ? "Re-share" : "Save & share"}
        </button>
        {shared ? statusChip("Shared", "green") : null}
      </div>
    </div>
  );
}

export function ReviewsAdminClient({
  cycles,
  reviews,
  isAdmin = true,
}: {
  cycles: ReviewCycle[];
  reviews: PerformanceReview[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedCycle, setSelectedCycle] = useState<string | null>(
    cycles[0]?.id ?? null,
  );
  const [openReview, setOpenReview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reviewsByCycle = useMemo(() => {
    const map = new Map<string, PerformanceReview[]>();
    for (const r of reviews) {
      const list = map.get(r.cycle_id) ?? [];
      list.push(r);
      map.set(r.cycle_id, list);
    }
    return map;
  }, [reviews]);

  const activeCycle = cycles.find((c) => c.id === selectedCycle) ?? null;
  const cycleReviews = selectedCycle
    ? (reviewsByCycle.get(selectedCycle) ?? []).slice().sort((a, b) =>
        (a.subject_name ?? "").localeCompare(b.subject_name ?? ""),
      )
    : [];

  function createCycle() {
    setError(null);
    startTransition(async () => {
      const result = await createCycleAction({ name, description, dueDate });
      if (result.error) {
        setError(result.error);
        return;
      }
      setName("");
      setDescription("");
      setDueDate("");
      router.refresh();
    });
  }

  function toggleCycle(cycle: ReviewCycle) {
    startTransition(async () => {
      await setCycleStatusAction({
        cycleId: cycle.id,
        status: cycle.status === "open" ? "closed" : "open",
      });
      router.refresh();
    });
  }

  function generate(cycleId: string) {
    startTransition(async () => {
      const result = await generateReviewsAction(cycleId);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Performance Reviews
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {isAdmin
            ? "Create review cycles, track self-assessments, and write manager reviews. Feedback stays private until you share it."
            : "Write and share reviews for your direct reports. Feedback stays private until you share it."}
        </p>
      </header>

      {/* Create cycle — admins only */}
      {isAdmin ? (
      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          New review cycle
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 2026 Annual Review"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
        </div>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="mt-3 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
        />
        {error ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : null}
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={createCycle}
          className="mt-3 inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          Create cycle
        </button>
      </Card>
      ) : null}

      {/* Cycles */}
      {cycles.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            No cycles yet. Create one above, then generate reviews for your
            staff.
          </p>
        </Card>
      ) : (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Cycles
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {cycles.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedCycle(c.id);
                  setOpenReview(null);
                }}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                  selectedCycle === c.id
                    ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {c.name}
                {c.status === "closed" ? statusChip("Closed", "gray") : null}
              </button>
            ))}
          </div>

          {activeCycle && isAdmin ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => generate(activeCycle.id)}
                className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
              >
                Generate reviews for all staff
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => toggleCycle(activeCycle)}
                className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
              >
                {activeCycle.status === "open" ? "Close cycle" : "Reopen cycle"}
              </button>
            </div>
          ) : null}
        </Card>
      )}

      {/* Reviews in selected cycle */}
      {activeCycle ? (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            {activeCycle.name} — reviews
          </h2>
          {cycleReviews.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              {isAdmin
                ? "No reviews yet. Click “Generate reviews for all staff” above."
                : "No reviews for your reports in this cycle yet."}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {cycleReviews.map((r) => {
                const isOpen = openReview === r.id;
                return (
                  <li
                    key={r.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenReview(isOpen ? null : r.id)}
                      className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                    >
                      <span className="text-sm font-medium text-[var(--foreground)]">
                        {r.subject_name}
                      </span>
                      <span className="flex items-center gap-2">
                        {r.self_status === "submitted"
                          ? statusChip("Self ✓", "green")
                          : statusChip("Self pending", "amber")}
                        {r.manager_status === "shared"
                          ? statusChip("Shared", "green")
                          : r.manager_status === "in_progress"
                            ? statusChip("Draft", "amber")
                            : statusChip("Not started", "gray")}
                      </span>
                    </button>
                    {isOpen ? <AdminReviewEditor review={r} /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
