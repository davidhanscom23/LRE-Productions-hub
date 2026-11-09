"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  EVENT_TYPES,
  type EventReportInput,
  type EventType,
} from "@/lib/types/event-reports";

export async function createEventReportAction(
  input: EventReportInput,
): Promise<{ error: string | null; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  if (!input.event_date) return { error: "Event date is required." };
  if (!input.client_name.trim()) return { error: "Client name is required." };
  if (!input.venue.trim()) return { error: "Venue is required." };
  if (!EVENT_TYPES.includes(input.event_type as EventType)) {
    return { error: "Choose a valid event type." };
  }
  const eventTypeOther =
    input.event_type === "Other" ? input.event_type_other.trim() : "";
  if (input.event_type === "Other" && !eventTypeOther) {
    return { error: "Describe the event type when Other is selected." };
  }
  if (input.rating < 1 || input.rating > 5) {
    return { error: "Rating must be between 1 and 5." };
  }

  const { data, error } = await supabase
    .from("event_reports")
    .insert({
      reporter_id: user.id,
      event_date: input.event_date,
      client_name: input.client_name.trim(),
      venue: input.venue.trim(),
      event_type: input.event_type,
      event_type_other: eventTypeOther,
      hours_worked: "",
      equipment_notes: input.equipment_notes.trim(),
      memorable_moment: input.memorable_moment.trim(),
      issues: input.issues.trim(),
      client_feedback: input.client_feedback.trim(),
      rating: input.rating,
      follow_up_needed: input.follow_up_needed,
      follow_up_notes: input.follow_up_needed
        ? input.follow_up_notes.trim()
        : "",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  try {
    const { awardAchievement } = await import("@/lib/points/hub-points");
    await awardAchievement(supabase, "eoe_report_submitted", {
      report_id: data.id,
    });
  } catch {
    // non-critical
  }

  revalidatePath("/end-of-event-report");
  return { error: null, id: data.id };
}

export async function deleteEventReportAction(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.from("event_reports").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/end-of-event-report");
  return { error: null };
}
