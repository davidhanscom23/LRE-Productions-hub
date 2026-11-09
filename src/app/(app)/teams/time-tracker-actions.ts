"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function clockInAction(input: {
  department: string;
  eventName: string;
  notes: string;
  source: "manual" | "calendar";
  latitude?: number | null;
  longitude?: number | null;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const eventName = input.eventName.trim();
  if (!eventName) return { error: "Event name is required." };

  const { data: open } = await supabase
    .from("time_entries")
    .select("id")
    .eq("user_id", user.id)
    .is("clocked_out_at", null)
    .maybeSingle();

  if (open) {
    return { error: "You’re already clocked in. Clock out first." };
  }

  const { error } = await supabase.from("time_entries").insert({
    user_id: user.id,
    department: input.department,
    event_name: eventName,
    notes: input.notes.trim(),
    source: input.source,
    clocked_in_at: new Date().toISOString(),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath("/teams");
  return { error: null };
}

export async function clockOutAction(
  entryId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("time_entries")
    .update({ clocked_out_at: new Date().toISOString() })
    .eq("id", entryId)
    .eq("user_id", user.id)
    .is("clocked_out_at", null);

  if (error) return { error: error.message };
  revalidatePath("/teams");
  return { error: null };
}
