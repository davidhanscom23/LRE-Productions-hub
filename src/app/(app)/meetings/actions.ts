"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { analyzeMeeting } from "@/lib/meetings/analyze";

async function requireManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "You must be signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role;
  if (role !== "admin" && role !== "trainer") {
    return { supabase, user: null, error: "Only admins and trainers can use Meetings." };
  }
  return { supabase, user, error: null as string | null };
}

/** Insert a meeting, then analyze it right away when a transcript is present. */
export async function createMeetingAction(input: {
  title: string;
  meetingDate: string | null;
  transcript: string;
}): Promise<{ error: string | null; id?: string }> {
  const { supabase, user, error } = await requireManager();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const title = input.title.trim();
  if (!title) return { error: "Title is required." };
  const transcript = input.transcript.trim();

  const { data, error: insertError } = await supabase
    .from("meeting_notes")
    .insert({
      title,
      meeting_date: input.meetingDate || null,
      transcript,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insertError) return { error: insertError.message };

  const id = data.id as string;
  if (transcript.length >= 40) {
    await runAnalysis(id);
  }

  revalidatePath("/meetings");
  return { error: null, id };
}

export async function analyzeMeetingAction(
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await requireManager();
  if (error) return { error };
  const res = await runAnalysis(id);
  revalidatePath("/meetings");
  return { error: res.error };
}

/** Shared: run the model, persist summary/score/analysis + refresh action items. */
async function runAnalysis(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: meeting } = await supabase
    .from("meeting_notes")
    .select("id, title, meeting_date, transcript")
    .eq("id", id)
    .maybeSingle();
  if (!meeting) return { error: "Meeting not found." };

  const { analysis, error } = await analyzeMeeting(
    String(meeting.transcript ?? ""),
    {
      title: String(meeting.title ?? ""),
      date: (meeting.meeting_date as string) ?? null,
    },
  );
  if (error || !analysis) return { error: error ?? "Analysis failed." };

  const { error: updateError } = await supabase
    .from("meeting_notes")
    .update({
      summary: analysis.summary,
      quality_score: analysis.quality_score,
      analysis: {
        strengths: analysis.strengths,
        improvements: analysis.improvements,
      },
      analyzed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateError) return { error: updateError.message };

  // Replace AI-generated action items (keep any the user added manually? Simpler:
  // clear and re-insert the model's list). Manual adds happen after analysis.
  await supabase.from("meeting_action_items").delete().eq("meeting_id", id);
  if (analysis.action_items.length > 0) {
    await supabase.from("meeting_action_items").insert(
      analysis.action_items.map((a) => ({
        meeting_id: id,
        text: a.text,
        owner: a.owner,
        due_date: a.due_date,
      })),
    );
  }
  return { error: null };
}

export async function deleteMeetingAction(
  id: string,
): Promise<{ error: string | null }> {
  const { supabase, error } = await requireManager();
  if (error) return { error };
  const { error: deleteError } = await supabase
    .from("meeting_notes")
    .delete()
    .eq("id", id);
  if (deleteError) return { error: deleteError.message };
  revalidatePath("/meetings");
  return { error: null };
}

export async function addActionItemAction(input: {
  meetingId: string;
  text: string;
  owner: string;
  dueDate: string | null;
}): Promise<{ error: string | null }> {
  const { supabase, error } = await requireManager();
  if (error) return { error };
  const text = input.text.trim();
  if (!text) return { error: "Enter an action item." };
  const { error: insertError } = await supabase
    .from("meeting_action_items")
    .insert({
      meeting_id: input.meetingId,
      text,
      owner: input.owner.trim(),
      due_date: input.dueDate || null,
    });
  if (insertError) return { error: insertError.message };
  revalidatePath("/meetings");
  return { error: null };
}

export async function setActionItemStatusAction(
  id: string,
  status: "open" | "done",
): Promise<{ error: string | null }> {
  const { supabase, error } = await requireManager();
  if (error) return { error };
  const { error: updateError } = await supabase
    .from("meeting_action_items")
    .update({ status })
    .eq("id", id);
  if (updateError) return { error: updateError.message };
  revalidatePath("/meetings");
  return { error: null };
}

export async function deleteActionItemAction(
  id: string,
): Promise<{ error: string | null }> {
  const { supabase, error } = await requireManager();
  if (error) return { error };
  const { error: deleteError } = await supabase
    .from("meeting_action_items")
    .delete()
    .eq("id", id);
  if (deleteError) return { error: deleteError.message };
  revalidatePath("/meetings");
  return { error: null };
}
