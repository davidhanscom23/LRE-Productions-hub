"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { CANDIDATE_STAGES, type CandidateStage } from "@/lib/types/hiring";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

const VALID_STAGE = new Set(CANDIDATE_STAGES.map((s) => s.value));

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, error: "Sign in first." as const };
  if (profile.role !== "admin") {
    return { profile: null, error: "Admins only." as const };
  }
  return { profile, error: null as string | null };
}

function cleanStage(value: string): CandidateStage {
  return (VALID_STAGE.has(value as CandidateStage)
    ? value
    : "applied") as CandidateStage;
}

// ── Job openings ───────────────────────────────────────────────────────
export async function createJobAction(input: {
  title: string;
  department: string;
  description: string;
}): Promise<Result> {
  const { profile, error: authErr } = await requireAdmin();
  if (authErr || !profile) return { error: authErr };
  const title = input.title?.trim();
  if (!title) return { error: "Give the opening a title." };

  const supabase = await createClient();
  const { error } = await supabase.from("job_openings").insert({
    title: title.slice(0, 200),
    department: (input.department ?? "").trim().slice(0, 100),
    description: (input.description ?? "").trim().slice(0, 4000),
    created_by: profile.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

export async function setJobStatusAction(input: {
  jobId: string;
  status: "open" | "closed";
}): Promise<Result> {
  const { error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_openings")
    .update({ status: input.status })
    .eq("id", input.jobId);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

export async function deleteJobAction(jobId: string): Promise<Result> {
  const { error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };
  const supabase = await createClient();
  const { error } = await supabase.from("job_openings").delete().eq("id", jobId);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

// ── Candidates ─────────────────────────────────────────────────────────
export async function createCandidateAction(input: {
  fullName: string;
  email: string;
  phone: string;
  jobId: string | null;
  stage: string;
  notes: string;
}): Promise<Result> {
  const { profile, error: authErr } = await requireAdmin();
  if (authErr || !profile) return { error: authErr };
  const fullName = input.fullName?.trim();
  if (!fullName) return { error: "Give the candidate a name." };

  const supabase = await createClient();
  const { error } = await supabase.from("candidates").insert({
    full_name: fullName.slice(0, 200),
    email: (input.email ?? "").trim().slice(0, 200),
    phone: (input.phone ?? "").trim().slice(0, 60),
    job_id: input.jobId?.trim() || null,
    stage: cleanStage(input.stage),
    notes: (input.notes ?? "").trim().slice(0, 4000),
    created_by: profile.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

export async function updateCandidateStageAction(input: {
  id: string;
  stage: string;
}): Promise<
  Result & {
    onboardingPlanId?: string;
    invited?: boolean;
    inviteError?: string;
  }
> {
  const { profile, error: authErr } = await requireAdmin();
  if (authErr || !profile) return { error: authErr };
  const stage = cleanStage(input.stage);
  const supabase = await createClient();
  const { error } = await supabase
    .from("candidates")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) return { error: error.message };

  let onboardingPlanId: string | undefined;
  let invited: boolean | undefined;
  let inviteError: string | undefined;
  if (stage === "hired") {
    const { data: candidate } = await supabase
      .from("candidates")
      .select("id, full_name, email, job_id")
      .eq("id", input.id)
      .maybeSingle();
    if (candidate) {
      let roleTitle = "";
      if (candidate.job_id) {
        const { data: job } = await supabase
          .from("job_openings")
          .select("title")
          .eq("id", candidate.job_id)
          .maybeSingle();
        roleTitle = job?.title ?? "";
      }

      let profileId: string | null = null;
      const email = String(candidate.email ?? "").trim();
      if (email) {
        const { inviteOrLinkStaffByEmail } = await import(
          "@/lib/people/invite"
        );
        const invite = await inviteOrLinkStaffByEmail({
          supabase,
          email,
          fullName: candidate.full_name,
          inviteIfMissing: true,
        });
        profileId = invite.profileId;
        invited = invite.invited;
        if (invite.error) inviteError = invite.error;
      }

      const { createOnboardingPlanForHire } = await import(
        "@/lib/onboarding/create-plan"
      );
      const plan = await createOnboardingPlanForHire({
        supabase,
        createdBy: profile.id,
        subjectName: candidate.full_name,
        roleTitle,
        candidateId: candidate.id,
        profileId,
      });
      if (plan.planId) onboardingPlanId = plan.planId;
      revalidatePath("/onboarding");
      revalidatePath("/for-you");
    }
  }

  revalidatePath("/hiring");
  return { error: null, onboardingPlanId, invited, inviteError };
}

export async function updateCandidateAction(input: {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  jobId: string | null;
  stage: string;
  notes: string;
}): Promise<
  Result & {
    onboardingPlanId?: string;
    invited?: boolean;
    inviteError?: string;
  }
> {
  const { profile, error: authErr } = await requireAdmin();
  if (authErr || !profile) return { error: authErr };
  const fullName = input.fullName?.trim();
  if (!fullName) return { error: "Give the candidate a name." };
  const stage = cleanStage(input.stage);

  const supabase = await createClient();
  const { error } = await supabase
    .from("candidates")
    .update({
      full_name: fullName.slice(0, 200),
      email: (input.email ?? "").trim().slice(0, 200),
      phone: (input.phone ?? "").trim().slice(0, 60),
      job_id: input.jobId?.trim() || null,
      stage,
      notes: (input.notes ?? "").trim().slice(0, 4000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { error: error.message };

  let onboardingPlanId: string | undefined;
  let invited: boolean | undefined;
  let inviteError: string | undefined;
  if (stage === "hired") {
    let roleTitle = "";
    if (input.jobId?.trim()) {
      const { data: job } = await supabase
        .from("job_openings")
        .select("title")
        .eq("id", input.jobId.trim())
        .maybeSingle();
      roleTitle = job?.title ?? "";
    }

    let profileId: string | null = null;
    const email = (input.email ?? "").trim();
    if (email) {
      const { inviteOrLinkStaffByEmail } = await import("@/lib/people/invite");
      const invite = await inviteOrLinkStaffByEmail({
        supabase,
        email,
        fullName,
        inviteIfMissing: true,
      });
      profileId = invite.profileId;
      invited = invite.invited;
      if (invite.error) inviteError = invite.error;
    }

    const { createOnboardingPlanForHire } = await import(
      "@/lib/onboarding/create-plan"
    );
    const plan = await createOnboardingPlanForHire({
      supabase,
      createdBy: profile.id,
      subjectName: fullName,
      roleTitle,
      candidateId: input.id,
      profileId,
    });
    if (plan.planId) onboardingPlanId = plan.planId;
    revalidatePath("/onboarding");
    revalidatePath("/for-you");
  }

  revalidatePath("/hiring");
  return { error: null, onboardingPlanId, invited, inviteError };
}

export async function deleteCandidateAction(id: string): Promise<Result> {
  const { error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };
  const supabase = await createClient();
  const { error } = await supabase.from("candidates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

// ── Public applications ────────────────────────────────────────────────
export async function promoteApplicationAction(input: {
  applicationId: string;
  jobId: string | null;
}): Promise<Result & { candidateId?: string }> {
  const { profile, error: authErr } = await requireAdmin();
  if (authErr || !profile) return { error: authErr };

  const supabase = await createClient();
  const { data: app, error: loadErr } = await supabase
    .from("hiring_applications")
    .select("*")
    .eq("id", input.applicationId)
    .maybeSingle();
  if (loadErr) return { error: loadErr.message };
  if (!app) return { error: "Application not found." };
  if (app.status === "promoted" && app.candidate_id) {
    return { error: null, candidateId: app.candidate_id as string };
  }

  const notesParts = [
    app.role_interest ? `Role interest: ${app.role_interest}` : "",
    app.message ? String(app.message) : "",
    app.resume_url ? `Resume: ${app.resume_url}` : "",
    "Source: public /apply",
  ].filter(Boolean);

  const { data: candidate, error: candErr } = await supabase
    .from("candidates")
    .insert({
      full_name: String(app.full_name).slice(0, 200),
      email: String(app.email ?? "").slice(0, 200),
      phone: String(app.phone ?? "").slice(0, 60),
      job_id: input.jobId?.trim() || null,
      stage: "applied",
      notes: notesParts.join("\n\n").slice(0, 4000),
      created_by: profile.id,
    })
    .select("id")
    .maybeSingle();
  if (candErr) return { error: candErr.message };
  if (!candidate?.id) return { error: "Could not create candidate." };

  const { error: updErr } = await supabase
    .from("hiring_applications")
    .update({
      status: "promoted",
      candidate_id: candidate.id,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.applicationId);
  if (updErr) return { error: updErr.message };

  revalidatePath("/hiring");
  return { error: null, candidateId: candidate.id };
}

export async function setApplicationStatusAction(input: {
  applicationId: string;
  status: "archived" | "rejected" | "pending";
}): Promise<Result> {
  const { profile, error: authErr } = await requireAdmin();
  if (authErr || !profile) return { error: authErr };
  const supabase = await createClient();
  const { error } = await supabase
    .from("hiring_applications")
    .update({
      status: input.status,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.applicationId);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}
