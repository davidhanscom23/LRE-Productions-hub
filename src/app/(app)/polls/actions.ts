"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

function canManage(role: string | undefined): boolean {
  return role === "admin" || role === "trainer";
}

export async function createPollAction(input: {
  question: string;
  options: string[];
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };
  const question = input.question?.trim();
  if (!question) return { error: "Enter a question." };
  const options = (input.options ?? [])
    .map((o) => o.trim())
    .filter(Boolean)
    .slice(0, 10);
  if (options.length < 2) return { error: "Add at least two options." };

  const supabase = await createClient();
  const { data: poll, error } = await supabase
    .from("polls")
    .insert({ question: question.slice(0, 500), created_by: profile.id })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const rows = options.map((label, i) => ({
    poll_id: poll.id,
    label: label.slice(0, 200),
    sort_order: i,
  }));
  const { error: optError } = await supabase.from("poll_options").insert(rows);
  if (optError) return { error: optError.message };

  // Notify active staff of the new poll. Uses a SECURITY DEFINER function so
  // any creator (admin, trainer, or staff) can notify the whole team.
  try {
    await supabase.rpc("notify_new_poll", { p_poll_id: poll.id });
  } catch {
    // non-critical
  }

  revalidatePath("/polls");
  revalidatePath("/");
  return { error: null };
}

export async function voteAction(input: {
  pollId: string;
  optionId: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const supabase = await createClient();
  const { data: poll } = await supabase
    .from("polls")
    .select("is_closed")
    .eq("id", input.pollId)
    .maybeSingle();
  if (!poll) return { error: "Poll not found." };
  if (poll.is_closed) return { error: "This poll is closed." };

  const { data: option } = await supabase
    .from("poll_options")
    .select("id")
    .eq("id", input.optionId)
    .eq("poll_id", input.pollId)
    .maybeSingle();
  if (!option) return { error: "Invalid option." };

  const { error } = await supabase.from("poll_votes").upsert(
    { poll_id: input.pollId, option_id: input.optionId, user_id: profile.id },
    { onConflict: "poll_id,user_id" },
  );
  if (error) return { error: error.message };

  revalidatePath("/polls");
  return { error: null };
}

export async function setPollClosedAction(input: {
  pollId: string;
  closed: boolean;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };

  const supabase = await createClient();
  if (!(await canManagePoll(supabase, profile, input.pollId))) {
    return { error: "Not allowed." };
  }
  const { error } = await supabase
    .from("polls")
    .update({ is_closed: input.closed })
    .eq("id", input.pollId);
  if (error) return { error: error.message };
  revalidatePath("/polls");
  return { error: null };
}

export async function deletePollAction(pollId: string): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };

  const supabase = await createClient();
  if (!(await canManagePoll(supabase, profile, pollId))) {
    return { error: "Not allowed." };
  }
  const { error } = await supabase.from("polls").delete().eq("id", pollId);
  if (error) return { error: error.message };
  revalidatePath("/polls");
  return { error: null };
}

/** Admins/trainers manage any poll; a creator manages their own. */
async function canManagePoll(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: { id: string; role?: string },
  pollId: string,
): Promise<boolean> {
  if (canManage(profile.role)) return true;
  const { data } = await supabase
    .from("polls")
    .select("created_by")
    .eq("id", pollId)
    .maybeSingle();
  return data?.created_by === profile.id;
}
