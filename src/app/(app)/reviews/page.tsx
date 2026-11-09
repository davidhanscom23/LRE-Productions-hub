import { ReviewsAdminClient } from "@/components/reviews/reviews-admin-client";
import { ReviewsStaffClient } from "@/components/reviews/reviews-staff-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeGoals,
  normalizeRatings,
  type MyReview,
  type PerformanceReview,
  type ReviewCycle,
} from "@/lib/types/reviews";
import { redirect } from "next/navigation";

function MigrationNotice({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="font-semibold">Reviews needs a database update</p>
      <p className="mt-2">
        Run migration <code>052_performance_reviews.sql</code> (and{" "}
        <code>066_onboarding_subject_reviews_managers.sql</code> for managers)
        in Supabase, then refresh. ({message})
      </p>
    </div>
  );
}

function normalizeMyReview(raw: Record<string, unknown>): MyReview {
  return {
    id: String(raw.id),
    cycle_id: String(raw.cycle_id),
    cycle_name: String(raw.cycle_name ?? ""),
    cycle_status: raw.cycle_status === "closed" ? "closed" : "open",
    due_date: (raw.due_date as string) ?? null,
    self_ratings: normalizeRatings(raw.self_ratings),
    self_overall: String(raw.self_overall ?? ""),
    self_status: raw.self_status === "submitted" ? "submitted" : "not_started",
    self_submitted_at: (raw.self_submitted_at as string) ?? null,
    manager_status: (raw.manager_status as MyReview["manager_status"]) ?? "not_started",
    shared: Boolean(raw.shared),
    manager_ratings: normalizeRatings(raw.manager_ratings),
    manager_overall: String(raw.manager_overall ?? ""),
    overall_rating:
      typeof raw.overall_rating === "number" ? raw.overall_rating : null,
    goals: normalizeGoals(raw.goals),
    reviewed_at: (raw.reviewed_at as string) ?? null,
  };
}

function normalizeReviewRow(
  raw: Record<string, unknown>,
  subjectName: string,
): PerformanceReview {
  return {
    id: String(raw.id),
    cycle_id: String(raw.cycle_id),
    subject_id: String(raw.subject_id),
    self_ratings: normalizeRatings(raw.self_ratings),
    self_overall: String(raw.self_overall ?? ""),
    self_status: raw.self_status === "submitted" ? "submitted" : "not_started",
    self_submitted_at: (raw.self_submitted_at as string) ?? null,
    manager_ratings: normalizeRatings(raw.manager_ratings),
    manager_overall: String(raw.manager_overall ?? ""),
    overall_rating:
      typeof raw.overall_rating === "number" ? raw.overall_rating : null,
    goals: normalizeGoals(raw.goals),
    manager_status:
      (raw.manager_status as PerformanceReview["manager_status"]) ?? "not_started",
    reviewed_at: (raw.reviewed_at as string) ?? null,
    shared_at: (raw.shared_at as string) ?? null,
    subject_name: subjectName,
  };
}

export default async function ReviewsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  // Department / legacy managers get the manager UI for their reports.
  let isManager = isAdmin;
  if (!isAdmin) {
    const [{ count: legacyCount }, { count: deptCount }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("reports_to", profile.id)
        .eq("is_active", true),
      supabase
        .from("profile_department_managers")
        .select("profile_id", { count: "exact", head: true })
        .eq("reports_to", profile.id),
    ]);
    isManager = (legacyCount ?? 0) > 0 || (deptCount ?? 0) > 0;
  }

  if (!isManager) {
    const { data, error } = await supabase.rpc("list_my_reviews");
    if (error) return <MigrationNotice message={error.message} />;
    const reviews = ((data ?? []) as Record<string, unknown>[]).map(
      normalizeMyReview,
    );
    return <ReviewsStaffClient reviews={reviews} />;
  }

  const { data: cycleRows, error: cyErr } = await supabase
    .from("review_cycles")
    .select("*")
    .order("created_at", { ascending: false });
  if (cyErr) return <MigrationNotice message={cyErr.message} />;

  let reviewRows: Record<string, unknown>[] = [];
  if (isAdmin) {
    const { data } = await supabase
      .from("performance_reviews")
      .select("*")
      .order("created_at", { ascending: false });
    reviewRows = (data ?? []) as Record<string, unknown>[];
  } else {
    const { data, error } = await supabase.rpc("list_managed_reviews");
    if (error) {
      // Fallback to RLS select if RPC not applied yet.
      const { data: fallback, error: fbErr } = await supabase
        .from("performance_reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (fbErr) return <MigrationNotice message={error.message} />;
      reviewRows = (fallback ?? []) as Record<string, unknown>[];
    } else {
      reviewRows = (data ?? []) as Record<string, unknown>[];
    }
  }

  const ids = Array.from(
    new Set(reviewRows.map((r) => String(r.subject_id))),
  );
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map(
    (people ?? []).map((p) => [p.id as string, p.full_name as string]),
  );

  const reviews = reviewRows.map((r) =>
    normalizeReviewRow(r, nameById.get(String(r.subject_id)) ?? "Unknown"),
  );

  // Managers also see their own self-assessment list below via a combined view:
  // keep admin client focused; staff self reviews remain on a separate path when
  // they aren't managers. Managers who are also subjects use staff client only
  // when they have no reports — rare. Optional: show staff client link.
  const { data: myData } = await supabase.rpc("list_my_reviews");
  const myReviews = ((myData ?? []) as Record<string, unknown>[]).map(
    normalizeMyReview,
  );

  return (
    <div className="space-y-10">
      <ReviewsAdminClient
        cycles={(cycleRows ?? []) as ReviewCycle[]}
        reviews={reviews}
        isAdmin={isAdmin}
      />
      {myReviews.length > 0 ? (
        <div className="border-t border-[var(--border)] pt-8">
          <ReviewsStaffClient reviews={myReviews} />
        </div>
      ) : null}
    </div>
  );
}
