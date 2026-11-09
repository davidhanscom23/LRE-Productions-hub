"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { sendEmail } from "@/lib/email/send";
import { insertNotifications } from "@/lib/notifications/notify";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeGoals,
  normalizeRatings,
  type RatingMap,
  type ReviewGoal,
} from "@/lib/types/reviews";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, error: "Sign in first." as const };
  if (profile.role !== "admin") {
    return { profile: null, error: "Admins only." as const };
  }
  return { profile, error: null as string | null };
}

async function requireReviewManager(reviewId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, error: "Sign in first." as const };
  if (profile.role === "guest") {
    return { profile: null, error: "Guest access is read-only." as const };
  }

  const supabase = await createClient();
  const { data: review } = await supabase
    .from("performance_reviews")
    .select("id, subject_id")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review) return { profile: null, error: "Review not found." as const };

  if (profile.role === "admin") {
    return { profile, supabase, review, error: null as string | null };
  }

  const subjectId = review.subject_id as string;
  const { data: subject } = await supabase
    .from("profiles")
    .select("reports_to")
    .eq("id", subjectId)
    .maybeSingle();
  if (subject?.reports_to === profile.id) {
    return { profile, supabase, review, error: null as string | null };
  }

  const { data: deptEdge } = await supabase
    .from("profile_department_managers")
    .select("profile_id")
    .eq("profile_id", subjectId)
    .eq("reports_to", profile.id)
    .maybeSingle();
  if (deptEdge) {
    return { profile, supabase, review, error: null as string | null };
  }

  return {
    profile: null,
    error: "Only admins or this person’s manager can edit this review." as const,
  };
}

// ── Staff: self-assessment ─────────────────────────────────────────────
export async function saveSelfAssessmentAction(input: {
  reviewId: string;
  ratings: RatingMap;
  overall: string;
  submit: boolean;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_self_assessment", {
    p_review_id: input.reviewId,
    p_ratings: normalizeRatings(input.ratings),
    p_overall: (input.overall ?? "").slice(0, 4000),
    p_submit: Boolean(input.submit),
  });
  if (error) return { error: error.message };

  revalidatePath("/reviews");
  return { error: null };
}

// ── Admin: cycles ──────────────────────────────────────────────────────
export async function createCycleAction(input: {
  name: string;
  description: string;
  dueDate: string;
}): Promise<Result> {
  const { profile, error: authErr } = await requireAdmin();
  if (authErr || !profile) return { error: authErr };

  const name = input.name?.trim();
  if (!name) return { error: "Give the cycle a name." };
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate?.trim() ?? "")
    ? input.dueDate.trim()
    : null;

  const supabase = await createClient();
  const { error } = await supabase.from("review_cycles").insert({
    name,
    description: (input.description ?? "").trim().slice(0, 1000),
    due_date: dueDate,
    created_by: profile.id,
    status: "open",
  });
  if (error) return { error: error.message };

  revalidatePath("/reviews");
  return { error: null };
}

export async function setCycleStatusAction(input: {
  cycleId: string;
  status: "open" | "closed";
}): Promise<Result> {
  const { profile, error: authErr } = await requireAdmin();
  if (authErr || !profile) return { error: authErr };

  const supabase = await createClient();
  const { error } = await supabase
    .from("review_cycles")
    .update({ status: input.status })
    .eq("id", input.cycleId);
  if (error) return { error: error.message };

  revalidatePath("/reviews");
  return { error: null };
}

/** Create a review row for every active staffer in the cycle (skips existing). */
export async function generateReviewsAction(cycleId: string): Promise<Result> {
  const { profile, error: authErr } = await requireAdmin();
  if (authErr || !profile) return { error: authErr };
  if (!cycleId?.trim()) return { error: "Missing cycle." };

  const supabase = await createClient();
  const { data: people, error: peopleErr } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("is_active", true);
  if (peopleErr) return { error: peopleErr.message };

  const rows = (people ?? [])
    .filter((p) => p.role !== "guest")
    .map((p) => ({ cycle_id: cycleId, subject_id: p.id as string }));
  if (rows.length === 0) return { error: "No active staff to review." };

  const { error } = await supabase
    .from("performance_reviews")
    .upsert(rows, { onConflict: "cycle_id,subject_id", ignoreDuplicates: true });
  if (error) return { error: error.message };

  revalidatePath("/reviews");
  return { error: null };
}

// ── Admin: manager review ──────────────────────────────────────────────
export async function saveManagerReviewAction(input: {
  reviewId: string;
  ratings: RatingMap;
  overall: string;
  overallRating: number | null;
  goals: ReviewGoal[];
}): Promise<Result> {
  const auth = await requireReviewManager(input.reviewId);
  if (auth.error || !auth.profile) return { error: auth.error };

  const rating =
    typeof input.overallRating === "number" &&
    input.overallRating >= 1 &&
    input.overallRating <= 5
      ? input.overallRating
      : null;

  const supabase = auth.supabase!;
  // Don't downgrade a shared review back to in_progress.
  const { data: existing } = await supabase
    .from("performance_reviews")
    .select("manager_status")
    .eq("id", input.reviewId)
    .maybeSingle();
  const nextStatus =
    existing?.manager_status === "shared" ? "shared" : "in_progress";

  const { error } = await supabase
    .from("performance_reviews")
    .update({
      manager_ratings: normalizeRatings(input.ratings),
      manager_overall: (input.overall ?? "").slice(0, 4000),
      overall_rating: rating,
      goals: normalizeGoals(input.goals),
      manager_status: nextStatus,
      reviewed_by: auth.profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.reviewId);
  if (error) return { error: error.message };

  revalidatePath("/reviews");
  revalidatePath("/for-you");
  return { error: null };
}

export async function shareReviewAction(reviewId: string): Promise<Result> {
  const auth = await requireReviewManager(reviewId);
  if (auth.error || !auth.profile) return { error: auth.error };

  const now = new Date().toISOString();
  const supabase = auth.supabase!;
  const { data: updated, error } = await supabase
    .from("performance_reviews")
    .update({
      manager_status: "shared",
      shared_at: now,
      reviewed_by: auth.profile.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", reviewId)
    .select("subject_id, cycle_id")
    .single();
  if (error) return { error: error.message };

  // Let the staffer know their review is ready (in-app + optional email).
  try {
    const { data: cycle } = await supabase
      .from("review_cycles")
      .select("name")
      .eq("id", updated.cycle_id)
      .maybeSingle();
    const cycleName = (cycle?.name as string) || "your review";
    await insertNotifications(supabase, [
      {
        userId: updated.subject_id as string,
        kind: "review",
        title: "Your performance review is ready",
        body: `Your manager shared feedback for ${cycleName}.`,
        href: "/reviews",
      },
    ]);
    const { data: subject } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", updated.subject_id)
      .maybeSingle();
    if (subject?.email) {
      await sendEmail({
        to: subject.email as string,
        subject: "Your performance review is ready",
        text: `Your manager shared feedback for ${cycleName}. View it in the hub under Reviews.`,
      });
    }
  } catch {
    // ignore — notification is non-critical
  }

  revalidatePath("/reviews");
  revalidatePath("/for-you");
  return { error: null };
}
