import { ShieldAlert, Star } from "lucide-react";
import { markPrivateFeedbackReviewedAction } from "@/app/(app)/client-reviews/actions";
import { createClient } from "@/lib/supabase/server";

type FeedbackRow = {
  id: string;
  full_name: string;
  email: string;
  improve_areas: string;
  team_handled: string;
  rating: number | null;
  status: string;
  created_at: string;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Admin only: private feedback from the public review page
 * (review.lreproductions.com), left by clients who tapped 1-3 stars.
 */
export async function PrivateFeedbackPanel() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("private_review_feedback")
    .select(
      "id, full_name, email, improve_areas, team_handled, rating, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as FeedbackRow[];
  const newCount = rows.filter((row) => row.status === "new").length;

  return (
    <section
      id="private-feedback"
      className="mx-auto mb-6 max-w-4xl scroll-mt-24 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
          <ShieldAlert className="h-5 w-5 text-[var(--brand)]" />
          Private feedback
          {newCount > 0 ? (
            <span className="rounded-full bg-[var(--brand)] px-2 py-0.5 text-xs font-semibold text-white">
              {newCount} new
            </span>
          ) : null}
        </h2>
        <p className="text-xs text-[var(--muted)]">Admins only</p>
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">
        What clients told us privately after tapping 1 to 3 stars on our review
        page. These are never shown on the website or to staff.
      </p>

      {error ? (
        <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-3 text-sm text-[var(--muted)]">
          Private feedback could not be loaded. If this is new, the database
          update for it may not have been run yet.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-3 text-sm text-[var(--muted)]">
          No private feedback yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {row.full_name || "No name given"}
                  </p>
                  <a
                    href={`mailto:${row.email}`}
                    className="break-all text-sm text-[var(--brand)] underline"
                  >
                    {row.email}
                  </a>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--muted)]">
                    <span>{formatWhen(row.created_at)}</span>
                    {row.rating ? (
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {row.rating} of 5
                      </span>
                    ) : null}
                  </p>
                </div>
                {row.status === "new" ? (
                  <form action={markPrivateFeedbackReviewedAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium hover:bg-[var(--surface-hover)]"
                    >
                      Mark reviewed
                    </button>
                  </form>
                ) : (
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
                    Reviewed
                  </span>
                )}
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-semibold text-[var(--muted)]">
                    What areas could we have improved on for your event?
                  </dt>
                  <dd className="whitespace-pre-wrap text-[var(--foreground)]">
                    {row.improve_areas || "No answer"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-[var(--muted)]">
                    Is there anything our team could have handled better?
                  </dt>
                  <dd className="whitespace-pre-wrap text-[var(--foreground)]">
                    {row.team_handled || "No answer"}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
