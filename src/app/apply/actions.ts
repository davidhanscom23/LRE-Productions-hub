"use server";

import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  getApplyTrack,
  type ApplyTrackSlug,
} from "@/lib/hiring/apply-tracks";
import {
  GENERAL_HIRING_ROLE_INTERESTS,
  HIRING_ROLE_INTERESTS,
} from "@/lib/types/hiring-applications";

export type SubmitHiringApplicationInput = {
  fullName: string;
  email: string;
  phone: string;
  roleInterest: string;
  message: string;
  resumeUrl: string;
  assessmentTrack?: ApplyTrackSlug | "";
  assessmentAnswers?: Record<string, string>;
};

/**
 * Public careers form submit. Uses the service role so a logged-in staff
 * session (authenticated RLS) cannot block anon-style inserts.
 */
export async function submitHiringApplicationAction(
  input: SubmitHiringApplicationInput,
): Promise<{ error: string | null }> {
  const fullName = input.fullName.trim().slice(0, 200);
  if (!fullName) return { error: "Please enter your name." };

  const trackSlug = (input.assessmentTrack ?? "").trim();
  const track = trackSlug ? getApplyTrack(trackSlug) : null;
  if (trackSlug && !track) {
    return { error: "Unknown application track." };
  }

  const roleInterest =
    track && track.slug !== "general"
      ? track.roleInterest
      : input.roleInterest.trim().slice(0, 100);

  const allowedRoles =
    !track || track.slug === "general"
      ? (GENERAL_HIRING_ROLE_INTERESTS as readonly string[])
      : (HIRING_ROLE_INTERESTS as readonly string[]);

  if (roleInterest && !allowedRoles.includes(roleInterest)) {
    return { error: "Pick a role interest from the list." };
  }

  const answers = input.assessmentAnswers ?? {};
  if (track && track.questions.length > 0) {
    for (const q of track.questions) {
      const chosen = answers[q.id];
      if (!chosen || !q.options.some((o) => o.id === chosen)) {
        return { error: "Please answer every scenario question." };
      }
    }
  }

  if (!isServiceRoleConfigured()) {
    return {
      error: "Applications are not open yet. Please email us instead.",
    };
  }

  const supabase = createServiceClient();
  const row: Record<string, unknown> = {
    full_name: fullName,
    email: input.email.trim().slice(0, 200),
    phone: input.phone.trim().slice(0, 40),
    role_interest: roleInterest,
    message: input.message.trim().slice(0, 4000),
    resume_url: input.resumeUrl.trim().slice(0, 500),
    status: "pending",
    assessment_track: track?.slug ?? "",
    assessment_answers: answers,
  };

  const { error } = await supabase.from("hiring_applications").insert(row);

  if (error) {
    if (
      /hiring_applications|schema cache|does not exist|42P01|assessment_/i.test(
        error.message,
      )
    ) {
      return {
        error:
          "Applications are not open yet. Please email us instead.",
      };
    }
    return { error: error.message };
  }

  return { error: null };
}
